#!/bin/sh
set -e
mkdir -p /app/data/uploads
if [ "$(id -u)" = "0" ]; then
  uid=$(stat -c '%u' /app/data)
  gid=$(stat -c '%g' /app/data)
  # The bind-mounted data directory keeps the host owner, so SQLite files stay writable outside Docker.
  if [ "$uid" != "0" ]; then
    exec setpriv --reuid="$uid" --regid="$gid" --clear-groups "$@"
  fi
fi
exec "$@"
