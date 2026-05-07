#!/bin/bash

set -euo pipefail

echo "Starting Cleon build and notify system..."

IS_VERCEL="${VERCEL:-false}"

echo "Generating Prisma Client..."
pnpm exec prisma generate

if [ "${VERCEL_ENV:-}" = "production" ]; then
  echo "Applying production database migrations..."
  pnpm exec prisma migrate deploy
elif [ "${RUN_PRISMA_MIGRATE_ON_PREVIEW:-false}" = "true" ]; then
  echo "Applying preview database migrations..."
  pnpm exec prisma migrate deploy
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
