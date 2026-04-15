#!/usr/bin/env bash
# Regression test for the downloadable runtime connection script.

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SCRIPT_UNDER_TEST="$ROOT_DIR/apps/web/public/connect-runtime.sh"

tmp_dir="$(mktemp -d)"
cleanup() {
  rm -rf "$tmp_dir"
}
trap cleanup EXIT

fake_bin="$tmp_dir/bin"
home_dir="$tmp_dir/home"
install_dir="$home_dir/.local/bin"
log_file="$tmp_dir/multica.log"

mkdir -p "$fake_bin" "$home_dir"

cat >"$fake_bin/curl" <<'FAKE_CURL'
#!/usr/bin/env bash
set -euo pipefail

out_file=""
write_status=false
url=""
args=("$@")

for ((i = 0; i < ${#args[@]}; i++)); do
  case "${args[$i]}" in
    -o)
      out_file="${args[$((i + 1))]}"
      ;;
    -w)
      write_status=true
      ;;
    http://*|https://*)
      url="${args[$i]}"
      ;;
  esac
done

[ -n "$url" ] || {
  printf 'curl called without url: %s\n' "$*" >&2
  exit 22
}

case "$url" in
  https://api.github.com/repos/multica-ai/multica/releases/latest)
    printf '{"tag_name":"v9.9.9"}\n'
    ;;
  https://github.com/multica-ai/multica/releases/download/v9.9.9/*)
    : >"$out_file"
    ;;
  http://example.test:22201/health)
    printf '{"status":"ok"}\n' >"$out_file"
    [ "$write_status" = true ] && printf '200'
    ;;
  http://example.test:22202/login)
    printf '<html><body>Multica __next login</body></html>\n' >"$out_file"
    [ "$write_status" = true ] && printf '200'
    ;;
  http://example.test:22201/api/tokens)
    printf '{"token":"mul_pat_test"}\n' >"$out_file"
    [ "$write_status" = true ] && printf '201'
    ;;
  http://example.test:22201/api/me)
    printf '{"name":"Steve","email":"admin@local"}\n' >"$out_file"
    [ "$write_status" = true ] && printf '200'
    ;;
  http://example.test:22201/api/workspaces)
    printf '[{"id":"ws-1","name":"Local Dev"}]\n' >"$out_file"
    [ "$write_status" = true ] && printf '200'
    ;;
  https://api-proxy.test/api/me)
    printf '{"error":"missing authorization header"}\n' >"$out_file"
    [ "$write_status" = true ] && printf '401'
    ;;
  https://api-proxy.test/login)
    printf '<html><body>Multica __next login</body></html>\n' >"$out_file"
    [ "$write_status" = true ] && printf '200'
    ;;
  *)
    printf 'unexpected curl url: %s\n' "$url" >&2
    exit 22
    ;;
esac
FAKE_CURL

cat >"$fake_bin/tar" <<'FAKE_TAR'
#!/usr/bin/env bash
set -euo pipefail

extract_dir=""
while [ "$#" -gt 0 ]; do
  case "$1" in
    -C)
      extract_dir="$2"
      shift 2
      ;;
    *)
      shift
      ;;
  esac
done

[ -n "$extract_dir" ] || exit 2

cat >"$extract_dir/multica" <<'FAKE_MULTICA'
#!/usr/bin/env bash
printf '%s\n' "$*" >>"${MULTICA_FAKE_LOG:?}"
FAKE_MULTICA
chmod +x "$extract_dir/multica"
FAKE_TAR

cat >"$fake_bin/uname" <<'FAKE_UNAME'
#!/usr/bin/env bash
case "${1:-}" in
  -s) printf 'Linux\n' ;;
  -m) printf 'aarch64\n' ;;
  *) printf 'Linux\n' ;;
esac
FAKE_UNAME

chmod +x "$fake_bin/curl" "$fake_bin/tar" "$fake_bin/uname"

env \
  HOME="$home_dir" \
  PATH="$fake_bin:/usr/bin:/bin" \
  MULTICA_FAKE_LOG="$log_file" \
  "$SCRIPT_UNDER_TEST" example.test --skip-login --skip-start

test -x "$install_dir/multica"
grep -q '^config set app_url http://example.test:22202$' "$log_file"
grep -q '^config set server_url http://example.test:22201$' "$log_file"

proxy_output="$tmp_dir/api-proxy.out"
env \
  HOME="$home_dir" \
  PATH="$fake_bin:/usr/bin:/bin" \
  "$SCRIPT_UNDER_TEST" api-proxy.test --dry-run --skip-login --skip-start >"$proxy_output" 2>&1

grep -q 'OK: backend:  https://api-proxy.test$' "$proxy_output"
grep -q 'OK: frontend: https://api-proxy.test$' "$proxy_output"
grep -q 'config set server_url https://api-proxy.test' "$proxy_output"

callback_home="$tmp_dir/callback-home"
callback_log="$tmp_dir/callback-multica.log"
mkdir -p "$callback_home"

env \
  HOME="$callback_home" \
  PATH="$fake_bin:/usr/bin:/bin" \
  MULTICA_FAKE_LOG="$callback_log" \
  "$SCRIPT_UNDER_TEST" example.test --callback-url 'http://10.0.0.206:42167/callback?token=jwt-test&state=state-test' --skip-start

python3 - "$callback_home/.multica/config.json" <<'PY'
import json
import sys

with open(sys.argv[1], "r", encoding="utf-8") as f:
    cfg = json.load(f)

assert cfg["server_url"] == "http://example.test:22201"
assert cfg["app_url"] == "http://example.test:22202"
assert cfg["token"] == "mul_pat_test"
assert cfg["workspace_id"] == "ws-1"
assert cfg["watched_workspaces"] == [{"id": "ws-1", "name": "Local Dev"}]
PY

raw_callback_home="$tmp_dir/raw-callback-home"
raw_callback_log="$tmp_dir/raw-callback-multica.log"
mkdir -p "$raw_callback_home"

env \
  HOME="$raw_callback_home" \
  PATH="$fake_bin:/usr/bin:/bin" \
  MULTICA_FAKE_LOG="$raw_callback_log" \
  "$SCRIPT_UNDER_TEST" example.test --callback-url 'jwt-test&state=state-test' --skip-start

python3 - "$raw_callback_home/.multica/config.json" <<'PY'
import json
import sys

with open(sys.argv[1], "r", encoding="utf-8") as f:
    cfg = json.load(f)

assert cfg["token"] == "mul_pat_test"
assert cfg["workspace_id"] == "ws-1"
PY

printf 'connect-runtime regression test passed\n'
