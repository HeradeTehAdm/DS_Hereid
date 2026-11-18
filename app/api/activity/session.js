import { configuration, json, seal } from "../../lib/auth.js";

const IDENTIFIER = /^\d{17,20}$/;
const MAX_CODE_LENGTH = 4096;

// Discord SDK authorize() returns a single-use code. Only the server may exchange it.
export default async function handler(req, res) {
  if (req.method !== "POST") return json(res, 405, { error: "Method not allowed" });
  const config = configuration();
  if (!config) return json(res, 503, { error: "Discord OAuth configuration is missing" });
  const code = req.body?.code;
  if (typeof code !== "string" || !code || code.length > MAX_CODE_LENGTH) {
    return json(res, 400, { error: "Invalid authorization code" });
  }
  try {
    const tokenResponse = await fetch("https://discord.com/api/v10/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", "Accept": "application/json" },
      body: new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        grant_type: "authorization_code",
        code,
      }),
      signal: AbortSignal.timeout(10000),
      redirect: "error",
    });
    if (!tokenResponse.ok) return json(res, 401, { error: "Discord authorization was rejected" });
    const token = await tokenResponse.json();
    if (token?.token_type?.toLowerCase() !== "bearer" ||
        typeof token.access_token !== "string" || !token.access_token ||
        !Number.isFinite(token.expires_in) || token.expires_in < 60) {
      return json(res, 401, { error: "Invalid Discord token" });
    }
    const userResponse = await fetch("https://discord.com/api/v10/users/@me", {
      headers: { Authorization: `Bearer ${token.access_token}`, Accept: "application/json" },
      signal: AbortSignal.timeout(10000),
      redirect: "error",
    });
    if (!userResponse.ok) return json(res, 401, { error: "Unable to verify Discord account" });
    const user = await userResponse.json();
    if (!IDENTIFIER.test(String(user?.id)) || typeof user.username !== "string") {
      return json(res, 401, { error: "Invalid Discord identity" });
    }
    const now = Date.now();
    const identity = {
      id: user.id,
      username: user.username.slice(0, 64),
      displayName: String(user.global_name || user.username).slice(0, 64),
      avatar: typeof user.avatar === "string" ? user.avatar : null,
      iat: now,
      exp: now + Math.min(60 * 60, Math.floor(token.expires_in)) * 1000,
      purpose: "discord_activity",
      aud: config.clientId,
    };
    return json(res, 200, {
      access_token: token.access_token,
      activity_session: seal(identity, config.sessionSecret),
      expires_in: Math.min(60 * 60, Math.floor(token.expires_in)),
    });
  } catch {
    return json(res, 503, { error: "Discord authorization is temporarily unavailable" });
  }
}
