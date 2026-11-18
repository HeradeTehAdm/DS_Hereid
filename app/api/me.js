import { json, sessionFromRequest } from "../lib/auth.js";
import { loadVerifiedProfile, profileConfig } from "../lib/profile.js";

export default async function handler(req, res) {
  if (req.method !== "GET") return json(res, 405, { error: "Method not allowed" });
  const session = sessionFromRequest(req);
  if (!session) return json(res, 401, { error: "Login required" });
  const configured = Boolean(profileConfig());
  const profile = configured ? await loadVerifiedProfile(session.id) : null;
  const sync = !configured ? "not_configured" : profile ? "connected" : "unavailable";
  return json(res, 200, {
    identity: {
      id: session.id,
      username: session.username,
      displayName: session.displayName,
      avatar: session.avatar,
    },
    profile,
    sync,
  });
}
