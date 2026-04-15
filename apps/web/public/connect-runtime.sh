#!/usr/bin/env bash
# Connect this machine's Multica daemon to a self-hosted Multica deployment.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

HOST=""
BACKEND_PORT=""
FRONTEND_PORT=""
PROFILE=""
TOKEN=""
CALLBACK_URL="${MULTICA_CALLBACK_URL:-}"
MULTICA_BIN="${MULTICA_BIN:-}"
AUTO_INSTALL="${MULTICA_AUTO_INSTALL:-true}"
INSTALL_DIR="${MULTICA_INSTALL_DIR:-}"
INSTALL_VERSION="${MULTICA_VERSION:-}"
SCHEME="${MULTICA_SCHEME:-}"
DRY_RUN=false
SKIP_LOGIN=false
SKIP_START=false

BACKEND_PORTS="${MULTICA_BACKEND_PORTS:-22201 22001 443 8080 80}"
FRONTEND_PORTS="${MULTICA_FRONTEND_PORTS:-22202 22002 443 3000 80}"
GITHUB_REPO_API_URL="${MULTICA_GITHUB_REPO_API_URL:-https://api.github.com/repos/multica-ai/multica/releases/latest}"
GITHUB_RELEASES_URL="${MULTICA_GITHUB_RELEASES_URL:-https://github.com/multica-ai/multica/releases}"

usage() {
  cat <<'USAGE'
Usage:
  scripts/connect-runtime.sh <host-or-ip> [options]

Example:
  scripts/connect-runtime.sh 10.0.0.206
  scripts/connect-runtime.sh 10.0.0.206 --dry-run
  scripts/connect-runtime.sh 10.0.0.206 --backend-port 22201 --frontend-port 22202

Options:
  --backend-port <port>    Use a known backend port instead of probing.
  --frontend-port <port>   Use a known frontend port instead of probing.
  --backend-ports <list>   Probe a comma-separated backend port list.
  --frontend-ports <list>  Probe a comma-separated frontend port list.
  --profile <name>         Use a named Multica CLI profile.
  --token <token>          Log in with a personal access token.
  --callback-url <url>     Finish browser auth from the final callback URL or token.
  --multica-bin <path>     Path to the multica binary.
  --install-dir <path>     Install the CLI here when multica is missing.
  --version <version>      Install a specific CLI release version.
  --no-install             Do not auto-install the CLI when multica is missing.
  --scheme <http|https>    Force the URL scheme for probed ports.
  --skip-login             Configure URLs but do not run login.
  --skip-start             Configure/login but do not start the daemon.
  --dry-run                Print actions without changing config or starting daemon.
  -h, --help               Show this help.

Environment:
  MULTICA_BIN              Path to the multica binary.
  MULTICA_AUTO_INSTALL     Auto-install missing CLI. Defaults to true.
  MULTICA_INSTALL_DIR      CLI install directory. Defaults to ~/.local/bin.
  MULTICA_VERSION          CLI release version to install.
  MULTICA_CALLBACK_URL     Finish browser auth from the final callback URL or token.
  MULTICA_BACKEND_PORTS    Space-separated backend ports to probe.
  MULTICA_FRONTEND_PORTS   Space-separated frontend ports to probe.
  MULTICA_SCHEME           Force http or https.
USAGE
}

fail() {
  printf 'Error: %s\n' "$*" >&2
  exit 1
}

info() {
  printf '==> %s\n' "$*"
}

ok() {
  printf 'OK: %s\n' "$*"
}

