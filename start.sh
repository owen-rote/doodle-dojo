#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend"

log() {
  printf '[start.sh] %s\n' "$1"
}

ensure_uv() {
  if command -v uv >/dev/null 2>&1; then
    return
  fi

  if ! command -v curl >/dev/null 2>&1; then
    log "ERROR: uv is missing and curl is not available to install it."
    exit 1
  fi

  log "uv not found. Installing uv..."
  curl -LsSf https://astral.sh/uv/install.sh | sh

  export PATH="$HOME/.local/bin:$HOME/.cargo/bin:$PATH"

  if ! command -v uv >/dev/null 2>&1; then
    log "ERROR: uv installation completed but uv is still not on PATH."
    exit 1
  fi
}

ensure_npm() {
  if command -v npm >/dev/null 2>&1; then
    return
  fi

  log "ERROR: npm is not installed. Add Node.js to the Railway image/environment."
  exit 1
}

install_backend_deps() {
  ensure_uv
  log "Syncing backend dependencies with uv..."
  (
    cd "$BACKEND_DIR"
    uv sync
  )
}

install_frontend_deps() {
  ensure_npm
  log "Installing frontend dependencies..."
  (
    cd "$FRONTEND_DIR"
    if [[ -f package-lock.json ]]; then
      npm ci
    else
      npm install
    fi
  )
}

resolve_frontend_mode() {
  if [[ -n "${FRONTEND_MODE:-}" ]]; then
    echo "$FRONTEND_MODE"
    return
  fi

  if [[ -n "${RAILWAY_ENVIRONMENT:-}" || "${NODE_ENV:-}" == "production" ]]; then
    echo "prod"
  else
    echo "dev"
  fi
}

cleanup() {
  local exit_code=$?
  trap - INT TERM EXIT

  if [[ -n "${BACKEND_PID:-}" ]] && kill -0 "$BACKEND_PID" 2>/dev/null; then
    kill "$BACKEND_PID" 2>/dev/null || true
  fi

  if [[ -n "${FRONTEND_PID:-}" ]] && kill -0 "$FRONTEND_PID" 2>/dev/null; then
    kill "$FRONTEND_PID" 2>/dev/null || true
  fi

  wait || true
  exit "$exit_code"
}

install_backend_deps
install_frontend_deps

FRONTEND_MODE="$(resolve_frontend_mode)"
log "Frontend mode: $FRONTEND_MODE"

trap cleanup INT TERM EXIT

(
  cd "$BACKEND_DIR"
  uv run uvicorn main:app --reload
) &
BACKEND_PID=$!

(
  cd "$FRONTEND_DIR"
  if [[ "$FRONTEND_MODE" == "prod" ]]; then
    npm run build
    npm run start
  else
    npm run dev
  fi
) &
FRONTEND_PID=$!

wait "$BACKEND_PID" "$FRONTEND_PID"
