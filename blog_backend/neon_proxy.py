from __future__ import annotations

from dataclasses import dataclass
from http.client import HTTPConnection, HTTPException
from urllib.parse import urlparse


PUBLIC_PREFIX = "/neon-cycle-grid"
UPSTREAM_HOST = "127.0.0.1"
UPSTREAM_PORT = 4325
UPSTREAM_TIMEOUT_SECONDS = 5

_FORWARDED_RESPONSE_HEADERS = frozenset(
    {
        "allow",
        "cache-control",
        "content-length",
        "content-security-policy",
        "content-type",
        "cross-origin-resource-policy",
        "referrer-policy",
        "x-content-type-options",
    }
)


class NeonProxyUnavailable(RuntimeError):
    pass


@dataclass(frozen=True)
class NeonProxyResponse:
    status: int
    headers: tuple[tuple[str, str], ...]
    body: bytes

    @property
    def cache_control(self) -> str | None:
        return next(
            (value for name, value in self.headers if name.lower() == "cache-control"),
            None,
        )


def request_neon(
    raw_path: str,
    *,
    method: str,
    host: str = UPSTREAM_HOST,
    port: int = UPSTREAM_PORT,
    timeout: float = UPSTREAM_TIMEOUT_SECONDS,
) -> NeonProxyResponse:
    if method not in {"GET", "HEAD"}:
        raise ValueError("Neon Cycle Grid proxy only supports GET and HEAD")
    parsed = urlparse(raw_path)
    if not parsed.path.startswith(f"{PUBLIC_PREFIX}/"):
        raise ValueError("path is outside the Neon Cycle Grid proxy")

    upstream_path = parsed.path.removeprefix(PUBLIC_PREFIX) or "/"
    if parsed.query:
        upstream_path = f"{upstream_path}?{parsed.query}"

    connection = HTTPConnection(host, port, timeout=timeout)
    try:
        connection.request(method, upstream_path, headers={"Connection": "close"})
        response = connection.getresponse()
        headers = tuple(
            (name, value)
            for name, value in response.getheaders()
            if name.lower() in _FORWARDED_RESPONSE_HEADERS
        )
        return NeonProxyResponse(response.status, headers, response.read())
    except (HTTPException, OSError, TimeoutError) as exc:
        raise NeonProxyUnavailable("Neon Cycle Grid service is unavailable") from exc
    finally:
        connection.close()
