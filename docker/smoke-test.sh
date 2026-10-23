#!/bin/sh
# Checks a running self-hosted stack end to end: the app is served, the API
# gateway answers, migrations ran, and a new user can create a workspace that
# only they can see. Needs ENABLE_EMAIL_AUTOCONFIRM=true (or a confirmed user).
#
# Usage: sh docker/smoke-test.sh [base-url] [env-file]
set -eu

base=${1:-http://localhost:3000}
env_file=${2:-docker/.env}
key=$(grep '^ANON_KEY=' "$env_file" | cut -d= -f2-)
stamp=$(date +%s)
token=

# Runs a check function; any failure stops the script with a non-zero exit.
check() {
  printf '%s… ' "$1"
  if "$2"; then echo ok; else echo FAILED; exit 1; fi
}

api() {
  path=$1
  shift
  curl -fsS "$base/rest/v1/$path" -H "apikey: $key" -H "authorization: Bearer $token" \
    -H 'content-type: application/json' "$@"
}

web_app() { curl -fsS "$base/healthz" > /dev/null && curl -fsS "$base/" | grep -q 'id="root"'; }
runtime_config() { curl -fsS "$base/config.json" | grep -q '"supabaseUrl"'; }
auth_health() { curl -fsS "$base/auth/v1/health" -H "apikey: $key" > /dev/null; }
sign_up() {
  token=$(curl -fsS -X POST "$base/auth/v1/signup" -H "apikey: $key" \
    -H 'content-type: application/json' \
    -d "{\"email\":\"smoke-$stamp@example.com\",\"password\":\"smoke-test-password\"}" |
    sed -n 's/.*"access_token":"\([^"]*\)".*/\1/p')
  [ -n "$token" ]
}
create_workspace() {
  api rpc/create_workspace -X POST -d "{\"name\":\"Smoke\",\"slug\":\"smoke-$stamp\"}" > /dev/null
}
sees_own_team() { [ "$(api 'teams?select=key')" = '[{"key":"GEN"}]' ]; }
anonymous_denied() {
  status=$(curl -sS -o /dev/null -w '%{http_code}' "$base/rest/v1/workspaces?select=id" -H "apikey: $key")
  [ "$status" = 401 ] || [ "$status" = 403 ]
}

check 'web app' web_app
check 'runtime config' runtime_config
check 'auth' auth_health
check 'sign up' sign_up
check 'create a workspace (RPC, migrations applied)' create_workspace
check 'row level security: a member sees their own team' sees_own_team
check 'anonymous visitors are refused' anonymous_denied
echo 'Self-hosted Daiquiri is working.'
