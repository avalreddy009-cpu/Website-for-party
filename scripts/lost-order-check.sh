#!/usr/bin/env bash
# Reproduces the door failure seen on 5 Sep: a real, correctly signed pass
# reported as NOT A PASS because its order was no longer in the database.
#
# Two separate faults produced that screen.
#
#   1. persistRemote SET the whole database as one blob, including payment
#      screenshots. A couple of those JPEGs exceeded Upstash's 1MB value
#      limit, the SET failed silently, and the door hydrated an old copy.
#      Proofs now live on their own keys, and a failed SET fails the request.
#   2. scanPass could not tell "signed by us but missing" from "not our QR", so
#      the door showed the same red NOT A PASS either way, and staff had no way
#      to know they were turning away someone who had paid.
#
# Fault 2 is what this covers. A signature over an order id that is not in the
# database is exactly what the door saw, without needing to destroy real data to
# get there.
set -euo pipefail

cd "$(dirname "$0")/.."
. scripts/_common.sh

CMS_JAR=$(mktemp)
DOOR_JAR=$(mktemp)
trap 'rm -f "$CMS_JAR" "$DOOR_JAR"' EXIT

EMAIL="lost-$RANDOM@example.com"

echo "== sell and approve a VIP pass"
TOKEN=$(verified_token "$EMAIL" '"vip":1')
REF=$(post /api/passes/reserve "{\"name\":\"Check Runner\",\"email\":\"$EMAIL\",\"phone\":\"9876500000\",\"vip\":1,\"verificationToken\":\"$TOKEN\"}" | pick reference)
[ -n "$REF" ] || fail "reserve failed — is UPI_VPA set on the server?"
post /api/passes/pay "{\"email\":\"$EMAIL\",\"reference\":\"$REF\",\"verificationToken\":\"$TOKEN\",\"utr\":\"419283749102\",\"proofName\":\"p.jpg\",\"proofMime\":\"image/jpeg\",\"proofData\":\"$(fake_jpeg)\"}" >/dev/null

cms_login "$CMS_JAR"
ORDER_ID=$(order_field "$CMS_JAR" "$REF" id)
[ -n "$ORDER_ID" ] || fail "order missing from the CMS list"
post "/api/admin/orders/$ORDER_ID/approve" '{}' -b "$CMS_JAR" >/dev/null
CODE=$(order_field "$CMS_JAR" "$REF" tickets | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.parse(s)[0].passCode))')
echo "   $REF approved, door code $CODE"

door_login "$DOOR_JAR"

echo "== the order exists: admits, then reports the repeat"
REAL="UTP|$CODE|$(pass_token "$ORDER_ID" "$CODE")"
echo "   $REAL"
FIRST=$(post /api/door/scan "{\"payload\":\"$REAL\"}" -b "$DOOR_JAR" | pick result)
AGAIN=$(post /api/door/scan "{\"payload\":\"$REAL\"}" -b "$DOOR_JAR" | pick result)
echo "   first=$FIRST  again=$AGAIN"
[ "$FIRST" = "admitted" ] || fail "expected admitted, got $FIRST"
[ "$AGAIN" = "already-in" ] || fail "expected already-in, got $AGAIN"

echo "== our signature over an order the database has lost"
GHOST=$(post /api/door/scan "{\"payload\":\"UTP|904417|$(pass_token 'Zq7xLmN0pQrS2tUv' '904417')\"}" -b "$DOOR_JAR")
RESULT=$(echo "$GHOST" | pick result)
echo "   result=$RESULT"
echo "   logged code=$(echo "$GHOST" | pick scan.passCode)"
[ "$RESULT" = "no-record" ] || fail "a pass we signed must report no-record, not invalid — got $RESULT"
[ "$(echo "$GHOST" | pick scan.passCode)" = "904417" ] || fail "the door code was not logged for reconciliation"

echo "== a signature we did not produce is still refused"
FORGED=$(post /api/door/scan '{"payload":"UTP|904417|Zq7xLmN0pQrS2tUv.904417.aaaaaaaaaaaaaaaaaaaaaa"}' -b "$DOOR_JAR" | pick result)
echo "   forged -> $FORGED"
[ "$FORGED" = "invalid" ] || fail "a bad signature must stay invalid, got $FORGED"

echo "== so is a bare code that matches nothing"
NOISE=$(post /api/door/scan '{"payload":"904417"}' -b "$DOOR_JAR" | pick result)
echo "   unknown 6-digit -> $NOISE"
[ "$NOISE" = "invalid" ] || fail "an unknown code must stay invalid, got $NOISE"

echo
echo "LOST ORDER CHECKS PASSED"
