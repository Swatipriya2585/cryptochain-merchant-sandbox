#!/usr/bin/env bash
# Run the merchant dashboard locally. Sandbox Mode needs no backend.
set -euo pipefail
cd "$(dirname "$0")"
PORT="${PORT:-8080}"
HOST="${HOST:-127.0.0.1}"
export PORT HOST

die() { echo "$1" >&2; exit 1; }

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  cat <<EOF
Usage: $0 [--dev|--rebuild]

  (default)  Serve the release web build at http://${HOST}:${PORT}
             Builds once if build/web is missing or stale.
  --rebuild  Force flutter build web --release, then serve.
  --dev      flutter run with hot reload (Chrome if available).

Sandbox is the default. Do not start Postgres or the Node API.
EOF
  exit 0
fi

need_flutter() {
  command -v flutter >/dev/null 2>&1 || die "Flutter is not on PATH. https://docs.flutter.dev/get-started/install"
}

if [[ "${1:-}" == "--dev" ]]; then
  need_flutter
  flutter pub get
  DEVICE="web-server"
  if flutter devices 2>/dev/null | grep -Eqi 'chrome[[:space:]]'; then
    DEVICE="chrome"
  fi
  echo
  echo "Opening http://${HOST}:${PORT} in SANDBOX (simulated data, no backend)."
  echo "LIVE needs the Node API on :4000 — stay on the orange SANDBOX pill."
  echo
  exec flutter run -d "$DEVICE" --web-port "$PORT" --web-hostname "$HOST"
fi

web_index="build/web/index.html"
need_build=0
if [[ "${1:-}" == "--rebuild" || ! -f "$web_index" ]]; then
  need_build=1
elif [[ -d lib ]]; then
  if find lib web pubspec.yaml -type f \( -name '*.dart' -o -name '*.yaml' -o -name '*.html' \) -newer "$web_index" | grep -q .; then
    need_build=1
  fi
fi

if [[ "$need_build" -eq 1 ]]; then
  need_flutter
  flutter pub get
  flutter build web --release --base-href /
fi

[[ -f "$web_index" ]] || die "No web build at $web_index"

if command -v python3 >/dev/null 2>&1; then
  echo
  echo "SANDBOX dashboard: http://${HOST}:${PORT}/"
  echo "No backend required. If a browser tab still shows LIVE, click SANDBOX."
  echo
  exec python3 ./serve_web.py
fi

die "python3 is required to serve the web build."
