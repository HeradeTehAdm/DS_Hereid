import { randomBytes } from "node:crypto";
import { configuration, json, seal, setCookie, redirect, STATE_COOKIE, STATE_AGE } from "../_auth.js";

export default function handler(req, res) {
  if (req.method !== "GET") return json(res, 405, { error: "Method not allowed" });
  const config = configuration();
  if (!config) return json(res, 503, { error: "Авторизация Discord пока не настроена администратором." });
  const state = randomBytes(32).toString("base64url");
  setCookie(res, STATE_COOKIE, seal({ state, iat: Date.now() }, config.sessionSecret), STATE_AGE);
  const url = new URL("https://discord.com/oauth2/authorize");
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "identify");
  url.searchParams.set("state", state);
  url.searchParams.set("prompt", "consent");
  redirect(res, url.toString());
}
