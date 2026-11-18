import { authorizedSyncWorker, privateJson } from "../../lib/sync-auth.js";
import { saveRequestedProfile } from "../../lib/sync-store.js";
import { validatedProfile } from "../../lib/profile.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return privateJson(res, 405, { error: "Method not allowed" });
  if (!authorizedSyncWorker(req)) return privateJson(res, 401, { error: "Unauthorized" });
  const { userId, profile } = req.body || {};
  if (!/^\d{17,20}$/.test(String(userId))) return privateJson(res, 400, { error: "Invalid user ID" });
  const sanitized = validatedProfile(profile);
  if (!sanitized) return privateJson(res, 400, { error: "Invalid profile data" });
  try {
    const saved = await saveRequestedProfile(userId, sanitized);
    return privateJson(res, saved ? 200 : 409, { ok: saved });
  } catch {
    return privateJson(res, 503, { error: "Synchronization unavailable" });
  }
}
