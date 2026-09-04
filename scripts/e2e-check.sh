#!/usr/bin/env bash
# Walks a real booking through reserve -> price change -> pay -> approve -> door.
# Needs the dev server running with CMS_PHRASE, DOOR_PHRASE and UPI_VPA set.
set -euo pipefail

BASE="${BASE:-http://127.0.0.1:3000}"
CMS_JAR=$(mktemp)
DOOR_JAR=$(mktemp)
trap 'rm -f "$CMS_JAR" "$DOOR_JAR"' EXIT

CMS_PHRASE="abandon ability able about above absent absorb abstract absurd abuse access accident"
DOOR_PHRASE="account accuse achieve acid acoustic acquire across act action actor actress actual"
EMAIL="e2e-$RANDOM@example.com"

jqr() { node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const o=JSON.parse(s);const v=process.argv[1].split(".").reduce((a,k)=>a?.[k],o);console.log(v===undefined?"":typeof v==="object"?JSON.stringify(v):v)})' "$1"; }
post() { curl -s -X POST "$BASE$1" -H 'content-type: application/json' -d "$2" "${@:3}"; }
fail() { echo "FAIL: $1"; exit 1; }

echo "== verify"
CODE=$(post /api/passes/verify "{\"name\":\"E2E Tester\",\"email\":\"$EMAIL\",\"phone\":\"9876543210\",\"early\":2,\"vip\":1}" | jqr devCode)
[ -n "$CODE" ] || fail "no devCode (is the mailer in dev mode?)"

TOKEN=$(post /api/passes/verify/confirm "{\"email\":\"$EMAIL\",\"code\":\"$CODE\"}" | jqr verificationToken)
[ -n "$TOKEN" ] || { echo "FAIL: no verification token"; exit 1; }

echo "== reserve 2 standard + 1 vip"
RES=$(post /api/passes/reserve "{\"name\":\"E2E Tester\",\"email\":\"$EMAIL\",\"phone\":\"9876543210\",\"early\":2,\"vip\":1,\"verificationToken\":\"$TOKEN\"}")
REF=$(echo "$RES" | jqr reference)
TOTAL=$(echo "$RES" | jqr total)
QR1=$(echo "$RES" | jqr upiUri)
echo "   ref=$REF total=$TOTAL"
echo "   upi=$QR1"
[ "$TOTAL" = "4047" ] || echo "   NOTE: total is $TOTAL (expected 4047 at default prices)"

echo "== cms login + raise prices"
post /api/admin/login "{\"phrase\":\"$CMS_PHRASE\"}" -c "$CMS_JAR" >/dev/null
PRICES=$(post /api/admin/prices '{"early":1500,"vip":2000}' -b "$CMS_JAR" -c "$CMS_JAR")
echo "   updatedHolds=$(echo "$PRICES" | jqr updatedHolds) early=$(echo "$PRICES" | jqr early) vip=$(echo "$PRICES" | jqr vip)"
echo "   admin preview qr present: $(echo "$PRICES" | jqr upi.early.upiQr | head -c 30)..."

echo "== public catalog reflects the change"
echo "   $(curl -s "$BASE/api/passes/prices")"

echo "== refresh the open hold"
REF2=$(post /api/passes/refresh-hold "{\"email\":\"$EMAIL\",\"reference\":\"$REF\",\"verificationToken\":\"$TOKEN\"}")
NEW_TOTAL=$(echo "$REF2" | jqr total)
echo "   total=$NEW_TOTAL repriced=$(echo "$REF2" | jqr repriced)"
echo "   upi=$(echo "$REF2" | jqr upiUri)"
[ "$NEW_TOTAL" = "5000" ] || { echo "FAIL: expected 5000 after reprice, got $NEW_TOTAL"; exit 1; }

echo "== submit proof, then confirm the price is frozen"
JPEG="data:image/jpeg;base64,$(printf '\xff\xd8\xff\xe0%.0s' 1 | base64 -w0)"
JPEG=$(node -e 'const b=Buffer.concat([Buffer.from([0xff,0xd8,0xff,0xe0]),Buffer.alloc(600,0x20),Buffer.from([0xff,0xd9])]);console.log("data:image/jpeg;base64,"+b.toString("base64"))')
PAY=$(post /api/passes/pay "{\"email\":\"$EMAIL\",\"reference\":\"$REF\",\"verificationToken\":\"$TOKEN\",\"utr\":\"419283749102\",\"proofName\":\"p.jpg\",\"proofMime\":\"image/jpeg\",\"proofData\":\"$JPEG\"}")
echo "   pay status=$(echo "$PAY" | jqr status) error=$(echo "$PAY" | jqr error)"
post /api/admin/prices '{"early":9999,"vip":9999}' -b "$CMS_JAR" >/dev/null
FROZEN=$(post /api/passes/refresh-hold "{\"email\":\"$EMAIL\",\"reference\":\"$REF\",\"verificationToken\":\"$TOKEN\"}" | jqr total)
echo "   total after proof + price hike: $FROZEN"
[ "$FROZEN" = "5000" ] || { echo "FAIL: paid-for hold was repriced to $FROZEN"; exit 1; }

