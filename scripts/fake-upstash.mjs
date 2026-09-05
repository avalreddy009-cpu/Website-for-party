/**
 * Minimal stand-in for the two Upstash REST calls src/server/store.ts makes, so
 * the multi-instance merge can be exercised locally. Test-only.
 *
 *   GET  /get/<key>   -> { result: string | null }
 *   POST /            -> ["SET", key, value] | ["DEL", key] | ["GET", key]
 *
 * Plus two hooks the test driver uses to play the part of a second instance:
 *
 *   GET  /__dump      -> the stored blob
 *   POST /__set       -> overwrite the stored blob
 */
import { createServer } from "node:http";

const store = new Map();
const port = Number(process.argv[2] ?? 8099);

const body = (req) =>
  new Promise((resolve) => {
    let raw = "";
    req.on("data", (chunk) => (raw += chunk));
    req.on("end", () => resolve(raw));
  });

const json = (res, status, payload) => {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(payload));
};

createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");

  if (req.method === "GET" && url.pathname === "/__dump") {
    return json(res, 200, { value: store.get("utopia:db:v1") ?? null });
  }
  if (req.method === "POST" && url.pathname === "/__set") {
    store.set("utopia:db:v1", await body(req));
    return json(res, 200, { ok: true });
  }
  if (req.method === "GET" && url.pathname.startsWith("/get/")) {
    const key = decodeURIComponent(url.pathname.slice("/get/".length));
    return json(res, 200, { result: store.get(key) ?? null });
  }
  if (req.method === "POST" && url.pathname === "/") {
    const [command, key, value] = JSON.parse(await body(req));
    if (command === "GET") {
      return json(res, 200, { result: store.get(key) ?? null });
    }
    if (command === "DEL") {
      const existed = store.delete(key);
      return json(res, 200, { result: existed ? 1 : 0 });
    }
    if (command !== "SET") return json(res, 400, { error: `unsupported: ${command}` });
    if (typeof value === "string" && Buffer.byteLength(value) > 1_000_000) {
      return json(res, 400, { error: "ERR max request size exceeded" });
    }
    store.set(key, value);
    return json(res, 200, { result: "OK" });
  }

  return json(res, 404, { error: "not found" });
}).listen(port, "127.0.0.1", () => {
  console.log(`fake upstash on http://127.0.0.1:${port}`);
});
