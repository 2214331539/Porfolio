#!/usr/bin/env bash

set -Eeuo pipefail

DEPLOY_BRANCH="${DEPLOY_BRANCH:-main}"
DEPLOY_REMOTE="${DEPLOY_REMOTE:-origin}"
DEPLOY_SERVICE="${DEPLOY_SERVICE:-portfolio-api.service}"
DEPLOY_HEALTH_URL="${DEPLOY_HEALTH_URL:-http://127.0.0.1:8000/api/health}"

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd -- "${SCRIPT_DIR}/.." && pwd)"
BACKEND_DIR="${APP_DIR}/backend"
FRONTEND_ENV_FILE="${APP_DIR}/frontend/.env.production"
BACKEND_ENV_FILE="${BACKEND_DIR}/.env"
LOCK_FILE="${TMPDIR:-/tmp}/portfolio-deploy.lock"

log() {
  printf '[portfolio-deploy] %s\n' "$*"
}

fail() {
  printf '[portfolio-deploy] ERROR: %s\n' "$*" >&2
  exit 1
}

on_error() {
  local exit_code=$?
  printf '[portfolio-deploy] ERROR: deployment failed at line %s (exit %s).\n' "${BASH_LINENO[0]}" "${exit_code}" >&2
  exit "${exit_code}"
}

run_as_root() {
  if [[ "${EUID}" -eq 0 ]]; then
    "$@"
  else
    command -v sudo >/dev/null 2>&1 || fail "sudo is required to restart ${DEPLOY_SERVICE}."
    sudo "$@"
  fi
}

trap on_error ERR

for command_name in git npm node uv curl flock systemctl; do
  command -v "${command_name}" >/dev/null 2>&1 || fail "missing required command: ${command_name}"
done

exec 9>"${LOCK_FILE}"
flock -n 9 || fail "another deployment is already running."

[[ -f "${BACKEND_ENV_FILE}" ]] || fail "missing ${BACKEND_ENV_FILE}; create the production backend env first."
[[ -f "${FRONTEND_ENV_FILE}" ]] || fail "missing ${FRONTEND_ENV_FILE}; create it with VITE_API_URL=/api."
grep -Eq '^[[:space:]]*VITE_API_URL=' "${FRONTEND_ENV_FILE}" || fail "VITE_API_URL is not configured in ${FRONTEND_ENV_FILE}."

cd "${APP_DIR}"
[[ -d .git ]] || fail "${APP_DIR} is not a Git working tree."

CURRENT_BRANCH="$(git branch --show-current)"
[[ "${CURRENT_BRANCH}" == "${DEPLOY_BRANCH}" ]] || fail "current branch is ${CURRENT_BRANCH:-detached}; expected ${DEPLOY_BRANCH}."

if ! git diff --quiet || ! git diff --cached --quiet; then
  fail "tracked files contain local changes; commit or restore them before deployment."
fi

BEFORE_COMMIT="$(git rev-parse --short HEAD)"
log "updating ${DEPLOY_REMOTE}/${DEPLOY_BRANCH} from ${BEFORE_COMMIT}"
git pull --ff-only "${DEPLOY_REMOTE}" "${DEPLOY_BRANCH}"
AFTER_COMMIT="$(git rev-parse --short HEAD)"

mkdir -p "${APP_DIR}/uploads"

log "installing frontend dependencies"
npm ci --no-audit --no-fund

log "building frontend with frontend/.env.production"
npm run build
[[ -f "${APP_DIR}/frontend/dist/index.html" ]] || fail "frontend build did not produce frontend/dist/index.html."

log "synchronizing backend dependencies"
cd "${BACKEND_DIR}"
uv sync --frozen

log "validating backend environment"
uv run python -c "from app.core.config import settings; assert settings.database_url and settings.secret_key and settings.admin_password"

log "applying database migrations"
uv run alembic upgrade head

log "ensuring first-install records exist"
uv run python -m app.db.seed

systemctl cat "${DEPLOY_SERVICE}" >/dev/null 2>&1 || fail "systemd service ${DEPLOY_SERVICE} is not installed."
log "restarting ${DEPLOY_SERVICE}"
run_as_root systemctl restart "${DEPLOY_SERVICE}"
run_as_root systemctl is-active --quiet "${DEPLOY_SERVICE}"

log "checking ${DEPLOY_HEALTH_URL}"
healthy=0
for _ in {1..15}; do
  if curl --fail --silent --show-error --max-time 3 "${DEPLOY_HEALTH_URL}" >/dev/null; then
    healthy=1
    break
  fi
  sleep 2
done
[[ "${healthy}" -eq 1 ]] || fail "health check failed; inspect journalctl -u ${DEPLOY_SERVICE}."

log "deployment complete: ${BEFORE_COMMIT} -> ${AFTER_COMMIT}"
