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
release_path="$release_root/releases/$release_sha"
current_link="$release_root/current"
database="$state_root/blog.sqlite3"
private_sites="$state_root/private-sites"
backup_directory="$state_root/backups"

if [[ ! $release_sha =~ ^[0-9a-f]{40}$ ]]; then
  echo "EXACT_MERGE_SHA must be a lowercase 40-character commit SHA" >&2
  exit 64
fi

git -C "$repository" cat-file -e "$release_sha^{commit}"
git -C "$repository" merge-base --is-ancestor "$release_sha" origin/main
if [[ ! -r $database || ! -d $private_sites ]]; then
  echo "portal database and private-sites state must be staged before promotion" >&2
  exit 1
fi

mkdir -p "$release_root/releases" "$backup_directory" "$(dirname "$unit_path")"
staging_path=$(mktemp -d "$release_root/releases/.stage-$release_sha.XXXXXX")
previous_target=""
activated=0

cleanup() {
  if [[ -d $staging_path ]]; then
    chmod -R u+w "$staging_path" 2>/dev/null || true
    rm -rf -- "$staging_path"
  fi
}

rollback() {
  if [[ $activated -eq 1 ]]; then
    if [[ -n $previous_target ]]; then
      ln -sfn "$previous_target" "$current_link.rollback"
      mv -Tf "$current_link.rollback" "$current_link"
      systemctl --user restart "$service_name"
      curl --fail --silent --show-error --max-time 5 http://127.0.0.1:4178/ >/dev/null
    else
      systemctl --user stop "$service_name" || true
      rm -f -- "$current_link"
    fi
  fi
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
if [[ -e $release_path ]]; then
  test "$(cat "$release_path/.release-sha")" = "$release_sha"
else
  mv "$staging_path" "$release_path"
  staging_path=""
fi

if [[ -L $current_link ]]; then
  previous_target=$(readlink -f "$current_link")
fi

install -m 0644 "$release_path/deploy/worldwidesam-portal.service" "$unit_path"
systemctl --user daemon-reload
ln -sfn "$release_path" "$current_link.next"
mv -Tf "$current_link.next" "$current_link"
activated=1
systemctl --user enable --now "$service_name"
systemctl --user restart "$service_name"

ready=0
for _attempt in $(seq 1 30); do
  if curl --fail --silent --show-error --max-time 5 http://127.0.0.1:4178/ >/dev/null; then
    ready=1
    break
  fi
  sleep 1
done
test "$ready" -eq 1

for route in / /blog/ /orbit/ /wonderlab/app.js /procon/; do
  curl --fail --silent --show-error --max-time 10 "http://127.0.0.1:4178$route" >/dev/null
done
test "$(readlink -f "$current_link")" = "$release_path"
test "$(cat "$current_link/.release-sha")" = "$release_sha"
test "$(curl --silent --output /dev/null --write-out '%{http_code}' --max-time 15 "$public_url")" = 302

activated=0
printf 'deployed and privately verified %s (previous: %s)\n' \
  "$release_sha" "${previous_target:-NONE}"
