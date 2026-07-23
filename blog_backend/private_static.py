from __future__ import annotations

import json
import os
import re
import stat as stat_module
from dataclasses import dataclass
from io import BufferedReader
from pathlib import Path, PurePosixPath
from urllib.parse import unquote, urlsplit


MANIFEST_NAME = "site.json"
_ROUTE_PATTERN = re.compile(r"^/[a-z0-9]+(?:-[a-z0-9]+)*$")
_PUBLIC_PATH_PATTERN = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._/-]*$")
_DOWNLOAD_NAME_PATTERN = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._ -]*$")
_ENCODED_SEPARATOR_PATTERN = re.compile(r"%(?:2f|5c)", re.IGNORECASE)
_RESERVED_ROUTES = frozenset(
    {
        "/api",
        "/assets",
        "/blog",
        "/neon-cycle-grid",
        "/orbit",
        "/procon",
        "/wasteland-terminal-map",
        "/wonderlab",
    }
)
_CONTENT_TYPES = {
    ".css": "text/css; charset=utf-8",
    ".flac": "audio/flac",
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".md": "text/markdown; charset=utf-8",
    ".otf": "font/otf",
    ".ttf": "font/ttf",
    ".txt": "text/plain; charset=utf-8",
    ".vtt": "text/vtt; charset=utf-8",
    ".wav": "audio/wav",
    ".zip": "application/zip",
}


class PrivateStaticConfigurationError(ValueError):
    """Raised when a private runtime manifest weakens the serving boundary."""


class RangeNotSatisfiable(ValueError):
    """Raised when a byte-range header cannot be served as one bounded range."""


@dataclass(frozen=True)
class ByteRange:
    start: int
    end: int

    @property
    def length(self) -> int:
        return self.end - self.start + 1


@dataclass(frozen=True)
class PrivateStaticAsset:
    public_path: str
    file_path: Path
    content_type: str
    download_name: str | None = None


