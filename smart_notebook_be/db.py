import sqlite3
import os
from typing import List, Dict, Any

# Database path
DB_PATH = os.path.join(os.path.dirname(__file__), "notebook.db")


def get_db_connection():
    # Increase timeout to 10s to handle concurrent writes better (default is 5s)
    conn = sqlite3.connect(DB_PATH, timeout=10.0)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db_connection()
    # Enable WAL mode for better concurrency
    conn.execute("PRAGMA journal_mode=WAL;")
    cursor = conn.cursor()
    
    # Threads table
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS threads (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
    ''')
    
    # Messages table
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        thread_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        original_language TEXT,
        translated_content TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (thread_id) REFERENCES threads (id)
    )
    ''')
    
    # Bookmarked threads table
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS bookmarked_threads (
        thread_id TEXT PRIMARY KEY,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (thread_id) REFERENCES threads (id)
    )
    ''')
    
    # Bookmarks table (words/sentences)
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS bookmarks (
        id TEXT PRIMARY KEY,
        thread_id TEXT NOT NULL,
        text TEXT NOT NULL,
        translation TEXT NOT NULL,
        type TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (thread_id) REFERENCES threads (id)
    )
    ''')
    
    conn.commit()
    conn.close()

# Initialize on import
init_db()

class DBWrapper:
    class Table:
        def __init__(self, table_name: str):
            self.table_name = table_name

        def select(self, *args):
            self._select = args[0] if args else "*"
            return self

        def eq(self, column: str, value: Any):
            self._eq_col = column
            self._eq_val = value
            return self

        def order(self, column: str, desc: bool = False):
            self._order_col = column
            self._order_desc = desc
            return self

        def limit(self, count: int):
            self._limit = count
            return self

        def in_(self, column: str, values: List[Any]):
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
                    import uuid
                    data = self._insert_data
                    
                    if "id" not in data and self.table_name != "bookmarked_threads":
                        data["id"] = str(uuid.uuid4())
                    
                    columns = ", ".join(data.keys())
                    placeholders = ", ".join(["?" for _ in data])
                    query = f"INSERT INTO {self.table_name} ({columns}) VALUES ({placeholders})"
                    # print(f"DEBUG INSERT: {query} / {data.values()}")
                    cursor.execute(query, list(data.values()))
                    conn.commit()
                    
                    # Fetch back (only if we have an ID to query by)
                    if "id" in data:
                        cursor.execute(f"SELECT * FROM {self.table_name} WHERE id = ?", (data["id"],))
                        row = cursor.fetchone()
                        return type('Response', (), {'data': [dict(row)] if row else []})
                    else:
                        # For cases like bookmarked_threads where we insert thread_id
                         return type('Response', (), {'data': [data]})


                # Handle UPDATE
                if hasattr(self, "_update_data"):
                    sets = ", ".join([f"{k} = ?" for k in self._update_data.keys()])
                    query = f"UPDATE {self.table_name} SET {sets} WHERE {self._eq_col} = ?"
                    cursor.execute(query, list(self._update_data.values()) + [self._eq_val])
                    conn.commit()
                    return type('Response', (), {'data': []})
                
                # Handle DELETE
                if hasattr(self, "_delete"):
                    query = f"DELETE FROM {self.table_name} WHERE {self._eq_col} = ?"
                    cursor.execute(query, [self._eq_val])
                    conn.commit()
                    return type('Response', (), {'data': []})
                
                # Default: SELECT
                query = f"SELECT {getattr(self, '_select', '*')} FROM {self.table_name}"
                params = []
                
                if hasattr(self, "_eq_col"):
                    query += f" WHERE {self._eq_col} = ?"
                    params.append(self._eq_val)
                elif hasattr(self, "_in_col") and self._in_vals:
                    placeholders = ", ".join(["?" for _ in self._in_vals])
                    query += f" WHERE {self._in_col} IN ({placeholders})"
                    params.extend(self._in_vals)
                    
                if hasattr(self, "_order_col"):
                    query += f" ORDER BY {self._order_col} {'DESC' if self._order_desc else 'ASC'}"
                    
                if hasattr(self, "_limit"):
                    query += f" LIMIT {self._limit}"
                    
                cursor.execute(query, params)
                rows = cursor.fetchall()
                data = [dict(row) for row in rows]
                return type('Response', (), {'data': data})
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

# Mock supabase client with SQLite
supabase = DBWrapper()
