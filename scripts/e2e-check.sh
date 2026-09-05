#!/usr/bin/env bash
# Walks a real booking through reserve -> price change -> pay -> approve -> door,
# and checks what each panel is allowed to see along the way.
set -euo pipefail

cd "$(dirname "$0")/.."
. scripts/_common.sh

CMS_JAR=$(mktemp)
DOOR_JAR=$(mktemp)
trap 'rm -f "$CMS_JAR" "$DOOR_JAR"' EXIT

EMAIL="e2e-$RANDOM@example.com"

# Prices are stored, so a previous run leaves them wherever it finished. Set a
# known baseline instead of assuming the defaults are still in place.
echo "== cms login + baseline prices"
cms_login "$CMS_JAR"
BASELINE=$(post /api/admin/prices '{"early":1249,"vip":1549}' -b "$CMS_JAR" -c "$CMS_JAR")
[ "$(echo "$BASELINE" | pick early)" = "1249" ] || fail "could not set prices ($(echo "$BASELINE" | pick error))"
echo "   standard=1249 vip=1549"

echo "== verify + reserve 2 standard + 1 vip"
TOKEN=$(verified_token "$EMAIL" '"early":2,"vip":1')
RES=$(post /api/passes/reserve "{\"name\":\"Check Runner\",\"email\":\"$EMAIL\",\"phone\":\"9876500000\",\"early\":2,\"vip\":1,\"verificationToken\":\"$TOKEN\"}")
REF=$(echo "$RES" | pick reference)
TOTAL=$(echo "$RES" | pick total)
echo "   ref=$REF total=$TOTAL"
echo "   upi=$(echo "$RES" | pick upiUri)"
[ "$TOTAL" = "4047" ] || fail "expected 2x1249 + 1549 = 4047, got $TOTAL"

echo "== raise prices in the cms"
PRICES=$(post /api/admin/prices '{"early":1500,"vip":2000}' -b "$CMS_JAR")
echo "   updatedHolds=$(echo "$PRICES" | pick updatedHolds) early=$(echo "$PRICES" | pick early) vip=$(echo "$PRICES" | pick vip)"
[ -n "$(echo "$PRICES" | pick upi.early.upiQr)" ] || fail "admin price editor got no UPI preview QR"

echo "== public catalog reflects the change"
echo "   $(curl -s "$BASE/api/passes/prices")"

echo "== the open hold follows the new price"
REFRESHED=$(post /api/passes/refresh-hold "{\"email\":\"$EMAIL\",\"reference\":\"$REF\",\"verificationToken\":\"$TOKEN\"}")
NEW_TOTAL=$(echo "$REFRESHED" | pick total)
echo "   total=$NEW_TOTAL"
echo "   upi=$(echo "$REFRESHED" | pick upiUri)"
[ "$NEW_TOTAL" = "5000" ] || fail "expected 2x1500 + 2000 = 5000 after reprice, got $NEW_TOTAL"

echo "== once a UTR is in, the amount stops moving"
post /api/passes/pay "{\"email\":\"$EMAIL\",\"reference\":\"$REF\",\"verificationToken\":\"$TOKEN\",\"utr\":\"419283749102\",\"proofName\":\"p.jpg\",\"proofMime\":\"image/jpeg\",\"proofData\":\"$(fake_jpeg)\"}" >/dev/null
post /api/admin/prices '{"early":9999,"vip":9999}' -b "$CMS_JAR" >/dev/null
FROZEN=$(post /api/passes/refresh-hold "{\"email\":\"$EMAIL\",\"reference\":\"$REF\",\"verificationToken\":\"$TOKEN\"}" | pick total)
echo "   total after proof + a price hike to 9999: $FROZEN"
[ "$FROZEN" = "5000" ] || fail "a hold with proof on it was repriced to $FROZEN"

echo "== approve, and check what the cms is handed"
ORDER_ID=$(order_field "$CMS_JAR" "$REF" id)
[ -n "$ORDER_ID" ] || fail "order missing from the CMS list"
APPROVED=$(post "/api/admin/orders/$ORDER_ID/approve" '{}' -b "$CMS_JAR")
echo "   status=$(echo "$APPROVED" | pick order.status) tickets=$(echo "$APPROVED" | pick order.tickets | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.parse(s).length))')"
[ -z "$(echo "$APPROVED" | pick order.qrToken)" ] || fail "the QR HMAC leaked into the CMS payload"
[ -z "$(echo "$APPROVED" | pick order.paymentProofData)" ] || fail "the proof blob leaked into the CMS payload"
echo "   no qrToken, no proof blob"

