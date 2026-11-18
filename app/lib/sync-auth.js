import { createHash, timingSafeEqual } from "node:crypto";

export function authorizedSyncWorker(req) {
  const secret = process.env.SPIRIT_SYNC_SECRET || "";
  if (Buffer.byteLength(secret, "utf8") < 32) return false;
  const header = req.headers["x-spirit-sync-secret"];
  if (typeof header !== "string") return false;
  const expected = createHash("sha256").update(secret).digest();
  const received = createHash("sha256").update(header).digest();
  return timingSafeEqual(received, expected);
}

export function privateJson(res, status, value) {
  res.setHeader("Cache-Control", "no-store, private");
  res.setHeader("X-Content-Type-Options", "nosniff");
  return res.status(status).json(value);
}
