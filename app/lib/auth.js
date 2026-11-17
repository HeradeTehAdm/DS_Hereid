import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from "node:crypto";

const SESSION_COOKIE = "spirit_session";
const STATE_COOKIE = "spirit_oauth_state";
const MAX_SESSION_AGE = 12 * 60 * 60;
const STATE_AGE = 10 * 60;

export function configuration() {
  const clientId = process.env.DISCORD_CLIENT_ID || "";
  const clientSecret = process.env.DISCORD_CLIENT_SECRET || "";
  const redirectUri = process.env.DISCORD_REDIRECT_URI || "";
  const sessionSecret = process.env.SESSION_SECRET || "";
  let redirect;
  try {
    redirect = new URL(redirectUri);
  } catch {
    redirect = null;
  }
  if (!/^\d{17,20}$/.test(clientId) || !clientSecret ||
      !redirect || redirect.protocol !== "https:" || redirect.username || redirect.password ||
      redirect.pathname !== "/api/auth/callback" || redirect.search || redirect.hash ||
      Buffer.byteLength(sessionSecret, "utf8") < 32) return null;
  return { clientId, clientSecret, redirectUri: redirect.toString(), sessionSecret };
}

function key(secret) {
  return createHash("sha256").update(secret).digest();
}

export function seal(value, secret) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(secret), iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(value)), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString("base64url");
}

export function unseal(token, secret) {
  try {
    if (typeof token !== "string" || token.length > 8192) return null;
    const buf = Buffer.from(token, "base64url");
    if (buf.length < 29) return null;
    const decipher = createDecipheriv("aes-256-gcm", key(secret), buf.subarray(0, 12));
    decipher.setAuthTag(buf.subarray(12, 28));
    return JSON.parse(Buffer.concat([decipher.update(buf.subarray(28)), decipher.final()]).toString("utf8"));
  } catch { return null; }
}

export function readCookie(req, name) {
  const raw = req.headers.cookie || "";
  for (const entry of raw.split(";")) {
    const [key, ...parts] = entry.trim().split("=");
    if (key === name) return parts.join("=");
  }
  return null;
}

export function setCookie(res, name, value, maxAge) {
  const val = encodeURIComponent(value);
  res.setHeader("Set-Cookie", `${name}=${val}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`);
}

export function clearCookie(res, name) {
  res.setHeader("Set-Cookie", `${name}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`);
}

export function setCookies(res, list) {
  res.setHeader("Set-Cookie", list.map(({ name, value, maxAge }) =>
    `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`
  ));
}

export function redirect(res, location) {
  res.statusCode = 303;
  res.setHeader("Location", location);
  res.setHeader("Cache-Control", "no-store");
  res.end();
}

export function json(res, status, value) {
  res.statusCode = status;
  res.setHeader("Cache-Control", "no-store, private");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.end(JSON.stringify(value));
}

export function sessionFromRequest(req) {
  const config = configuration();
  if (!config) return null;
  const raw = readCookie(req, SESSION_COOKIE);
  const session = unseal(raw, config.sessionSecret);
  if (!session || !Number.isSafeInteger(session.iat) ||
      session.iat > Date.now() || Date.now() - session.iat > MAX_SESSION_AGE * 1000 ||
      !/^\d{17,20}$/.test(String(session.id)) ||
      typeof session.username !== "string" || session.username.length > 64) return null;
  return session;
}

export { SESSION_COOKIE, STATE_COOKIE, MAX_SESSION_AGE, STATE_AGE };
