#!/usr/bin/env bash
# Private Postgres for the Schedule app. Runs as your user, stores its data under your home
# partition, listens on a unix socket only (no TCP), and never touches the system Postgres.
#
#   scripts/dev-db.sh init     create the cluster and the schedule_dev / schedule_test databases (once)
#   scripts/dev-db.sh start    start it
#   scripts/dev-db.sh stop     stop it
#   scripts/dev-db.sh status   show whether it is running
#   scripts/dev-db.sh psql [db]  open psql against it
#   scripts/dev-db.sh url      print the socket directory and port to put in connection strings
#
# Override with SCHEDULE_PGDATA (data directory) and SCHEDULE_PG_PORT.
set -euo pipefail

PGDATA="${SCHEDULE_PGDATA:-$HOME/pgdata/schedule-app}"
PORT="${SCHEDULE_PG_PORT:-5433}"
SOCK="$PGDATA/sock"

pg_opts() { echo "-c listen_addresses='' -c unix_socket_directories=$SOCK -c unix_socket_permissions=0700 -p $PORT"; }

case "${1:-}" in
  init)
    if [ -f "$PGDATA/PG_VERSION" ]; then echo "Cluster already exists at $PGDATA"; exit 0; fi
    mkdir -p "$PGDATA"
    chmod 700 "$PGDATA"
    initdb -D "$PGDATA" -U postgres --auth-local=trust -E UTF8 --locale=en_US.UTF-8 >/dev/null
    mkdir -p "$SOCK"
    pg_ctl -D "$PGDATA" -o "$(pg_opts)" -l "$PGDATA/server.log" -w start >/dev/null
    psql -h "$SOCK" -p "$PORT" -U postgres -d postgres -c "CREATE DATABASE schedule_dev" -c "CREATE DATABASE schedule_test"
    echo "Created cluster at $PGDATA (socket $SOCK, port $PORT)"
    ;;
  start)
    mkdir -p "$SOCK"
    pg_ctl -D "$PGDATA" -o "$(pg_opts)" -l "$PGDATA/server.log" -w start
    ;;
  stop)
    pg_ctl -D "$PGDATA" -m fast -w stop
    ;;
  status)
    pg_ctl -D "$PGDATA" status
    ;;
  psql)
    shift
    exec psql -h "$SOCK" -p "$PORT" -U postgres -d "${1:-postgres}"
    ;;
  url)
    echo "host=$SOCK port=$PORT"
    ;;
  *)
    echo "usage: $0 {init|start|stop|status|psql [db]|url}" >&2
    exit 1
    ;;
esac
