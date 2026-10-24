#!/usr/bin/env bash
set -euo pipefail

release_dir="$(cd "$1" && pwd)"
app_root="${SLOTLOCK_ROOT:-$HOME/slotlock}"
shared_dir="$app_root/shared"
port="${SLOTLOCK_PORT:-3000}"
keep_releases="${SLOTLOCK_KEEP_RELEASES:-5}"
previous_release="$(readlink -f "$app_root/current" 2>/dev/null || true)"

export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
source "$NVM_DIR/nvm.sh"
export HUSKY=0 CHECKPOINT_DISABLE=1 NODE_ENV=production SLOTLOCK_ROOT="$app_root"

cd "$release_dir"
nvm install
nvm use

npm ci --omit=dev --workspace server --ignore-scripts
npm rebuild better-sqlite3

mkdir -p "$shared_dir/data" "$shared_dir/backups"
ln -sfn "$shared_dir/.env.production" "$release_dir/server/.env.production"

database_file="$shared_dir/data/slotlock.db"
if [ -f "$database_file" ]; then
  cp "$database_file" "$shared_dir/backups/slotlock-$(date +%Y%m%d-%H%M%S).db"
fi

(cd "$release_dir/server" && npx prisma migrate deploy)

ln -sfn "$release_dir" "$app_root/current"
pm2 startOrReload "$release_dir/deploy/ecosystem.config.cjs" --update-env
pm2 save

healthy=false
for attempt in $(seq 1 30); do
  if curl --silent --fail "http://127.0.0.1:$port/api/health" > /dev/null; then
    healthy=true
    break
  fi
  sleep 2
done

if [ "$healthy" != true ]; then
  echo "Health check failed after deployment of $release_dir" >&2
  if [ -n "$previous_release" ] && [ -d "$previous_release" ]; then
    ln -sfn "$previous_release" "$app_root/current"
    pm2 startOrReload "$previous_release/deploy/ecosystem.config.cjs" --update-env
    echo "Rolled back to $previous_release" >&2
  fi
  exit 1
fi

ls -1dt "$app_root"/releases/* | tail -n +"$((keep_releases + 1))" | xargs -r rm -rf
echo "Deployment of $release_dir is healthy"
