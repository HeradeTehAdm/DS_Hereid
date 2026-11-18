import { authorizedSyncWorker, privateJson } from "../../lib/sync-auth.js";
import { pendingProfileJobs } from "../../lib/sync-store.js";

export default async function handler(req, res) {
  if (req.method !== "GET") return privateJson(res, 405, { error: "Method not allowed" });
  if (!authorizedSyncWorker(req)) return privateJson(res, 401, { error: "Unauthorized" });
  try {
    const userIds = await pendingProfileJobs();
    return privateJson(res, 200, { userIds });
  } catch {
    return privateJson(res, 503, { error: "Synchronization unavailable" });
  }
}