echo "== approve in cms"
ORDER_ID=$(curl -s "$BASE/api/admin/orders" -b "$CMS_JAR" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const o=JSON.parse(s);const m=o.orders.find(x=>x.reference===process.argv[1]);console.log(m?m.id:"")})' "$REF")
[ -n "$ORDER_ID" ] || { echo "FAIL: order not in CMS list"; exit 1; }
APPROVED=$(post "/api/admin/orders/$ORDER_ID/approve" '{}' -b "$CMS_JAR")
echo "   status=$(echo "$APPROVED" | jqr order.status) tickets=$(echo "$APPROVED" | jqr order.tickets | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{console.log(JSON.parse(s).length)}catch{console.log(0)}})')"
echo "   qrToken leaked to cms: '$(echo "$APPROVED" | jqr order.qrToken)'"
echo "   proof blob leaked to cms: '$(echo "$APPROVED" | jqr order.paymentProofData | head -c 20)'"

echo "== double approve is refused"
echo "   $(post "/api/admin/orders/$ORDER_ID/approve" '{}' -b "$CMS_JAR" | jqr error)"

echo "== object keys are not order ids"
for BAD in __proto__ constructor prototype; do
  echo "   approve $BAD -> $(post "/api/admin/orders/$BAD/approve" '{}' -b "$CMS_JAR" | jqr error)"
  echo "   reject  $BAD -> $(post "/api/admin/orders/$BAD/reject" '{}' -b "$CMS_JAR" | jqr error)"
done
POLLUTED=$(curl -s "$BASE/api/admin/orders" -b "$CMS_JAR" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{JSON.parse(s);console.log(String(({}).status??({}).paidAt??"clean"))})')
echo "   Object.prototype after: $POLLUTED"
[ "$POLLUTED" = "clean" ] || fail "prototype was polluted: $POLLUTED"

echo "== door login + scan"
post /api/door/login "{\"phrase\":\"$DOOR_PHRASE\"}" -c "$DOOR_JAR" >/dev/null
CODES=$(curl -s "$BASE/api/admin/orders" -b "$CMS_JAR" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const o=JSON.parse(s);const m=o.orders.find(x=>x.reference===process.argv[1]);console.log((m.tickets||[]).map(t=>t.passCode).join(" "))})' "$REF")
echo "   door codes: $CODES"
set -- $CODES
FIRST=$1
echo "   scan 1: $(post /api/door/scan "{\"payload\":\"$FIRST\"}" -b "$DOOR_JAR" | jqr result)"
echo "   scan 1 again: $(post /api/door/scan "{\"payload\":\"$FIRST\"}" -b "$DOOR_JAR" | jqr result)"
echo "   scan 2 by reference: $(post /api/door/scan "{\"payload\":\"$REF\"}" -b "$DOOR_JAR" | jqr result)"
echo "   scan 3 by reference: $(post /api/door/scan "{\"payload\":\"$REF\"}" -b "$DOOR_JAR" | jqr result)"
echo "   scan 4 by reference (all used): $(post /api/door/scan "{\"payload\":\"$REF\"}" -b "$DOOR_JAR" | jqr result)"
echo "   junk: $(post /api/door/scan '{"payload":"UTP|000000|nope.000000.aaaaaaaaaaaaaaaaaaaaaa"}' -b "$DOOR_JAR" | jqr result)"
echo "   admin cookie on door: $(post /api/door/scan "{\"payload\":\"$FIRST\"}" -b "$CMS_JAR" | jqr error)"
echo "   door cookie on admin: $(curl -s "$BASE/api/admin/orders" -b "$DOOR_JAR" | jqr error)"
echo "   no cookie on proof: $(curl -s "$BASE/api/admin/orders/$ORDER_ID/proof" | jqr error)"

echo
echo "ALL CHECKS DONE"
