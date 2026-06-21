from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


class NoCacheHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()


if __name__ == "__main__":
    root = Path(__file__).resolve().parent
    handler = lambda *args, **kwargs: NoCacheHandler(*args, directory=str(root), **kwargs)
    server = ThreadingHTTPServer(("0.0.0.0", 4178), handler)
    server.serve_forever()
