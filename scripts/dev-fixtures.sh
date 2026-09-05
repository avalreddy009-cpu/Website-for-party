#!/usr/bin/env bash
# Starts `next dev` with the throwaway values scripts/e2e-check.sh and
# scripts/concurrency-check.sh expect: staff phrases, a UPI id, and (unless
# NO_FAKE_REDIS is set) the local stand-in for Upstash so the multi-instance
# merge path is live.
#
#   node scripts/fake-upstash.mjs &     # only needed for concurrency-check.sh
#   ./scripts/dev-fixtures.sh
#
# None of these are the deployment's values. Production reads its own from the
# environment and refuses to fall back to anything in this repo.
set -euo pipefail

cd "$(dirname "$0")/.."

# Pinned, not inherited: the check scripts mint pass signatures themselves and
# have to use the same key the server verifies with. Leaving this to the ambient
# environment made a bad signature look like a pass, because the door fell
# through to matching the six-digit code instead.
export AUTH_SECRET="${CHECK_AUTH_SECRET:-utopia-check-fixture-secret}"

export CMS_PHRASE="${CMS_PHRASE:-abandon ability able about above absent absorb abstract absurd abuse access accident}"
export DOOR_PHRASE="${DOOR_PHRASE:-account accuse achieve acid acoustic acquire across act action actor actress actual}"
export UPI_VPA="${UPI_VPA:-avion@upi}"
export UPI_PAYEE_NAME="${UPI_PAYEE_NAME:-AVION Productions}"

if [ -z "${NO_FAKE_REDIS:-}" ]; then
  export UPSTASH_REDIS_REST_URL="${UPSTASH_REDIS_REST_URL:-http://127.0.0.1:8099}"
  export UPSTASH_REDIS_REST_TOKEN="${UPSTASH_REDIS_REST_TOKEN:-fake}"
fi

exec npm run dev -- --hostname "${HOST:-0.0.0.0}" --port "${PORT:-3000}"