echo "== redis keeps the pass, not the screenshot"
curl -s "$REDIS/__dump" | node -e '
let s="";
process.stdin.on("data",d=>s+=d).on("end",()=>{
  const wrap = JSON.parse(s);
  const value = wrap.value;
  if (!value) { console.error("fake upstash never received a write"); process.exit(1) }
  if (value.includes("data:image/jpeg")) { console.error("payment proof is still inside the shared blob"); process.exit(1) }
  const db = JSON.parse(value);
  const order = Object.values(db.orders).find(o => o.id === process.argv[1]);
  if (!order) { console.error("approved order missing from redis"); process.exit(1) }
  if (order.paymentProofData) { console.error("order still carries paymentProofData"); process.exit(1) }
  if (!order.hasPaymentProof) { console.error("hasPaymentProof was not latched"); process.exit(1) }
  if (order.status !== "paid") { console.error("order status in redis is " + order.status); process.exit(1) }
  console.log("   blob has paid order, no jpeg");
})' "$ORDER_ID"
PROOF_KEY=$(node -e 'console.log(encodeURIComponent("utopia:proof:v1:"+process.argv[1]))' "$ORDER_ID")
PROOF_SRC=$(curl -s "$REDIS/get/$PROOF_KEY" | pick result)
echo "   proof key starts $(echo "$PROOF_SRC" | cut -c1-22)"
[ "${PROOF_SRC#data:image/jpeg}" != "$PROOF_SRC" ] || fail "screenshot was not stored on its own redis key"
CMS_PROOF=$(curl -s "$BASE/api/admin/orders/$ORDER_ID/proof" -b "$CMS_JAR" | pick src)
[ "${CMS_PROOF#data:image/jpeg}" != "$CMS_PROOF" ] || fail "CMS proof route could not read the screenshot"

echo "== double approve is refused"
echo "   $(post "/api/admin/orders/$ORDER_ID/approve" '{}' -b "$CMS_JAR" | pick error)"

echo "== object keys are not order ids"
for BAD in __proto__ constructor prototype; do
  echo "   $BAD -> $(post "/api/admin/orders/$BAD/approve" '{}' -b "$CMS_JAR" | pick error)"
done
POLLUTED=$(curl -s "$BASE/api/admin/orders" -b "$CMS_JAR" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{JSON.parse(s);console.log(String(({}).status ?? ({}).paidAt ?? "clean"))})')
echo "   Object.prototype after: $POLLUTED"
[ "$POLLUTED" = "clean" ] || fail "prototype was polluted: $POLLUTED"

echo "== door"
door_login "$DOOR_JAR"
CODES=$(order_field "$CMS_JAR" "$REF" tickets | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.parse(s).map(t=>t.passCode).join(" ")))')
echo "   door codes: $CODES"
set -- $CODES
FIRST=$1
echo "   code, first time:  $(post /api/door/scan "{\"payload\":\"$FIRST\"}" -b "$DOOR_JAR" | pick result)"
echo "   code, second time: $(post /api/door/scan "{\"payload\":\"$FIRST\"}" -b "$DOOR_JAR" | pick result)"
# Typing the reference should walk the group, one unused pass at a time.
echo "   reference, pass 2: $(post /api/door/scan "{\"payload\":\"$REF\"}" -b "$DOOR_JAR" | pick result)"
echo "   reference, pass 3: $(post /api/door/scan "{\"payload\":\"$REF\"}" -b "$DOOR_JAR" | pick result)"
echo "   reference, none left: $(post /api/door/scan "{\"payload\":\"$REF\"}" -b "$DOOR_JAR" | pick result)"
echo "   a forged payload: $(post /api/door/scan '{"payload":"UTP|000000|nope.000000.aaaaaaaaaaaaaaaaaaaaaa"}' -b "$DOOR_JAR" | pick result)"

echo "== each panel refuses the other's cookie"
echo "   cms cookie on the door:  $(post /api/door/scan "{\"payload\":\"$FIRST\"}" -b "$CMS_JAR" | pick error)"
echo "   door cookie on the cms:  $(curl -s "$BASE/api/admin/orders" -b "$DOOR_JAR" | pick error)"
echo "   no cookie on the proof:  $(curl -s "$BASE/api/admin/orders/$ORDER_ID/proof" | pick error)"

echo "== put the prices back"
post /api/admin/prices '{"early":1249,"vip":1549}' -b "$CMS_JAR" >/dev/null

echo
echo "ALL CHECKS PASSED"
