#!/usr/bin/env bash
# Holds do not time out. An unpaid reservation stays pending until staff
# DROP HOLD, reject, or approve. Older deploys flipped the status after
# 30 minutes; hydrate must open those back up.
#
# Backdating goes through the Redis blob rather than .data/utopia.json, because
# the next hydrate merges the remote copy straight back over the local file.
set -euo pipefail

cd "$(dirname "$0")/.."
. scripts/_common.sh

CMS_JAR=$(mktemp)
trap 'rm -f "$CMS_JAR" /tmp/backdated-db.json' EXIT

EMAIL="stale-$RANDOM@example.com"

echo "== reserve a hold and walk away from it"
TOKEN=$(verified_token "$EMAIL" '"early":1')
REF=$(post /api/passes/reserve "{\"name\":\"Check Runner\",\"email\":\"$EMAIL\",\"phone\":\"9876500000\",\"early\":1,\"verificationToken\":\"$TOKEN\"}" | pick reference)
[ -n "$REF" ] || fail "reserve failed — is UPI_VPA set on the server?"

cms_login "$CMS_JAR"
BEFORE=$(order_field "$CMS_JAR" "$REF" status)
echo "   $REF is $BEFORE"
[ "$BEFORE" = "reserved" ] || fail "expected reserved, got $BEFORE"

echo "== backdate its window past the old 30-minute hold"
curl -s "$REDIS/__dump" | node -e '
let s="";
process.stdin.on("data",d=>s+=d).on("end",()=>{
  const value = JSON.parse(s).value;
  if (!value) { console.error("fake upstash is empty — is the server pointed at it?"); process.exit(1) }
  const db = JSON.parse(value);
  const order = Object.values(db.orders).find(o => o.reference === process.argv[1]);
  if (!order) { console.error("order is not in the blob yet"); process.exit(1) }
  order.holdExpiresAt = Date.now() - 60_000;
  order.status = "expired";
  require("fs").writeFileSync("/tmp/backdated-db.json", JSON.stringify(db));
})' "$REF"
curl -s -X POST "$REDIS/__set" -H 'content-type: text/plain' --data-binary @/tmp/backdated-db.json >/dev/null

echo "== the next request reopens it instead of leaving it expired"
curl -s "$BASE/api/passes/prices" >/dev/null
AFTER=$(order_field "$CMS_JAR" "$REF" status)
echo "   $REF is now $AFTER"
[ "$AFTER" = "reserved" ] || fail "timed-out hold should stay pending, got $AFTER"

echo "== refresh-hold still issues a QR"
REFRESH=$(post /api/passes/refresh-hold "{\"email\":\"$EMAIL\",\"reference\":\"$REF\",\"verificationToken\":\"$TOKEN\"}")
echo "   $(echo "$REFRESH" | pick error || true)"
echo "$REFRESH" | python3 -c 'import json,sys; d=json.load(sys.stdin); assert d.get("ok") is True, d'

echo "== paying still puts it in front of staff"
post /api/passes/pay "{\"email\":\"$EMAIL\",\"reference\":\"$REF\",\"verificationToken\":\"$TOKEN\",\"utr\":\"419283749102\",\"proofName\":\"p.jpg\",\"proofMime\":\"image/jpeg\",\"proofData\":\"$(fake_jpeg)\"}" >/dev/null
PAID=$(order_field "$CMS_JAR" "$REF" status)
echo "   $REF is $PAID"
[ "$PAID" = "reserved" ] || fail "payment should keep the hold pending, got $PAID"

echo
echo "HOLD EXPIRY CHECKS PASSED"
