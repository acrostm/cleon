#!/bin/bash

set -euo pipefail

echo "Starting Cleon build and notify system..."

IS_VERCEL="${VERCEL:-false}"

echo "Generating Prisma Client..."
pnpm exec prisma generate

sync_prisma_schema() {
  local mode="${CLEON_PRISMA_SCHEMA_SYNC:-push}"

  case "$mode" in
    push)
      echo "Syncing database schema with prisma db push..."
      pnpm exec prisma db push
      ;;
    migrate)
      echo "Applying database migrations with prisma migrate deploy..."
      pnpm exec prisma migrate deploy
      ;;
    skip)
      echo "Skipping database schema sync because CLEON_PRISMA_SCHEMA_SYNC=skip"
      ;;
    *)
      echo "Unsupported CLEON_PRISMA_SCHEMA_SYNC value: $mode"
      exit 1
      ;;
  esac
}

if [ "${VERCEL_ENV:-}" = "production" ]; then
  echo "Preparing production database schema..."
  sync_prisma_schema
elif [ "${VERCEL_ENV:-}" = "preview" ]; then
  if [ "${RUN_PRISMA_SYNC_ON_PREVIEW:-true}" = "true" ]; then
    echo "Preparing preview database schema..."
    sync_prisma_schema
  else
    echo "Skipping preview database schema sync"
  fi
else
  echo "Skipping database migrations for Vercel environment: ${VERCEL_ENV:-local}"
fi

echo "Building Next.js project..."
set +e
pnpm exec next build
BUILD_STATUS=$?
set -e

CURRENT_TIME=$(date +'%Y-%m-%d %H:%M:%S')
SERVER_IP="Vercel Cloud"

if [ "$IS_VERCEL" != "1" ] && [ "$IS_VERCEL" != "true" ]; then
  SERVER_IP=$(curl -s --connect-timeout 5 http://ip.sb || echo "Unknown Local")
fi

if [ $BUILD_STATUS -eq 0 ]; then
  echo "Build succeeded, sending success notification..."
  node scripts/send-build-notification.mjs "success" "$CURRENT_TIME" "$SERVER_IP" || echo "Warning: Success notification failed to send."
else
  echo "Build failed, sending failure notification..."
  node scripts/send-build-notification.mjs "failed" "$CURRENT_TIME" "$SERVER_IP" || echo "Warning: Failure notification failed to send."
fi

exit $BUILD_STATUS