comma_to_space() {
  printf '%s' "$1" | tr ',' ' '
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --backend-port)
      [ "$#" -ge 2 ] || fail "--backend-port requires a value"
      BACKEND_PORT="$2"
      shift 2
      ;;
    --frontend-port)
      [ "$#" -ge 2 ] || fail "--frontend-port requires a value"
      FRONTEND_PORT="$2"
      shift 2
      ;;
    --backend-ports)
      [ "$#" -ge 2 ] || fail "--backend-ports requires a value"
      BACKEND_PORTS="$(comma_to_space "$2")"
      shift 2
      ;;
    --frontend-ports)
      [ "$#" -ge 2 ] || fail "--frontend-ports requires a value"
      FRONTEND_PORTS="$(comma_to_space "$2")"
      shift 2
      ;;
    --profile)
      [ "$#" -ge 2 ] || fail "--profile requires a value"
      PROFILE="$2"
      shift 2
      ;;
    --token)
      [ "$#" -ge 2 ] || fail "--token requires a value"
      TOKEN="$2"
      shift 2
      ;;
    --callback-url)
      [ "$#" -ge 2 ] || fail "--callback-url requires a value"
      CALLBACK_URL="$2"
      shift 2
      ;;
    --multica-bin)
      [ "$#" -ge 2 ] || fail "--multica-bin requires a value"
      MULTICA_BIN="$2"
      shift 2
      ;;
    --install-dir)
      [ "$#" -ge 2 ] || fail "--install-dir requires a value"
      INSTALL_DIR="$2"
      shift 2
      ;;
    --version)
      [ "$#" -ge 2 ] || fail "--version requires a value"
      INSTALL_VERSION="$2"
      shift 2
      ;;
    --no-install)
      AUTO_INSTALL=false
      shift
      ;;
    --scheme)
      [ "$#" -ge 2 ] || fail "--scheme requires a value"
      SCHEME="$2"
      shift 2
      ;;
    --skip-login)
      SKIP_LOGIN=true
      shift
      ;;
    --skip-start)
      SKIP_START=true
      shift
      ;;
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    -*)
      fail "unknown option: $1"
      ;;
    *)
      if [ -n "$HOST" ]; then
        fail "only one host or IP can be provided"
      fi
      HOST="$1"
      shift
      ;;
  esac
done

[ -n "$HOST" ] || {
  usage
  exit 1
}

case "$SCHEME" in
  ""|http|https) ;;
  *) fail "--scheme must be http or https" ;;
esac

case "$AUTO_INSTALL" in
  true|false) ;;
  *) fail "MULTICA_AUTO_INSTALL must be true or false" ;;
esac

command -v curl >/dev/null 2>&1 || fail "curl is required"

prepend_path_dir() {
  local dir="$1"
  [ -d "$dir" ] || return 0
  case ":$PATH:" in
    *":$dir:"*) ;;
    *) export PATH="$dir:$PATH" ;;
  esac
}

