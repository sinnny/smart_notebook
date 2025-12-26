"""Vercel entrypoint.

Vercel's Python Functions look for an ASGI app object in the entry file.
We expose the FastAPI `app` defined in `smart_notebook_be/main.py`.
"""

import os
import sys

# Ensure the parent directory (smart_notebook_be/) is on sys.path so we can import main.py
_BASE_DIR = os.path.dirname(os.path.dirname(__file__))
if _BASE_DIR not in sys.path:
    sys.path.insert(0, _BASE_DIR)

from main import app  # noqa: E402

__all__ = ["app"]
