"""Shared browser origin checks for HTTP and WebSocket writes."""

from urllib.parse import urlsplit


def is_cross_site_write(method, origin, fetch_site, allowed_origins):
    """Decide whether a browser write comes from an untrusted site."""
    if method not in {"POST", "PUT", "PATCH", "DELETE"}:
        return False
    if origin is not None:
        if any((origin in allowed_origins, origin == "null", origin.startswith("file://"))):
            return False
        try:
            parsed = urlsplit(origin)
            host = parsed.hostname or ""
        except ValueError:
            return True
        loopback = host in {"localhost", "127.0.0.1", "::1"} or host.endswith(".localhost")
        return not (parsed.scheme in {"http", "https"} and loopback)
    return fetch_site == "cross-site"
