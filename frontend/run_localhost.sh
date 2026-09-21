#!/usr/bin/env bash
# Run the merchant dashboard locally. Sandbox Mode needs no backend.
set -euo pipefail
cd "$(dirname "$0")"

if ! command -v flutter >/dev/null 2>&1; then
  echo "Flutter is not on PATH. Install it, then re-run this script."
  echo "https://docs.flutter.dev/get-started/install"
  exit 1
fi

flutter pub get
echo
echo "Opening Chrome on http://127.0.0.1:8080"
echo "The app starts in SANDBOX (simulated data). LIVE needs the Node API on :4000."
echo
exec flutter run -d chrome --web-port 8080 --web-hostname 127.0.0.1
