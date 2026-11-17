import { json, setCookies, SESSION_COOKIE, STATE_COOKIE } from "../../lib/auth.js";

export default function handler(req, res) {
  if (req.method !== "POST") return json(res, 405, { error: "Method not allowed" });
  // Clear both cookies. Never log session data.
  setCookies(res, [
    { name: SESSION_COOKIE, value: "", maxAge: 0 },
    { name: STATE_COOKIE, value: "", maxAge: 0 },
  ]);
  return json(res, 200, { ok: true });
}
