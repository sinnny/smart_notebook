import os
import re
import uuid
from typing import List, Dict, Any
import psycopg2
from psycopg2.extras import RealDictCursor

_IDENTIFIER_RE = re.compile(r"^[a-zA-Z_][a-zA-Z0-9_]*$")
_ALLOWED_TABLES = {"threads", "messages", "bookmarked_threads", "bookmarks", "users"}


def _get_postgres_connect_kwargs() -> Dict[str, Any]:
    dsn = os.getenv("DATABASE_URL") or os.getenv("POSTGRES_URL")
    if dsn:
        sslmode = os.getenv("POSTGRES_SSLMODE") or os.getenv("PGSSLMODE")
        if sslmode:
            return {"dsn": dsn, "sslmode": sslmode}
        if "supabase" in dsn and "sslmode=" not in dsn:
            return {"dsn": dsn, "sslmode": "require"}
        return {"dsn": dsn}

    host = os.getenv("POSTGRES_HOST") or os.getenv("PGHOST")
    if host and (host.startswith("postgresql://") or host.startswith("postgres://")):
        raise RuntimeError(
            "POSTGRES_HOST에는 호스트명만 넣어야 합니다. "
            "현재 postgresql://... 형태의 전체 connection URI가 들어있습니다. "
            "DATABASE_URL(권장) 또는 POSTGRES_URL로 옮기거나, "
            "POSTGRES_HOST=db.<project-ref>.supabase.co 처럼 호스트만 설정해 주세요."
        )
    port = os.getenv("POSTGRES_PORT") or os.getenv("PGPORT") or "5432"
    dbname = os.getenv("POSTGRES_DB") or os.getenv("PGDATABASE")
    user = os.getenv("POSTGRES_USER") or os.getenv("PGUSER")
    password = os.getenv("POSTGRES_PASSWORD") or os.getenv("PGPASSWORD")

    missing = [
        name
        for name, value in [
            ("POSTGRES_HOST", host),
            ("POSTGRES_DB", dbname),
            ("POSTGRES_USER", user),
            ("POSTGRES_PASSWORD", password),
        ]
        if not value
    ]
    if missing:
        raise RuntimeError(
            "PostgreSQL 연결 환경변수가 없습니다. "
            "DATABASE_URL(권장) 또는 "
            "POSTGRES_HOST/POSTGRES_DB/POSTGRES_USER/POSTGRES_PASSWORD 를 설정해 주세요. "
            f"(missing: {', '.join(missing)})"
        )

    sslmode = os.getenv("POSTGRES_SSLMODE") or os.getenv("PGSSLMODE")
    if not sslmode:
        sslmode = "require" if host and "supabase" in host else "prefer"

    return {
        "host": host,
        "port": int(port),
        "dbname": dbname,
        "user": user,
        "password": password,
        "sslmode": sslmode,
    }


def get_db_connection():
    """DB 연결 생성"""
    kwargs = _get_postgres_connect_kwargs()
    try:
        return psycopg2.connect(**kwargs, cursor_factory=RealDictCursor)
    except psycopg2.OperationalError as e:
        print(f"❌ DB 연결 실패: {e}")
        raise


