from __future__ import annotations

from http.server import ThreadingHTTPServer
from pathlib import Path

from blog_backend.api import BlogRequestHandler
from blog_backend.storage import BlogStore


if __name__ == "__main__":
    root = Path(__file__).resolve().parent
    store = BlogStore(root)
    store.initialize()
    class Handler(BlogRequestHandler):
        def __init__(self, *args, **kwargs):
            super().__init__(*args, directory=str(root), **kwargs)

    Handler.root = root
    Handler.store = store
    server = ThreadingHTTPServer(("0.0.0.0", 4178), Handler)
    server.serve_forever()
