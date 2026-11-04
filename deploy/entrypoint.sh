#!/bin/sh
# Миграции идемпотентны: выполняются при каждом запуске, затем стартует сервер.
set -e
node scripts/migrate.mjs
exec node server.js
