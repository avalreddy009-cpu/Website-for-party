#!/usr/bin/env bash
# Two ways CMS "old data" used to vanish:
#
#   1. persistRemote SET the whole order book even when the preceding Redis GET
#      failed. Login/checkout OTP persist() on a cold lambda, so a blip wrote
#      { orders: {} } over live bookings.
#   2. snapshotDb() strips payment JPEGs from that blob. Proofs that were still
#      inline (older deploys) were not in dirtyProofs, so the next save dropped
#      every screenshot and CMS VIEW SCREENSHOT went dead.
#
# Start the server with scripts/dev-fixtures.sh first (fake Upstash on 8099).
set -euo pipefail

cd "$(dirname "$0")/.."
. scripts/_common.sh

CMS_JAR=$(mktemp)
trap 'rm -f "$CMS_JAR" /tmp/inline-proof-db.json; curl -s -X POST "$REDIS/__ok_gets" >/dev/null || true' EXIT

EMAIL="guard-$RANDOM@example.com"

echo "== book, pay, approve — a real row in redis"
TOKEN=$(verified_token "$EMAIL" '"vip":1')
REF=$(post /api/passes/reserve "{\"name\":\"Check Runner\",\"email\":\"$EMAIL\",\"phone\":\"9876500000\",\"vip\":1,\"verificationToken\":\"$TOKEN\"}" | pick reference)
[ -n "$REF" ] || fail "reserve failed — is UPI_VPA set on the server?"
post /api/passes/pay "{\"email\":\"$EMAIL\",\"reference\":\"$REF\",\"verificationToken\":\"$TOKEN\",\"utr\":\"419283749102\",\"proofName\":\"p.jpg\",\"proofMime\":\"image/jpeg\",\"proofData\":\"$(fake_jpeg)\"}" >/dev/null
cms_login "$CMS_JAR"
ORDER_ID=$(order_field "$CMS_JAR" "$REF" id)
[ -n "$ORDER_ID" ] || fail "order missing from the CMS list"
post "/api/admin/orders/$ORDER_ID/approve" '{}' -b "$CMS_JAR" >/dev/null
echo "   $REF approved"

echo "== redis read failure must not replace the order book"
curl -s -X POST "$REDIS/__fail_gets" >/dev/null
OTP=$(post /api/passes/verify "{\"name\":\"Check Runner\",\"email\":\"otp-$RANDOM@example.com\",\"phone\":\"9876500000\",\"vip\":1}")
echo "   otp during failed GET -> $(echo "$OTP" | pick error | cut -c1-80)"
[ "$(echo "$OTP" | pick error)" != "" ] || fail "OTP persist should fail closed when Redis cannot be read"
curl -s -X POST "$REDIS/__ok_gets" >/dev/null
STILL=$(curl -s "$BASE/api/admin/orders" -b "$CMS_JAR" | node -e '
let s="";
process.stdin.on("data",d=>s+=d).on("end",()=>{
  const o = JSON.parse(s);
  const hit = (o.orders || []).some(x => x.reference === process.argv[1]);
  console.log(hit ? "present" : "MISSING");
})' "$REF")
echo "   $REF after failed persist: $STILL"
[ "$STILL" = "present" ] || fail "a Redis read failure clobbered the CMS order book"

echo "== in-blob screenshots must move onto proof keys, not disappear"
PROOF_KEY=$(node -e 'console.log(encodeURIComponent("utopia:proof:v1:"+process.argv[1]))' "$ORDER_ID")
JPEG=$(fake_jpeg)
curl -s "$REDIS/__dump" | JPEG="$JPEG" ORDER_ID="$ORDER_ID" node -e '
let s="";
process.stdin.on("data",d=>s+=d).on("end",()=>{
  const wrap = JSON.parse(s);
  const db = JSON.parse(wrap.value);
  const order = db.orders[process.env.ORDER_ID];
  if (!order) { console.error("order missing"); process.exit(1) }
  order.paymentProofData = process.env.JPEG;
  order.hasPaymentProof = true;
  require("fs").writeFileSync("/tmp/inline-proof-db.json", JSON.stringify(db));
})'
curl -s -X POST "$REDIS/__set" -H 'content-type: text/plain' --data-binary @/tmp/inline-proof-db.json >/dev/null
curl -s -X POST "$REDIS/" -H 'content-type: application/json' -d "$(node -e 'console.log(JSON.stringify(["DEL","utopia:proof:v1:"+process.argv[1]]))' "$ORDER_ID")" >/dev/null
GONE=$(curl -s "$REDIS/get/$PROOF_KEY" | pick result)
[ -z "$GONE" ] || fail "setup: proof key should be empty before migrate"

# CMS list hydrates, sees inline JPEG, flushes it onto the proof key.
curl -s "$BASE/api/admin/orders" -b "$CMS_JAR" >/dev/null
PROOF_SRC=$(curl -s "$REDIS/get/$PROOF_KEY" | pick result)
echo "   migrated proof starts $(echo "$PROOF_SRC" | cut -c1-22)"
[ "${PROOF_SRC#data:image/jpeg}" != "$PROOF_SRC" ] || fail "inline screenshot was not copied onto its redis key"
curl -s "$REDIS/__dump" | node -e '
let s="";
process.stdin.on("data",d=>s+=d).on("end",()=>{
  const value = JSON.parse(s).value || "";
  if (value.includes("data:image/jpeg")) { console.error("jpeg still in the shared blob"); process.exit(1) }
  console.log("   blob has no jpeg");
})'
CMS_PROOF=$(curl -s "$BASE/api/admin/orders/$ORDER_ID/proof" -b "$CMS_JAR" | pick src)
[ "${CMS_PROOF#data:image/jpeg}" != "$CMS_PROOF" ] || fail "CMS could not open the migrated screenshot"

echo "== reject must outrank a still-pending redis copy"
REJECT_EMAIL="guard-rej-$RANDOM@example.com"
REJECT_TOKEN=$(verified_token "$REJECT_EMAIL" '"early":1')
REJECT_REF=$(post /api/passes/reserve "{\"name\":\"Check Runner\",\"email\":\"$REJECT_EMAIL\",\"phone\":\"9876500000\",\"early\":1,\"verificationToken\":\"$REJECT_TOKEN\"}" | pick reference)
post /api/passes/pay "{\"email\":\"$REJECT_EMAIL\",\"reference\":\"$REJECT_REF\",\"verificationToken\":\"$REJECT_TOKEN\",\"utr\":\"419283749102\",\"proofName\":\"p.jpg\",\"proofMime\":\"image/jpeg\",\"proofData\":\"$(fake_jpeg)\"}" >/dev/null
REJECT_ID=$(order_field "$CMS_JAR" "$REJECT_REF" id)
post "/api/admin/orders/$REJECT_ID/reject" '{"reason":"does not match"}' -b "$CMS_JAR" >/dev/null
# A later persist (price save) re-reads Redis, which still had reserved until
# reject flushed. If reserved outranks rejected, CMS snaps back to pending.
post /api/admin/prices '{"early":1249,"vip":1549}' -b "$CMS_JAR" >/dev/null
REJECT_STATUS=$(order_field "$CMS_JAR" "$REJECT_REF" status)
echo "   $REJECT_REF status=$REJECT_STATUS"
[ "$REJECT_STATUS" = "rejected" ] || fail "reject did not stick (status=$REJECT_STATUS)"

echo
echo "STORE GUARD CHECKS PASSED"
