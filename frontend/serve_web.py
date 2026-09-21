#!/usr/bin/env python3
"""Serve the Flutter web release build. Sandbox Mode needs no backend."""
from __future__ import annotations

import os
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent / "build" / "web"
PORT = int(os.environ.get("PORT", "8080"))
HOST = os.environ.get("HOST", "127.0.0.1")


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def end_headers(self) -> None:
        path = self.path.split("?", 1)[0]
        if path in ("/", "/index.html") or path.endswith(".html"):
            self.send_header("Cache-Control", "no-store, max-age=0")
        super().end_headers()

    def log_message(self, fmt: str, *args) -> None:
        sys.stderr.write("%s - %s\n" % (self.address_string(), fmt % args))


def main() -> int:
    if not (ROOT / "index.html").is_file():
        print(
            f"No web build at {ROOT}. Run: flutter build web --release --base-href /",
            file=sys.stderr,
        )
        return 1
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    print(f"CryptoChain merchant dashboard (SANDBOX): http://{HOST}:{PORT}/")
    print("No Postgres or Node API required. Stay on the orange SANDBOX pill.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
