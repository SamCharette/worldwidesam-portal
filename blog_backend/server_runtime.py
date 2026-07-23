from __future__ import annotations

import argparse
from dataclasses import dataclass
from http.server import ThreadingHTTPServer
from pathlib import Path
from typing import Sequence

from .api import BlogRequestHandler
from .private_static import PrivateStaticRegistry
from .storage import BlogStore


DEFAULT_HOST = "127.0.0.1"
DEFAULT_PORT = 4178
DEFAULT_HOME_DOCUMENT = "wonderlab/index.html"
ALLOWED_HOME_DOCUMENTS = ("index.html", "wonderlab/index.html")
PUBLIC_STATIC_DIRECTORIES = frozenset(
    {"assets", "procon", "wasteland-terminal-map", "wonderlab"}
)


@dataclass(frozen=True)
class ServerConfiguration:
    root: Path
    host: str
    port: int
    home_document: str
    database: Path
    private_sites: Path


def parse_server_configuration(
    argv: Sequence[str] | None = None,
    *,
    root: Path | None = None,
) -> ServerConfiguration:
    app_root = (root or Path(__file__).resolve().parents[1]).resolve()
    parser = argparse.ArgumentParser(description="Serve the Worldwide Sam portal.")
    parser.add_argument("--host", default=DEFAULT_HOST)
    parser.add_argument("--port", type=_port_number, default=DEFAULT_PORT)
    parser.add_argument(
        "--home",
        choices=ALLOWED_HOME_DOCUMENTS,
        default=DEFAULT_HOME_DOCUMENT,
        help="Document rendered at the server root.",
    )
    parser.add_argument(
        "--database",
        type=Path,
        default=app_root / "data" / "blog.sqlite3",
        help="SQLite blog database; relative paths resolve from the portal root.",
    )
    parser.add_argument(
        "--private-sites",
        type=Path,
        default=app_root / "data" / "private-sites",
        help="Manifest-allowlisted private static sites; relative paths resolve from the portal root.",
    )
    args = parser.parse_args(argv)
    database = args.database if args.database.is_absolute() else app_root / args.database
    private_sites = (
        args.private_sites
        if args.private_sites.is_absolute()
        else app_root / args.private_sites
    ).absolute()
    try:
        private_relative = private_sites.relative_to(app_root)
    except ValueError:
        private_relative = None
    if (
        private_relative is not None
        and private_relative.parts
        and private_relative.parts[0] in PUBLIC_STATIC_DIRECTORIES
    ):
        parser.error(
            "private sites cannot be stored inside a public static directory"
        )
    return ServerConfiguration(
        root=app_root,
        host=args.host,
        port=args.port,
        home_document=args.home,
        database=database.resolve(),
        private_sites=private_sites,
    )


def create_server(configuration: ServerConfiguration) -> ThreadingHTTPServer:
    store = BlogStore(configuration.root, configuration.database)
    store.initialize()
    root = configuration.root

    class Handler(BlogRequestHandler):
        def __init__(self, *args, **kwargs):
            super().__init__(*args, directory=str(root), **kwargs)

    Handler.root = root
    Handler.store = store
    Handler.home_document = configuration.home_document
    Handler.private_sites = PrivateStaticRegistry.load(configuration.private_sites)
    return ThreadingHTTPServer((configuration.host, configuration.port), Handler)


def run_server(argv: Sequence[str] | None = None) -> None:
    configuration = parse_server_configuration(argv)
    server = create_server(configuration)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


def _port_number(value: str) -> int:
    port = int(value)
    if not 1 <= port <= 65535:
        raise argparse.ArgumentTypeError("port must be between 1 and 65535")
    return port
