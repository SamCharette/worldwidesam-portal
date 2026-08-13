#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 2 ]]; then
  echo "usage: $0 REPOSITORY EXACT_MERGE_SHA" >&2
  exit 64
fi

repository=$1
release_sha=$2
release_root=${WORLDWIDESAM_PORTAL_RELEASE_ROOT:-"$HOME/.local/lib/worldwidesam-portal"}
state_root=${WORLDWIDESAM_PORTAL_STATE_ROOT:-"$HOME/.local/share/worldwidesam-portal"}
unit_path=${WORLDWIDESAM_PORTAL_UNIT_PATH:-"$HOME/.config/systemd/user/worldwidesam-portal.service"}
service_name=${WORLDWIDESAM_PORTAL_SERVICE:-worldwidesam-portal.service}
public_url=${WORLDWIDESAM_PORTAL_PUBLIC_URL:-https://worldwidesam.net/}
readiness_attempts=${WORLDWIDESAM_PORTAL_READINESS_ATTEMPTS:-30}
readiness_interval=${WORLDWIDESAM_PORTAL_READINESS_INTERVAL:-1}
release_path="$release_root/releases/$release_sha"
current_link="$release_root/current"
database="$state_root/blog.sqlite3"
private_sites="$state_root/private-sites"
backup_directory="$state_root/backups"

if [[ ! $release_sha =~ ^[0-9a-f]{40}$ ]]; then
  echo "EXACT_MERGE_SHA must be a lowercase 40-character commit SHA" >&2
  exit 64
fi

git -C "$repository" fetch origin main
git -C "$repository" cat-file -e "$release_sha^{commit}"
git -C "$repository" merge-base --is-ancestor "$release_sha" origin/main
if [[ ! -r $database || ! -d $private_sites ]]; then
  echo "portal database and private-sites state must be staged before promotion" >&2
  exit 1
fi

mkdir -p "$release_root/releases" "$backup_directory" "$(dirname "$unit_path")"
if [[ -e $release_path ]]; then
  echo "release already exists; refusing to trust or overwrite it: $release_path" >&2
  exit 1
fi
staging_path=$(mktemp -d "$release_root/releases/.stage-$release_sha.XXXXXX")
previous_target=""
had_current=0
had_unit=0
was_active=0
was_enabled=0
mutation_started=0
unit_backup=$(mktemp "$release_root/.previous-unit.XXXXXX")

cleanup() {
  if [[ -d $staging_path ]]; then
    chmod -R u+w "$staging_path" 2>/dev/null || true
    rm -rf -- "$staging_path"
  fi
  rm -f -- "$unit_backup"
}

rollback() {
  if [[ $mutation_started -ne 1 ]]; then
    return
  fi

  systemctl --user disable --now "$service_name" >/dev/null 2>&1 || true
  if [[ $had_current -eq 1 ]]; then
    ln -sfn "$previous_target" "$current_link.rollback"
    mv -Tf "$current_link.rollback" "$current_link"
  else
    rm -f -- "$current_link"
  fi

  if [[ $had_unit -eq 1 ]]; then
    install -m 0644 "$unit_backup" "$unit_path"
  else
    rm -f -- "$unit_path"
  fi
  systemctl --user daemon-reload
  if [[ $was_enabled -eq 1 ]]; then
    systemctl --user enable "$service_name" >/dev/null
  fi
  if [[ $was_active -eq 1 ]]; then
    systemctl --user restart "$service_name"
    rollback_pid=$(systemctl --user show --property MainPID --value "$service_name")
    test -n "$rollback_pid"
    test "$(readlink -f "/proc/$rollback_pid/cwd")" = "$previous_target"
  else
    systemctl --user stop "$service_name" >/dev/null 2>&1 || true
  fi
}

verify_runtime() {
  systemctl --user is-active --quiet "$service_name" || return 1
  runtime_pid=$(systemctl --user show --property MainPID --value "$service_name")
  [[ $runtime_pid =~ ^[1-9][0-9]*$ ]] || return 1
  [[ $(readlink -f "/proc/$runtime_pid/cwd") == "$release_path" ]] || return 1
  mapfile -t listeners < <(ss -H -ltnp 'sport = :4178')
  [[ ${#listeners[@]} -eq 1 ]] || return 1
  [[ ${listeners[0]} == *"127.0.0.1:4178"* ]] || return 1
  [[ ${listeners[0]} == *"pid=$runtime_pid,"* ]] || return 1
}

trap 'rollback; cleanup' ERR INT TERM
trap cleanup EXIT

git -C "$repository" archive "$release_sha" | tar -x -C "$staging_path"
printf '%s\n' "$release_sha" > "$staging_path/.release-sha"
test "$(git -C "$repository" rev-parse "$release_sha^{commit}")" = "$release_sha"

(
  cd "$staging_path"
  python3 -m unittest discover -s tests
  node --test tests/test_*.mjs
)

python3 "$staging_path/deploy/backup_database.py" \
  "$database" "$backup_directory" "$release_sha"

chmod -R a-w "$staging_path"
mv "$staging_path" "$release_path"
staging_path=""

if [[ -L $current_link ]]; then
  had_current=1
  previous_target=$(readlink -f "$current_link")
fi
if [[ -f $unit_path ]]; then
  had_unit=1
  cp --preserve=mode,timestamps "$unit_path" "$unit_backup"
fi
if systemctl --user is-active --quiet "$service_name"; then
  was_active=1
fi
if systemctl --user is-enabled --quiet "$service_name"; then
  was_enabled=1
fi

mutation_started=1
install -m 0644 "$release_path/deploy/worldwidesam-portal.service" "$unit_path"
systemctl --user daemon-reload
ln -sfn "$release_path" "$current_link.next"
mv -Tf "$current_link.next" "$current_link"
systemctl --user enable "$service_name"
systemctl --user restart "$service_name"

ready=0
for _attempt in $(seq 1 "$readiness_attempts"); do
  if verify_runtime && curl --fail --silent --show-error --max-time 5 http://127.0.0.1:4178/ >/dev/null; then
    ready=1
    break
  fi
  sleep "$readiness_interval"
done
test "$ready" -eq 1

for route in / /blog/ /orbit/ /wonderlab/app.js /procon/; do
  curl --fail --silent --show-error --max-time 10 "http://127.0.0.1:4178$route" >/dev/null
done
test "$(readlink -f "$current_link")" = "$release_path"
test "$(cat "$current_link/.release-sha")" = "$release_sha"
test "$(curl --silent --output /dev/null --write-out '%{http_code}' --max-time 15 "$public_url")" = 302

mutation_started=0
printf 'deployed and privately verified %s (previous: %s)\n' \
  "$release_sha" "${previous_target:-NONE}"