@dataclass(frozen=True)
class PrivateStaticSite:
    route: str
    root: Path
    root_device: int
    root_inode: int
    index: str
    assets: dict[str, PrivateStaticAsset]

    @classmethod
    def load(cls, site_root: Path) -> PrivateStaticSite:
        root = _strict_directory(site_root)
        manifest_path = root / MANIFEST_NAME
        if manifest_path.is_symlink():
            raise PrivateStaticConfigurationError("private site manifest cannot be a symlink")
        try:
            manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        except (FileNotFoundError, OSError, UnicodeError, json.JSONDecodeError) as exc:
            raise PrivateStaticConfigurationError("private site manifest is unreadable") from exc
        if not isinstance(manifest, dict):
            raise PrivateStaticConfigurationError("private site manifest must be an object")

        route = _validated_route(manifest.get("route"))
        index = _validated_public_path(manifest.get("index", "index.html"))
        declared_assets = manifest.get("assets")
        if not isinstance(declared_assets, dict) or not declared_assets:
            raise PrivateStaticConfigurationError("private site assets must be a non-empty object")

        assets: dict[str, PrivateStaticAsset] = {}
        for public_path, declaration in declared_assets.items():
            public_path = _validated_public_path(public_path)
            if not isinstance(declaration, dict):
                raise PrivateStaticConfigurationError(
                    f"private asset declaration must be an object: {public_path}"
                )
            file_path = _resolved_asset_file(root, declaration.get("file"))
            download_name = declaration.get("download_name")
            if download_name is not None:
                download_name = _validated_download_name(download_name)
            content_type = _CONTENT_TYPES.get(file_path.suffix.casefold())
            if content_type is None:
                raise PrivateStaticConfigurationError(
                    f"private asset has an unsupported file type: {public_path}"
                )
            assets[public_path] = PrivateStaticAsset(
                public_path=public_path,
                file_path=file_path,
                content_type=content_type,
                download_name=download_name,
            )

        if index not in assets:
            raise PrivateStaticConfigurationError("private site index is not an allowlisted asset")
        root_stat = root.stat()
        return cls(
            route=route,
            root=root,
            root_device=root_stat.st_dev,
            root_inode=root_stat.st_ino,
            index=index,
            assets=assets,
        )

    def resolve(self, request_target: str) -> PrivateStaticAsset | None:
        try:
            encoded_path = urlsplit(request_target).path
        except ValueError:
            return None
        prefix = f"{self.route}/"
        if not encoded_path.startswith(prefix):
            return None

        encoded_relative = encoded_path.removeprefix(prefix)
        if _ENCODED_SEPARATOR_PATTERN.search(encoded_relative):
            return None
        if not encoded_relative:
            relative_path = self.index
        else:
            try:
                relative_path = unquote(encoded_relative, encoding="utf-8", errors="strict")
            except (UnicodeError, ValueError):
                return None
            try:
                relative_path = _validated_public_path(relative_path)
            except PrivateStaticConfigurationError:
                return None

        asset = self.assets.get(relative_path)
        if asset is None:
            return None
        try:
            if asset.file_path.resolve(strict=True) != asset.file_path:
                return None
            asset.file_path.relative_to(self.root)
        except (FileNotFoundError, OSError, RuntimeError, ValueError):
            return None
        if not asset.file_path.is_file():
            return None
        return asset

    def open_asset(
        self,
        asset: PrivateStaticAsset,
    ) -> tuple[BufferedReader, os.stat_result]:
        """Open an allowlisted file without following a swapped symlink."""
        try:
            relative_parts = asset.file_path.relative_to(self.root).parts
        except ValueError as exc:
            raise OSError("private asset left its declared root") from exc
        if not relative_parts:
            raise OSError("private asset path is empty")

        no_follow = getattr(os, "O_NOFOLLOW", 0)
        close_on_exec = getattr(os, "O_CLOEXEC", 0)
        non_blocking = getattr(os, "O_NONBLOCK", 0)
        directory_flags = os.O_RDONLY | os.O_DIRECTORY | no_follow | close_on_exec
        file_flags = os.O_RDONLY | no_follow | close_on_exec | non_blocking
        directory_fds: list[int] = []
        file_fd: int | None = None

        try:
            root_fd = os.open(self.root, directory_flags)
            directory_fds.append(root_fd)
            root_stat = os.fstat(root_fd)
            if (
                root_stat.st_dev != self.root_device
                or root_stat.st_ino != self.root_inode
            ):
                raise OSError("private site root changed after startup")

            current_fd = root_fd
            for part in relative_parts[:-1]:
                current_fd = os.open(part, directory_flags, dir_fd=current_fd)
                directory_fds.append(current_fd)

            file_fd = os.open(relative_parts[-1], file_flags, dir_fd=current_fd)
            file_stat = os.fstat(file_fd)
            if not stat_module.S_ISREG(file_stat.st_mode):
                raise OSError("private asset is not a regular file")

            source = os.fdopen(file_fd, "rb")
            file_fd = None
            return source, file_stat
        finally:
            if file_fd is not None:
                os.close(file_fd)
            for directory_fd in reversed(directory_fds):
                os.close(directory_fd)


@dataclass(frozen=True)
class PrivateStaticRegistry:
    sites: tuple[PrivateStaticSite, ...]

    @classmethod
    def empty(cls) -> PrivateStaticRegistry:
        return cls(())

    @classmethod
    def load(cls, sites_root: Path) -> PrivateStaticRegistry:
        if not sites_root.exists():
            return cls.empty()
        root = _strict_directory(sites_root)
        sites: list[PrivateStaticSite] = []
        routes: set[str] = set()
        try:
            children = sorted(root.iterdir(), key=lambda path: path.name)
        except OSError as exc:
            raise PrivateStaticConfigurationError("private sites root is unreadable") from exc
        for child in children:
            if child.name.startswith("."):
                continue
            if child.is_symlink():
                raise PrivateStaticConfigurationError("private site directory cannot be a symlink")
            if not child.is_dir() or not (child / MANIFEST_NAME).is_file():
                continue
            site = PrivateStaticSite.load(child)
            if site.route in routes:
                raise PrivateStaticConfigurationError(
                    f"duplicate private site route: {site.route}"
                )
            routes.add(site.route)
            sites.append(site)
        return cls(tuple(sites))

    def site_for_request(self, request_target: str) -> PrivateStaticSite | None:
        try:
            path = urlsplit(request_target).path
        except ValueError:
            return None
        for site in self.sites:
            if path == site.route or path.startswith(f"{site.route}/"):
                return site
        return None