add_common_agent_paths() {
  [ -n "${HOME:-}" ] || return
  prepend_path_dir "$HOME/.local/bin"
  prepend_path_dir "$HOME/.npm-global/bin"
  prepend_path_dir "$HOME/.bun/bin"
  prepend_path_dir "$HOME/.cargo/bin"
  prepend_path_dir "$HOME/.local/share/pnpm"

  local dir
  for dir in "$HOME"/.nvm/versions/node/*/bin; do
    if [ -d "$dir" ]; then
      prepend_path_dir "$dir"
    fi
  done
}

add_common_agent_paths

detect_platform() {
  local os
  case "$(uname -s)" in
    Darwin) os="darwin" ;;
    Linux) os="linux" ;;
    *) fail "unsupported operating system: $(uname -s). Multica supports macOS and Linux." ;;
  esac

  local arch
  arch="$(uname -m)"
  case "$arch" in
    x86_64) arch="amd64" ;;
    aarch64) arch="arm64" ;;
    arm64) arch="arm64" ;;
    *) fail "unsupported architecture: $arch" ;;
  esac

  printf '%s %s' "$os" "$arch"
}

latest_cli_version() {
  local latest
  latest="$(
    curl -fsSL "$GITHUB_REPO_API_URL" 2>/dev/null \
      | sed -n 's/.*"tag_name"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' \
      | head -n 1
  )" || true

  if [ -z "$latest" ]; then
    latest="$(
      curl -fsSI "$GITHUB_RELEASES_URL/latest" 2>/dev/null \
        | grep -i '^location:' \
        | sed 's/.*tag\///' \
        | tr -d '\r\n'
    )" || true
  fi

  [ -n "$latest" ] || return 1
  printf '%s' "$latest"
}

ensure_install_dir() {
  if [ -n "$INSTALL_DIR" ]; then
    printf '%s' "$INSTALL_DIR"
    return
  fi

  [ -n "${HOME:-}" ] || fail "HOME is not set; use --install-dir <path>"
  printf '%s/.local/bin' "$HOME"
}

add_install_dir_to_path_hint() {
  local dir="$1"
  local rc
  local line="export PATH=\"$dir:\$PATH\""

  case ":$PATH:" in
    *":$dir:"*) return ;;
  esac

  export PATH="$dir:$PATH"

  [ -n "${HOME:-}" ] || return
  for rc in "$HOME/.bashrc" "$HOME/.zshrc"; do
    if [ -f "$rc" ] && ! grep -qF "$dir" "$rc"; then
      printf '\n# Added by Multica runtime connection script\n%s\n' "$line" >>"$rc"
    fi
  done
}

install_multica_bin() {
  [ "$AUTO_INSTALL" = true ] || fail "multica binary not found. Install it first or pass --multica-bin <path>."

  if [ "$DRY_RUN" = true ]; then
    info "Multica CLI not found; dry run would install it" >&2
    printf 'multica'
    return
  fi

  command -v tar >/dev/null 2>&1 || fail "tar is required to install the Multica CLI"

  local platform
  platform="$(detect_platform)"
  local os="${platform%% *}"
  local arch="${platform##* }"
  local version="$INSTALL_VERSION"
  if [ -z "$version" ]; then
    if ! version="$(latest_cli_version)"; then
      fail "could not determine the latest Multica CLI release"
    fi
  fi

  local install_dir
  install_dir="$(ensure_install_dir)"
  mkdir -p "$install_dir"

  local asset="multica_${os}_${arch}.tar.gz"
  local url="$GITHUB_RELEASES_URL/download/${version}/${asset}"
  local tmp_dir
  tmp_dir="$(mktemp -d)"

  info "Multica CLI not found; installing $version for $os/$arch" >&2
  if ! curl -fsSL "$url" -o "$tmp_dir/$asset"; then
    rm -rf "$tmp_dir"
    fail "failed to download Multica CLI from $url"
  fi

  if ! tar -xzf "$tmp_dir/$asset" -C "$tmp_dir" multica; then
    rm -rf "$tmp_dir"
    fail "failed to extract Multica CLI"
  fi

  chmod +x "$tmp_dir/multica"
  mv -f "$tmp_dir/multica" "$install_dir/multica"
  rm -rf "$tmp_dir"

  add_install_dir_to_path_hint "$install_dir"
  printf '%s/multica' "$install_dir"
}

resolve_multica_bin() {
  if [ -n "$MULTICA_BIN" ]; then
    [ -x "$MULTICA_BIN" ] || fail "multica binary is not executable: $MULTICA_BIN"
    printf '%s' "$MULTICA_BIN"
    return
  fi

  if command -v multica >/dev/null 2>&1; then
    command -v multica
    return
  fi

  local repo_bin="$PROJECT_DIR/server/bin/multica"
  if [ -x "$repo_bin" ]; then
    printf '%s' "$repo_bin"
    return
  fi

  install_multica_bin
}

MULTICA_BIN="$(resolve_multica_bin)"

url_for_port() {
  local port="$1"
  local scheme="$SCHEME"
  if [ -z "$scheme" ]; then
    if [ "$port" = "443" ]; then
      scheme="https"
    else
      scheme="http"
    fi
  fi
  if [ "$scheme" = "https" ] && [ "$port" = "443" ]; then
    printf 'https://%s' "$HOST"
    return
  fi
  if [ "$scheme" = "http" ] && [ "$port" = "80" ]; then
    printf 'http://%s' "$HOST"
    return
  fi
  printf '%s://%s:%s' "$scheme" "$HOST" "$port"
}

curl_status() {
  local url="$1"
  local output_file="$2"
  curl -k -sS --connect-timeout 1 --max-time 2 -o "$output_file" -w '%{http_code}' "$url" 2>/dev/null || true
}

probe_backend_port() {
  local tmp
  tmp="$(mktemp)"

  local port
  for port in $BACKEND_PORTS; do
    local base
    base="$(url_for_port "$port")"
    local status
    status="$(curl_status "$base/health" "$tmp")"
    if [ "$status" = "200" ] && grep -q '"status"[[:space:]]*:[[:space:]]*"ok"' "$tmp"; then
      printf '%s' "$port"
      rm -f "$tmp"
      return 0
    fi

    status="$(curl_status "$base/api/me" "$tmp")"
    if [ "$status" = "401" ] && grep -qiE 'missing authorization|unauthorized|authorization header' "$tmp"; then
      printf '%s' "$port"
      rm -f "$tmp"
      return 0
    fi
  done

  rm -f "$tmp"
  return 1
}

probe_frontend_port() {
  local tmp
  tmp="$(mktemp)"

  local port
  for port in $FRONTEND_PORTS; do
    local base
    base="$(url_for_port "$port")"
    local status
    status="$(curl_status "$base/login" "$tmp")"
    case "$status" in
      200|301|302|307|308)
        if grep -qiE 'multica|__next|geist|login' "$tmp"; then
          printf '%s' "$port"
          rm -f "$tmp"
          return 0
        fi
        ;;
    esac
  done

  rm -f "$tmp"
  return 1
}

quote_cmd() {
  local item
  for item in "$@"; do
    printf '%q ' "$item"
  done
  printf '\n'
}

run_cmd() {
  if [ "$DRY_RUN" = true ]; then
    printf 'DRY RUN: '
    quote_cmd "$@"
    return 0
  fi
  "$@"
}

run_multica() {
  local args=("$MULTICA_BIN")
  if [ -n "$PROFILE" ]; then
    args+=("--profile" "$PROFILE")
  fi
  args+=("$@")
  run_cmd "${args[@]}"
}

require_python3() {
  command -v python3 >/dev/null 2>&1 || fail "python3 is required for --callback-url"
}

login_with_token() {
  local args=("$MULTICA_BIN")
  if [ -n "$PROFILE" ]; then
    args+=("--profile" "$PROFILE")
  fi
  args+=("login" "--token")

  if [ "$DRY_RUN" = true ]; then
    printf 'DRY RUN: printf <token> | '
    quote_cmd "${args[@]}"
    return 0
  fi

  printf '%s\n' "$TOKEN" | "${args[@]}"
}

extract_callback_jwt() {
  require_python3
  python3 - "$1" <<'PY'
import sys
from urllib.parse import parse_qs, urlparse

raw = sys.argv[1].strip()
params = parse_qs(urlparse(raw).query)
token = params.get("token", [""])[0]
if not token:
    params = parse_qs(raw.lstrip("?"))
    token = params.get("token", [""])[0]
if not token:
    candidate = raw.split("&", 1)[0].strip()
    if candidate.startswith("token="):
        candidate = candidate.split("=", 1)[1]
    token = candidate
if not token or "://" in token:
    raise SystemExit("missing token; paste the full callback URL or the token value after token=")
print(token)
PY
}

json_string() {
  require_python3
  python3 - "$1" <<'PY'
import json
import sys

print(json.dumps(sys.argv[1]))
PY
}

create_pat_from_jwt() {
  local jwt="$1"
  local tmp
  tmp="$(mktemp)"
  local host
  host="$(hostname 2>/dev/null || printf 'unknown')"
  local payload
  payload="{\"name\":$(json_string "CLI ($host)"),\"expires_in_days\":90}"
  local status
  status="$(
    curl -k -sS --connect-timeout 5 --max-time 15 \
      -o "$tmp" \
      -w '%{http_code}' \
      -X POST "$BACKEND_URL/api/tokens" \
      -H "Authorization: Bearer $jwt" \
      -H "Content-Type: application/json" \
      --data "$payload" 2>/dev/null || true
  )"
  if [ "$status" != "200" ] && [ "$status" != "201" ]; then
    local body
    body="$(cat "$tmp" 2>/dev/null || true)"
    rm -f "$tmp"
    fail "could not create CLI token from callback URL (HTTP $status): $body"
  fi

  python3 - "$tmp" <<'PY'
import json
import sys

with open(sys.argv[1], "r", encoding="utf-8") as f:
    data = json.load(f)
token = data.get("token", "")
if not token:
    raise SystemExit("token missing in /api/tokens response")
print(token)
PY
  rm -f "$tmp"
}

fetch_json_with_token() {
  local path="$1"
  local token="$2"
  local out_file="$3"
  local status
  status="$(
    curl -k -sS --connect-timeout 5 --max-time 15 \
      -o "$out_file" \
      -w '%{http_code}' \
      "$BACKEND_URL$path" \
      -H "Authorization: Bearer $token" 2>/dev/null || true
  )"
  if [ "$status" != "200" ]; then
    local body
    body="$(cat "$out_file" 2>/dev/null || true)"
    fail "request $path failed (HTTP $status): $body"
  fi
}

cli_config_path() {
  [ -n "${HOME:-}" ] || fail "HOME is not set"
  if [ -n "$PROFILE" ]; then
    printf '%s/.multica/profiles/%s/config.json' "$HOME" "$PROFILE"
  else
    printf '%s/.multica/config.json' "$HOME"
  fi
}

save_cli_config_from_pat() {
  require_python3
  local pat="$1"
  local me_file="$2"
  local workspaces_file="$3"
  local config_path
  config_path="$(cli_config_path)"

  python3 - "$config_path" "$BACKEND_URL" "$FRONTEND_URL" "$pat" "$me_file" "$workspaces_file" <<'PY'
import json
import os
import sys

config_path, server_url, app_url, token, me_path, workspaces_path = sys.argv[1:]
try:
    with open(config_path, "r", encoding="utf-8") as f:
        cfg = json.load(f)
except FileNotFoundError:
    cfg = {}

with open(workspaces_path, "r", encoding="utf-8") as f:
    workspaces = json.load(f)

watched = [
    {"id": ws["id"], "name": ws.get("name", "")}
    for ws in workspaces
    if isinstance(ws, dict) and ws.get("id")
]

cfg["server_url"] = server_url
cfg["app_url"] = app_url
cfg["token"] = token
cfg["watched_workspaces"] = watched
cfg["workspace_id"] = watched[0]["id"] if watched else ""

os.makedirs(os.path.dirname(config_path), exist_ok=True)
tmp_path = f"{config_path}.tmp"
with open(tmp_path, "w", encoding="utf-8") as f:
    json.dump(cfg, f, indent=2)
    f.write("\n")
os.chmod(tmp_path, 0o600)
os.replace(tmp_path, config_path)

with open(me_path, "r", encoding="utf-8") as f:
    me = json.load(f)
print(f"Authenticated as {me.get('name', 'unknown')} ({me.get('email', 'unknown')})")
print(f"Watching {len(watched)} workspace(s)")
PY
}

login_with_callback_url() {
  if [ "$DRY_RUN" = true ]; then
    printf 'DRY RUN: finish auth from callback URL\n'
    return 0
  fi

  local jwt
  jwt="$(extract_callback_jwt "$CALLBACK_URL")" || fail "invalid callback URL"

  local pat
  pat="$(create_pat_from_jwt "$jwt")"

  local me_file workspaces_file
  me_file="$(mktemp)"
  workspaces_file="$(mktemp)"
  fetch_json_with_token "/api/me" "$pat" "$me_file"
  fetch_json_with_token "/api/workspaces" "$pat" "$workspaces_file"
  save_cli_config_from_pat "$pat" "$me_file" "$workspaces_file"
  rm -f "$me_file" "$workspaces_file"
}

login_with_browser() {
  if run_multica login; then
    return 0
  fi

  cat >&2 <<EOF

Browser login did not finish.
If the browser ended on a /callback?token=... URL that would not open,
run this command again with:

  bash connect-runtime.sh $HOST --callback-url '<paste-the-full-callback-url-or-token-here>'

EOF
  return 1
}

if [ -z "$BACKEND_PORT" ]; then
  info "Probing backend on $HOST"
  BACKEND_PORT="$(probe_backend_port)" || fail "could not find backend. Try --backend-port <port>."
fi

if [ -z "$FRONTEND_PORT" ]; then
  info "Probing frontend on $HOST"
  FRONTEND_PORT="$(probe_frontend_port)" || fail "could not find frontend. Try --frontend-port <port>."
fi

BACKEND_URL="$(url_for_port "$BACKEND_PORT")"
FRONTEND_URL="$(url_for_port "$FRONTEND_PORT")"

ok "backend:  $BACKEND_URL"
ok "frontend: $FRONTEND_URL"
ok "multica:  $MULTICA_BIN"

info "Writing Multica CLI config"
run_multica config set app_url "$FRONTEND_URL"
run_multica config set server_url "$BACKEND_URL"

if [ "$SKIP_LOGIN" = false ]; then
  info "Authenticating"
  if [ -n "$CALLBACK_URL" ]; then
    login_with_callback_url
  elif [ -n "$TOKEN" ]; then
    login_with_token
  else
    login_with_browser
  fi
else
  info "Skipping login"
fi

if [ "$SKIP_START" = false ]; then
  info "Restarting daemon"
  run_multica daemon stop || true
  run_multica daemon start
  run_multica daemon status
else
  info "Skipping daemon start"
fi

ok "runtime connection flow finished"
