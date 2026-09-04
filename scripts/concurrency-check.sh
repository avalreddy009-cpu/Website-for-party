#!/usr/bin/env bash
# Proves the store survives a second instance writing a stale snapshot over ours.
#
# persistRemote writes the whole database as one blob, so an instance that
# hydrated before a door scan and wrote afterwards used to erase the entry and
# let the same QR in twice.
set -euo pipefail

cd "$(dirname "$0")/.."
. scripts/_common.sh

CMS_JAR=$(mktemp)
DOOR_JAR=$(mktemp)
trap 'rm -f "$CMS_JAR" "$DOOR_JAR" /tmp/stale-db.json' EXIT

EMAIL="race-$RANDOM@example.com"

echo "== book and approve one order"
TOKEN=$(verified_token "$EMAIL" '"early":2')
REF=$(post /api/passes/reserve "{\"name\":\"Check Runner\",\"email\":\"$EMAIL\",\"phone\":\"9876500000\",\"early\":2,\"verificationToken\":\"$TOKEN\"}" | pick reference)
[ -n "$REF" ] || fail "reserve failed — is UPI_VPA set on the server?"
post /api/passes/pay "{\"email\":\"$EMAIL\",\"reference\":\"$REF\",\"verificationToken\":\"$TOKEN\",\"utr\":\"419283749102\",\"proofName\":\"p.jpg\",\"proofMime\":\"image/jpeg\",\"proofData\":\"$(fake_jpeg)\"}" >/dev/null

cms_login "$CMS_JAR"
ORDER_ID=$(order_field "$CMS_JAR" "$REF" id)
[ -n "$ORDER_ID" ] || fail "order missing from the CMS list"
post "/api/admin/orders/$ORDER_ID/approve" '{}' -b "$CMS_JAR" >/dev/null
echo "   ref=$REF"

echo "== snapshot redis while nobody is inside (this is the stale copy)"
curl -s "$REDIS/__dump" | node -e '
let s="";
process.stdin.on("data",d=>s+=d).on("end",()=>{
  const value = JSON.parse(s).value;
  if (!value) { console.error("fake upstash never received a write — is the server pointed at it?"); process.exit(1) }
  const db = JSON.parse(value);
  const order = Object.values(db.orders).find(o => o.reference === process.argv[1]);
  if (!order) { console.error("order is not in the blob yet"); process.exit(1) }
  const entered = (order.tickets || []).filter(t => t.enteredAt).length;
  if (entered !== 0) { console.error(`stale snapshot already has ${entered} entries`); process.exit(1) }
  require("fs").writeFileSync("/tmp/stale-db.json", JSON.stringify(db));
})' "$REF"

echo "== door admits the first pass"
door_login "$DOOR_JAR"
FIRST=$(order_field "$CMS_JAR" "$REF" tickets | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.parse(s)[0].passCode))')
R1=$(post /api/door/scan "{\"payload\":\"$FIRST\"}" -b "$DOOR_JAR" | pick result)
echo "   scan 1: $R1"
[ "$R1" = "admitted" ] || fail "first scan should be admitted, got $R1"

echo "== a second instance writes its pre-scan snapshot over ours"
curl -s -X POST "$REDIS/__set" -H 'content-type: text/plain' --data-binary @/tmp/stale-db.json >/dev/null

echo "== same QR again — must not get back in"
R2=$(post /api/door/scan "{\"payload\":\"$FIRST\"}" -b "$DOOR_JAR" | pick result)
echo "   scan 2: $R2"
[ "$R2" = "already-in" ] || fail "stale snapshot let the same pass in again (result=$R2)"

echo "== and the payment proof survived the clobber too"
HAS_PROOF=$(order_field "$CMS_JAR" "$REF" hasPaymentProof)
echo "   hasPaymentProof=$HAS_PROOF"
[ "$HAS_PROOF" = "true" ] || fail "payment proof was lost in the merge"

echo
echo "CONCURRENCY CHECKS PASSED"