def init_db():
    """데이터베이스 초기화 (테이블 생성)"""
    print("🔄 데이터베이스 초기화 중...")
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        # 1. Users Table
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                user_type TEXT NOT NULL DEFAULT 'guest',
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW(),
                deleted_at TIMESTAMPTZ,
                last_active_at TIMESTAMPTZ DEFAULT NOW()
            )
            """
        )

        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS threads (
                id TEXT PRIMARY KEY,
                user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
                title TEXT NOT NULL,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW()
            )
            """
        )
        
        # Add user_id column if it doesn't exist (for existing tables)
        cursor.execute(
            """
            DO $$ 
            BEGIN 
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='threads' AND column_name='user_id') THEN 
                    ALTER TABLE threads ADD COLUMN user_id TEXT REFERENCES users(id) ON DELETE CASCADE; 
                END IF; 
            END $$;
            """
        )
        
        # Index on user_id
        cursor.execute(
            "CREATE INDEX IF NOT EXISTS threads_user_id_idx ON threads(user_id)"
        )

        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS messages (
                id TEXT PRIMARY KEY,
                thread_id TEXT NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
                role TEXT NOT NULL,
                content TEXT NOT NULL,
                original_language TEXT,
                translated_content TEXT,
                created_at TIMESTAMPTZ DEFAULT NOW()
            )
            """
        )

        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS bookmarked_threads (
                thread_id TEXT PRIMARY KEY REFERENCES threads(id) ON DELETE CASCADE,
                created_at TIMESTAMPTZ DEFAULT NOW()
            )
            """
        )

        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS bookmarks (
                id TEXT PRIMARY KEY,
                thread_id TEXT NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
                text TEXT NOT NULL,
                translation TEXT NOT NULL,
                type TEXT NOT NULL,
                created_at TIMESTAMPTZ DEFAULT NOW()
            )
            """
        )

        cursor.execute(
            "CREATE INDEX IF NOT EXISTS messages_thread_created_at_idx ON messages(thread_id, created_at)"
        )
        cursor.execute(
            "CREATE INDEX IF NOT EXISTS bookmarks_thread_created_at_idx ON bookmarks(thread_id, created_at)"
        )

        conn.commit()
        print("✅ 데이터베이스 초기화 완료!")
    except Exception as e:
        print(f"❌ 데이터베이스 초기화 실패: {e}")
        raise
    finally:
        if conn:
            conn.close()


# ⚠️ 중요: 모듈 로딩 시점에는 init_db()를 호출하지 않음
# 대신 main.py의 startup 이벤트에서 호출하도록 변경


class DBWrapper:
    class Table:
        def __init__(self, table_name: str):
            if table_name not in _ALLOWED_TABLES:
                raise ValueError(f"Invalid table name: {table_name}")
            self.table_name = table_name

        def select(self, *args):
            self._select = args[0] if args else "*"
            return self

        def eq(self, column: str, value: Any):
            if not _IDENTIFIER_RE.match(column):
                raise ValueError(f"Invalid column name: {column}")
            self._eq_col = column
            self._eq_val = value
            return self

        def order(self, column: str, desc: bool = False):
            if not _IDENTIFIER_RE.match(column):
                raise ValueError(f"Invalid column name: {column}")
            self._order_col = column
            self._order_desc = desc
            return self

        def limit(self, count: int):
            self._limit = count
            return self

        def in_(self, column: str, values: List[Any]):
            if not _IDENTIFIER_RE.match(column):
                raise ValueError(f"Invalid column name: {column}")
            self._in_col = column
            self._in_vals = values
            return self

        def execute(self):
            conn = None
            try:
                conn = get_db_connection()
                cursor = conn.cursor()

                # Handle INSERT
                if hasattr(self, "_insert_data"):
                    data = self._insert_data

                    if "id" not in data and self.table_name != "bookmarked_threads":
                        data["id"] = str(uuid.uuid4())

                    for col in data.keys():
                        if not _IDENTIFIER_RE.match(col):
                            raise ValueError(f"Invalid column name: {col}")

                    columns = ", ".join(data.keys())
                    placeholders = ", ".join(["%s" for _ in data])
                    query = (
                        f"INSERT INTO {self.table_name} ({columns}) "
                        f"VALUES ({placeholders}) RETURNING *"
                    )
                    cursor.execute(query, list(data.values()))
                    row = cursor.fetchone()
                    conn.commit()
                    return type("Response", (), {"data": [row] if row else []})

                # Handle UPDATE
                if hasattr(self, "_update_data"):
                    for col in self._update_data.keys():
                        if not _IDENTIFIER_RE.match(col):
                            raise ValueError(f"Invalid column name: {col}")
                    sets = ", ".join([f"{k} = %s" for k in self._update_data.keys()])
                    query = (
                        f"UPDATE {self.table_name} SET {sets} WHERE {self._eq_col} = %s"
                    )
                    cursor.execute(
                        query, list(self._update_data.values()) + [self._eq_val]
                    )
                    conn.commit()
                    return type("Response", (), {"data": []})

                # Handle DELETE
                if hasattr(self, "_delete"):
                    query = f"DELETE FROM {self.table_name} WHERE {self._eq_col} = %s"
                    cursor.execute(query, [self._eq_val])
                    conn.commit()
                    return type("Response", (), {"data": []})

                # Default: SELECT
                query = f"SELECT {getattr(self, '_select', '*')} FROM {self.table_name}"
                params = []

                if hasattr(self, "_eq_col"):
                    query += f" WHERE {self._eq_col} = %s"
                    params.append(self._eq_val)
                elif hasattr(self, "_in_col") and self._in_vals:
                    placeholders = ", ".join(["%s" for _ in self._in_vals])
                    query += f" WHERE {self._in_col} IN ({placeholders})"
                    params.extend(self._in_vals)

                if hasattr(self, "_order_col"):
                    query += f" ORDER BY {self._order_col} {'DESC' if self._order_desc else 'ASC'}"

                if hasattr(self, "_limit"):
                    query += f" LIMIT {self._limit}"

                cursor.execute(query, params)
                rows = cursor.fetchall()
                data = list(rows or [])
                return type("Response", (), {"data": data})
            except Exception as e:
                print(f"DB EXECUTE ERROR: {e}")
                import traceback

                traceback.print_exc()
                raise e
            finally:
                if conn:
                    conn.close()

        def insert(self, data: Dict[str, Any]):
            self._insert_data = data
            return self

        def update(self, data: Dict[str, Any]):
            self._update_data = data
            return self

        def delete(self):
            self._delete = True
            return self

    def table(self, name: str):
        return self.Table(name)


# Postgres-backed supabase-like client
supabase = DBWrapper()