def parse_single_range(value: str | None, size: int) -> ByteRange | None:
    if value is None:
        return None
    if size < 0:
        raise ValueError("file size cannot be negative")

    unit, separator, specification = value.strip().partition("=")
    if separator != "=" or unit.casefold() != "bytes":
        raise RangeNotSatisfiable("only byte ranges are supported")
    specification = specification.strip()
    if not specification or "," in specification:
        raise RangeNotSatisfiable("exactly one byte range is required")

    start_text, dash, end_text = specification.partition("-")
    if dash != "-" or not start_text and not end_text:
        raise RangeNotSatisfiable("byte range is incomplete")
    if size == 0:
        raise RangeNotSatisfiable("empty files have no satisfiable byte range")

    if not start_text:
        suffix_length = _range_integer(end_text)
        if suffix_length <= 0:
            raise RangeNotSatisfiable("suffix range must be positive")
        start = max(size - suffix_length, 0)
        return ByteRange(start=start, end=size - 1)

    start = _range_integer(start_text)
    if start >= size:
        raise RangeNotSatisfiable("byte range starts beyond the file")
    if not end_text:
        return ByteRange(start=start, end=size - 1)

    end = _range_integer(end_text)
    if end < start:
        raise RangeNotSatisfiable("byte range ends before it starts")
    return ByteRange(start=start, end=min(end, size - 1))


def copy_bounded(source, destination, *, start: int, length: int) -> None:
    source.seek(start)
    remaining = length
    while remaining:
        chunk = source.read(min(64 * 1024, remaining))
        if not chunk:
            raise OSError("private asset ended before the declared byte range")
        destination.write(chunk)
        remaining -= len(chunk)


def _strict_directory(path: Path) -> Path:
    declared = path.absolute()
    if path.is_symlink():
        raise PrivateStaticConfigurationError("private static root cannot be a symlink")
    try:
        resolved = path.resolve(strict=True)
    except (FileNotFoundError, OSError, RuntimeError) as exc:
        raise PrivateStaticConfigurationError("private static root is unavailable") from exc
    if declared != resolved or not resolved.is_dir():
        raise PrivateStaticConfigurationError(
            "private static root must be a real directory without symlinks"
        )
    return resolved


def _validated_route(value: object) -> str:
    if not isinstance(value, str) or not _ROUTE_PATTERN.fullmatch(value):
        raise PrivateStaticConfigurationError(
            "private site route must be one lowercase URL segment"
        )
    if value in _RESERVED_ROUTES:
        raise PrivateStaticConfigurationError("private site route conflicts with the portal")
    return value


def _validated_public_path(value: object) -> str:
    if not isinstance(value, str) or not _PUBLIC_PATH_PATTERN.fullmatch(value):
        raise PrivateStaticConfigurationError("private asset path is invalid")
    if "\\" in value or "\0" in value:
        raise PrivateStaticConfigurationError("private asset path is ambiguous")
    parts = value.split("/")
    if (
        not parts
        or any(part in {"", ".", ".."} or part.startswith(".") for part in parts)
    ):
        raise PrivateStaticConfigurationError("private asset path is unsafe")
    return value


def _resolved_asset_file(root: Path, value: object) -> Path:
    relative_path = _validated_public_path(value)
    candidate = root.joinpath(*PurePosixPath(relative_path).parts)
    try:
        resolved = candidate.resolve(strict=True)
        resolved.relative_to(root)
    except (FileNotFoundError, OSError, RuntimeError, ValueError) as exc:
        raise PrivateStaticConfigurationError(
            f"private asset file is unavailable: {relative_path}"
        ) from exc
    if resolved != candidate or not resolved.is_file():
        raise PrivateStaticConfigurationError(
            f"private asset file must be a real file without symlinks: {relative_path}"
        )
    return resolved


def _validated_download_name(value: object) -> str:
    if not isinstance(value, str) or not _DOWNLOAD_NAME_PATTERN.fullmatch(value):
        raise PrivateStaticConfigurationError("private download filename is invalid")
    if Path(value).name != value or "\r" in value or "\n" in value:
        raise PrivateStaticConfigurationError("private download filename is unsafe")
    return value


def _range_integer(value: str) -> int:
    if not value.isascii() or not value.isdigit():
        raise RangeNotSatisfiable("byte range bounds must be decimal integers")
    if len(value) > 20:
        raise RangeNotSatisfiable("byte range bound is too large")
    try:
        return int(value)
    except ValueError as exc:
        raise RangeNotSatisfiable("byte range bound is too large") from exc
