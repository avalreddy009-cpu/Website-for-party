# Shared helpers for the check scripts. Source it, don't run it.
#
# Start the server with scripts/dev-fixtures.sh first — these use the same
# throwaway staff phrases and expect the fake Upstash on 8099.

BASE="${BASE:-http://127.0.0.1:3000}"
REDIS="${REDIS:-http://127.0.0.1:8099}"

CMS_PHRASE="${CMS_PHRASE:-abandon ability able about above absent absorb abstract absurd abuse access accident}"
DOOR_PHRASE="${DOOR_PHRASE:-account accuse achieve acid acoustic acquire across act action actor actress actual}"

fail() { echo "FAIL: $1" >&2; exit 1; }

post() { curl -s -X POST "$BASE$1" -H 'content-type: application/json' -d "$2" "${@:3}"; }

# pick <dotted.path> — reads JSON on stdin, prints "" for anything missing.
pick() {
  node -e '
let s="";
process.stdin.on("data",d=>s+=d).on("end",()=>{
  let o; try { o = JSON.parse(s) } catch { console.log(""); return }
  const v = process.argv[1].split(".").reduce((a,k)=>a?.[k], o);
  console.log(v === undefined || v === null ? "" : typeof v === "object" ? JSON.stringify(v) : v);
})' "$1"
}

# Staff login allows 8 attempts per 10 minutes per IP, so running these scripts
# back to back will legitimately start refusing. Say that plainly instead of
# letting a later step crash on a missing field.
cms_login() {
  local jar="$1"
  local body
  body=$(post /api/admin/login "{\"phrase\":\"$CMS_PHRASE\"}" -c "$jar")
  [ "$(echo "$body" | pick ok)" = "true" ] ||
    fail "CMS login refused ($(echo "$body" | pick error)). Start the server with scripts/dev-fixtures.sh, or restart it to clear the rate-limit counters."
}

door_login() {
  local jar="$1"
  local body
  body=$(post /api/door/login "{\"phrase\":\"$DOOR_PHRASE\"}" -c "$jar")
  [ "$(echo "$body" | pick ok)" = "true" ] ||
    fail "door login refused ($(echo "$body" | pick error)). Restart the server to clear the rate-limit counters."
}

# order_field <jar> <reference> <field> — one field off a CMS order row.
order_field() {
  curl -s "$BASE/api/admin/orders" -b "$1" | node -e '
let s="";
process.stdin.on("data",d=>s+=d).on("end",()=>{
  let o; try { o = JSON.parse(s) } catch { console.log("PARSE_ERROR"); return }
  if (!Array.isArray(o.orders)) { console.log("NO_ACCESS"); return }
  const m = o.orders.find(x => x.reference === process.argv[1]);
  if (!m) { console.log("MISSING"); return }
  const v = process.argv[2].split(".").reduce((a,k)=>a?.[k], m);
  console.log(v === undefined || v === null ? "" : typeof v === "object" ? JSON.stringify(v) : v);
})' "$2" "$3"
}

# A 600-byte JPEG that passes the magic-byte check in src/server/jpeg.ts.
fake_jpeg() {
  node -e 'const b=Buffer.concat([Buffer.from([0xff,0xd8,0xff,0xe0]),Buffer.alloc(600,0x20),Buffer.from([0xff,0xd9])]);console.log("data:image/jpeg;base64,"+b.toString("base64"))'
}

# verified_token <email> <reserve-json-fields> — verify an address and return
# the token checkout would hold.
verified_token() {
  local email="$1" intent="$2" code
  code=$(post /api/passes/verify "{\"name\":\"Check Runner\",\"email\":\"$email\",\"phone\":\"9876500000\",$intent}" | pick devCode)
  [ -n "$code" ] || fail "no devCode — the mailer is not in dev mode, or /api/passes/verify is rate limited"
  post /api/passes/verify/confirm "{\"email\":\"$email\",\"code\":\"$code\"}" | pick verificationToken
}
