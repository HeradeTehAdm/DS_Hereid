import { authorizedSyncWorker, privateJson } from "../../lib/sync-auth.js";
import { pendingProfileJobs } from "../../lib/sync-store.js";
import { pendingEquipActions } from "../../lib/action-store.js";

export default async function handler(req, res) {
  if (req.method !== "GET") return privateJson(res, 405, { error: "Method not allowed" });
  if (!authorizedSyncWorker(req)) return privateJson(res, 401, { error: "Unauthorized" });
  try {
    const [userIds, actions] = await Promise.all([pendingProfileJobs(), pendingEquipActions()]);
    return privateJson(res, 200, { userIds, actions });
  } catch {
    return privateJson(res, 503, { error: "Synchronization unavailable" });
  }
}
