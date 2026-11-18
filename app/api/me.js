import { json, sessionFromRequest, activitySessionFromRequest } from "../lib/auth.js";
import { loadVerifiedProfile, profileConfig } from "../lib/profile.js";
import { getCachedOrRequest } from "../lib/sync-store.js";

export default async function handler(req, res) {
  if (req.method !== "GET") return json(res, 405, { error: "Method not allowed" });
  // A bearer token, when supplied, must validate independently; never fall back to cookies.
  const session = req.headers.authorization ? activitySessionFromRequest(req) : sessionFromRequest(req);
  if (!session) return json(res, 401, { error: "Login required" });
  let profile = null;
  let sync = "not_configured";
  if (process.env.SPIRIT_SYNC_SECRET && process.env.SPIRIT_SYNC_DATABASE_URL) {
    try {
      const result = await getCachedOrRequest(session.id);
      profile = result.profile;
      sync = result.sync;
    } catch {
      sync = "unavailable";
    }
  } else if (profileConfig()) {
    profile = await loadVerifiedProfile(session.id);
    sync = profile ? "connected" : "unavailable";
  }
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
