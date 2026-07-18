from __future__ import annotations

from pathlib import Path
from urllib.parse import unquote, urlsplit


_EXACT_PUBLIC_FILES = {
    "/app.js": "app.js",
    "/orbit/": "index.html",
    "/procon/": "procon/index.html",
    "/styles.css": "styles.css",
    "/wonderlab/": "wonderlab/index.html",
    "/wasteland-terminal-map/": "wasteland-terminal-map/index.html",
}
_PUBLIC_DIRECTORIES = ("assets", "procon", "wasteland-terminal-map", "wonderlab")
_PUBLIC_HOME_DOCUMENTS = {"index.html", "wonderlab/index.html"}
_PRIVATE_PATH_NAMES = {"__pycache__", "data", "test", "tests"}
_PRIVATE_SUFFIXES = {".py", ".pyc", ".pyo", ".pyw"}


def resolve_public_file(
    root: Path,
    request_target: str,
    home_document: str = "index.html",
) -> Path | None:
    """Resolve an explicitly public request target without exposing the repo tree."""
    try:
        encoded_path = urlsplit(request_target).path
        request_path = unquote(encoded_path, encoding="utf-8", errors="strict")
    except (UnicodeError, ValueError):
        return None

    if not request_path.startswith("/") or "\0" in request_path or "\\" in request_path:
        return None

    if request_path == "/":
        if home_document not in _PUBLIC_HOME_DOCUMENTS:
            return None
        relative_path = home_document
    else:
        relative_path = _EXACT_PUBLIC_FILES.get(request_path)
    if relative_path is None:
        parts = request_path.removeprefix("/").split("/")
        if not parts or parts[0] not in _PUBLIC_DIRECTORIES:
            return None
        if any(not part for part in parts):
            return None
        relative_path = "/".join(parts)

    requested_parts = relative_path.split("/")
    if _contains_private_part(requested_parts):
        return None

    try:
        resolved_root = root.resolve(strict=True)
        candidate = resolved_root.joinpath(*requested_parts)
        resolved_candidate = candidate.resolve(strict=True)

        if requested_parts[0] in _PUBLIC_DIRECTORIES:
            declared_public_base = resolved_root / requested_parts[0]
            if declared_public_base.is_symlink():
                return None
            public_base = declared_public_base.resolve(strict=True)
            if public_base != declared_public_base:
                return None
            resolved_candidate.relative_to(public_base)
        elif resolved_candidate != candidate:
            return None

        resolved_parts = resolved_candidate.relative_to(resolved_root).parts
    except (FileNotFoundError, OSError, RuntimeError, ValueError):
        return None

    if _contains_private_part(resolved_parts) or not resolved_candidate.is_file():
        return None
    return resolved_candidate


def _contains_private_part(parts: tuple[str, ...] | list[str]) -> bool:
    return any(
        part in {".", ".."}
        or part.startswith(".")
        or part.casefold() in _PRIVATE_PATH_NAMES
        or Path(part).suffix.casefold() in _PRIVATE_SUFFIXES
        for part in parts
    )
