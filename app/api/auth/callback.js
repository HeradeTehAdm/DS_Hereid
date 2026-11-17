import { timingSafeEqual } from "node:crypto";
import { configuration, json, seal, unseal, readCookie, setCookies, redirect, SESSION_COOKIE, STATE_COOKIE, MAX_SESSION_AGE } from "../../lib/auth.js";

function matches(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export default async function handler(req, res) {
  if (req.method !== "GET") return json(res, 405, { error: "Method not allowed" });
  const config = configuration();
  if (!config) return json(res, 503, { error: "OAuth2 not configured" });
  const url = new URL(req.url, config.redirectUri);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookie = unseal(readCookie(req, STATE_COOKIE), config.sessionSecret);
  // Consume OAuth state even if the exchange fails.
  setCookies(res, [{ name: STATE_COOKIE, value: "", maxAge: 0 }]);
  if (!code || code.length > 4096 || !cookie || !matches(cookie.state, state) ||
      !Number.isSafeInteger(cookie.iat) || cookie.iat > Date.now() ||
      Date.now() - cookie.iat > 10 * 60 * 1000) return redirect(res, "/?auth=invalid");

  try {
    const tokenResponse = await fetch("https://discord.com/api/v10/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", "Accept": "application/json" },
      body: new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        grant_type: "authorization_code",
        code,
        redirect_uri: config.redirectUri,
      }),
      signal: AbortSignal.timeout(10000),
    });
    if (!tokenResponse.ok) return redirect(res, "/?auth=failed");
    const token = await tokenResponse.json();
    if (!token?.access_token || token.token_type?.toLowerCase() !== "bearer") return redirect(res, "/?auth=failed");
    const userResponse = await fetch("https://discord.com/api/v10/users/@me", {
      headers: { Authorization: `Bearer ${token.access_token}`, Accept: "application/json" },
      signal: AbortSignal.timeout(10000),
    });
    if (!userResponse.ok) return redirect(res, "/?auth=failed");
    const user = await userResponse.json();
    if (!/^\d{17,20}$/.test(String(user.id)) || typeof user.username !== "string") return redirect(res, "/?auth=failed");
    const session = {
      id: user.id, username: user.username.slice(0, 64),
      displayName: String(user.global_name || user.username).slice(0, 64),
      avatar: typeof user.avatar === "string" ? user.avatar : null, iat: Date.now(),
    };
    setCookies(res, [
      { name: STATE_COOKIE, value: "", maxAge: 0 },
      { name: SESSION_COOKIE, value: seal(session, config.sessionSecret), maxAge: MAX_SESSION_AGE },
    ]);
    return redirect(res, "/?auth=success");
  } catch {
    return redirect(res, "/?auth=failed");
  }
}
