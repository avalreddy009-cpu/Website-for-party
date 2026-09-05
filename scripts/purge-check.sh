#!/usr/bin/env bash
# Paid passes used to come back after a delete: mergeRemote only unions
# orders, so a CMS lambda that still had the row in memory wrote it back
# over Redis. Purge writes a tombstone on its own key; a stale blob must
# not resurrect the pass on CMS or at the door.
set -euo pipefail

cd "$(dirname "$0")/.."
. scripts/_common.sh

CMS_JAR=$(mktemp)
DOOR_JAR=$(mktemp)
trap 'rm -f "$CMS_JAR" "$DOOR_JAR" /tmp/pre-purge-db.json' EXIT

EMAIL="purge-$RANDOM@example.com"

echo "== book, pay, approve"
TOKEN=$(verified_token "$EMAIL" '"early":1')
REF=$(post /api/passes/reserve "{\"name\":\"Check Runner\",\"email\":\"$EMAIL\",\"phone\":\"9876500000\",\"early\":1,\"verificationToken\":\"$TOKEN\"}" | pick reference)
[ -n "$REF" ] || fail "reserve failed — is UPI_VPA set on the server?"
post /api/passes/pay "{\"email\":\"$EMAIL\",\"reference\":\"$REF\",\"verificationToken\":\"$TOKEN\",\"utr\":\"419283749102\",\"proofName\":\"p.jpg\",\"proofMime\":\"image/jpeg\",\"proofData\":\"$(fake_jpeg)\"}" >/dev/null

cms_login "$CMS_JAR"
ORDER_ID=$(order_field "$CMS_JAR" "$REF" id)
[ -n "$ORDER_ID" ] || fail "order missing from the CMS list"
post "/api/admin/orders/$ORDER_ID/approve" '{}' -b "$CMS_JAR" >/dev/null
CODE=$(order_field "$CMS_JAR" "$REF" tickets | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.parse(s)[0].passCode))')
echo "   $REF approved, door code $CODE"

door_login "$DOOR_JAR"
IN=$(post /api/door/scan "{\"payload\":\"$CODE\"}" -b "$DOOR_JAR" | pick result)
echo "   first scan: $IN"
[ "$IN" = "admitted" ] || fail "expected admitted, got $IN"

echo "== snapshot redis while the pass is live (stale copy)"
curl -s "$REDIS/__dump" | node -e '
let s="";
process.stdin.on("data",d=>s+=d).on("end",()=>{
  const value = JSON.parse(s).value;
  if (!value) { console.error("fake upstash never received a write"); process.exit(1) }
  const db = JSON.parse(value);
  const order = Object.values(db.orders).find(o => o.reference === process.argv[1]);
  if (!order) { console.error("order is not in the blob yet"); process.exit(1) }
  require("fs").writeFileSync("/tmp/pre-purge-db.json", JSON.stringify(db));
})' "$REF"

echo "== cms removes the paid pass"
PURGED=$(post "/api/admin/orders/$ORDER_ID/purge" '{}' -b "$CMS_JAR")
echo "   ok=$(echo "$PURGED" | pick ok) reference=$(echo "$PURGED" | pick reference)"
[ "$(echo "$PURGED" | pick ok)" = "true" ] || fail "purge failed ($(echo "$PURGED" | pick error))"
GONE=$(order_field "$CMS_JAR" "$REF" id)
echo "   cms list: $GONE"
[ "$GONE" = "MISSING" ] || fail "purged order still on the cms list ($GONE)"

echo "== door no longer has it"
BARE=$(post /api/door/scan "{\"payload\":\"$CODE\"}" -b "$DOOR_JAR" | pick result)
SIGNED=$(post /api/door/scan "{\"payload\":\"UTP|$CODE|$(pass_token "$ORDER_ID" "$CODE")\"}" -b "$DOOR_JAR" | pick result)
echo "   6-digit=$BARE  signed=$SIGNED"
[ "$BARE" = "invalid" ] || fail "purged 6-digit should be invalid, got $BARE"
[ "$SIGNED" = "no-record" ] || fail "purged signed QR should be no-record, got $SIGNED"

echo "== redis dropped the row and the screenshot, kept a tombstone"
curl -s "$REDIS/__dump" | node -e '
let s="";
process.stdin.on("data",d=>s+=d).on("end",()=>{
  const db = JSON.parse(JSON.parse(s).value);
  const order = Object.values(db.orders || {}).find(o => o.id === process.argv[1] || o.reference === process.argv[2]);
  if (order) { console.error("order still in the blob"); process.exit(1) }
  const scans = (db.scans || []).filter(x => x.orderId === process.argv[1] || x.reference === process.argv[2]);
  if (scans.length) { console.error("scan log still has " + scans.length + " rows"); process.exit(1) }
  const tombs = (db.purgedOrders || []).filter(x => x.id === process.argv[1]);
  if (!tombs.length) { console.error("blob has no tombstone"); process.exit(1) }
  console.log("   blob has no order, tombstone present");
})' "$ORDER_ID" "$REF"
PROOF_KEY=$(node -e 'console.log(encodeURIComponent("utopia:proof:v1:"+process.argv[1]))' "$ORDER_ID")
PROOF_SRC=$(curl -s "$REDIS/get/$PROOF_KEY" | pick result)
[ -z "$PROOF_SRC" ] || fail "screenshot key is still set"
TOMB=$(curl -s "$REDIS/get/utopia%3Apurged%3Av1" | pick result)
echo "$TOMB" | node -e '
let s="";
process.stdin.on("data",d=>s+=d).on("end",()=>{
  const list = JSON.parse(s);
  if (!Array.isArray(list) || !list.some(x => x.id === process.argv[1])) {
    console.error("purged key missing id");
    process.exit(1);
  }
  console.log("   dedicated tombstone key has the id");
})' "$ORDER_ID"

echo "== a stale snapshot cannot bring it back"
curl -s -X POST "$REDIS/__set" -H 'content-type: text/plain' --data-binary @/tmp/pre-purge-db.json >/dev/null
STILL=$(order_field "$CMS_JAR" "$REF" id)
echo "   cms after stale write: $STILL"
[ "$STILL" = "MISSING" ] || fail "stale redis blob resurrected the pass on cms ($STILL)"
AGAIN=$(post /api/door/scan "{\"payload\":\"$CODE\"}" -b "$DOOR_JAR" | pick result)
echo "   door after stale write: $AGAIN"
[ "$AGAIN" = "invalid" ] || fail "stale redis blob resurrected the pass at the door ($AGAIN)"

echo "== saving prices still leaves it gone"
post /api/admin/prices '{"early":1249,"vip":1549}' -b "$CMS_JAR" >/dev/null
curl -s "$REDIS/__dump" | node -e '
let s="";
process.stdin.on("data",d=>s+=d).on("end",()=>{
  const db = JSON.parse(JSON.parse(s).value);
  const order = Object.values(db.orders || {}).find(o => o.id === process.argv[1]);
  if (order) { console.error("persist after stale write put the order back"); process.exit(1) }
  console.log("   persist kept the tombstone");
})' "$ORDER_ID"

echo
echo "PURGE CHECKS PASSED"
