#!/usr/bin/env bash
# Proves the store survives a second instance writing a stale snapshot over ours.
#
# `persistRemote` writes the whole database as one blob, so an instance that
# hydrated before a door scan and wrote afterwards used to erase the entry and
# let the same QR in twice. Needs the dev server pointed at scripts/fake-upstash.mjs.
set -euo pipefail

BASE="${BASE:-http://127.0.0.1:3000}"
REDIS="${REDIS:-http://127.0.0.1:8099}"
CMS_JAR=$(mktemp)
DOOR_JAR=$(mktemp)
trap 'rm -f "$CMS_JAR" "$DOOR_JAR"' EXIT

CMS_PHRASE="abandon ability able about above absent absorb abstract absurd abuse access accident"
DOOR_PHRASE="account accuse achieve acid acoustic acquire across act action actor actress actual"
EMAIL="race-$RANDOM@example.com"

pick() { node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const o=JSON.parse(s);const v=process.argv[1].split(".").reduce((a,k)=>a?.[k],o);console.log(v===undefined?"":typeof v==="object"?JSON.stringify(v):v)})' "$1"; }
post() { curl -s -X POST "$BASE$1" -H 'content-type: application/json' -d "$2" "${@:3}"; }

fail() { echo "FAIL: $1"; exit 1; }

echo "== book and approve one order"
CODE=$(post /api/passes/verify "{\"name\":\"Race Tester\",\"email\":\"$EMAIL\",\"phone\":\"9876543210\",\"early\":2}" | pick devCode)
TOKEN=$(post /api/passes/verify/confirm "{\"email\":\"$EMAIL\",\"code\":\"$CODE\"}" | pick verificationToken)
REF=$(post /api/passes/reserve "{\"name\":\"Race Tester\",\"email\":\"$EMAIL\",\"phone\":\"9876543210\",\"early\":2,\"verificationToken\":\"$TOKEN\"}" | pick reference)
JPEG=$(node -e 'const b=Buffer.concat([Buffer.from([0xff,0xd8,0xff,0xe0]),Buffer.alloc(600,0x20),Buffer.from([0xff,0xd9])]);console.log("data:image/jpeg;base64,"+b.toString("base64"))')
post /api/passes/pay "{\"email\":\"$EMAIL\",\"reference\":\"$REF\",\"verificationToken\":\"$TOKEN\",\"utr\":\"419283749102\",\"proofName\":\"p.jpg\",\"proofMime\":\"image/jpeg\",\"proofData\":\"$JPEG\"}" >/dev/null

post /api/admin/login "{\"phrase\":\"$CMS_PHRASE\"}" -c "$CMS_JAR" >/dev/null
ORDER_ID=$(curl -s "$BASE/api/admin/orders" -b "$CMS_JAR" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const o=JSON.parse(s);const m=o.orders.find(x=>x.reference===process.argv[1]);console.log(m?m.id:"")})' "$REF")
[ -n "$ORDER_ID" ] || fail "order missing from CMS"
post "/api/admin/orders/$ORDER_ID/approve" '{}' -b "$CMS_JAR" >/dev/null
echo "   ref=$REF"

echo "== snapshot redis while nobody is inside (this is the stale copy)"
STALE=$(curl -s "$REDIS/__dump" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>process.stdout.write(JSON.parse(s).value??""))')
[ -n "$STALE" ] || fail "fake upstash never received a write — is the server pointed at it?"
echo "$STALE" > /tmp/stale-db.json
ENTERED=$(node -e 'const db=JSON.parse(require("fs").readFileSync("/tmp/stale-db.json","utf8"));const o=Object.values(db.orders).find(x=>x.reference===process.argv[1]);console.log((o.tickets||[]).filter(t=>t.enteredAt).length)' "$REF")
[ "$ENTERED" = "0" ] || fail "stale snapshot already has entries"

echo "== door admits the first pass"
post /api/door/login "{\"phrase\":\"$DOOR_PHRASE\"}" -c "$DOOR_JAR" >/dev/null
FIRST=$(curl -s "$BASE/api/admin/orders" -b "$CMS_JAR" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const o=JSON.parse(s);const m=o.orders.find(x=>x.reference===process.argv[1]);console.log(m.tickets[0].passCode)})' "$REF")
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
HAS_PROOF=$(curl -s "$BASE/api/admin/orders" -b "$CMS_JAR" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const o=JSON.parse(s);const m=o.orders.find(x=>x.reference===process.argv[1]);console.log(String(Boolean(m.hasPaymentProof)))})' "$REF")
echo "   hasPaymentProof=$HAS_PROOF"
[ "$HAS_PROOF" = "true" ] || fail "payment proof was lost in the merge"

echo
echo "CONCURRENCY CHECKS PASSED"
