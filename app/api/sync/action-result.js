import { authorizedSyncWorker, privateJson } from "../../lib/sync-auth.js";
import { finishEquipAction } from "../../lib/action-store.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return privateJson(res, 405, { error: "Method not allowed" });
  if (!authorizedSyncWorker(req)) return privateJson(res, 401, { error: "Unauthorized" });
  const { id, userId, status, code } = req.body || {};
  try {
    const saved = await finishEquipAction(id, userId, status, code);
    return privateJson(res, saved ? 200 : 409, { ok: saved });
  } catch {
    return privateJson(res, 503, { error: "Synchronization unavailable" });
  }
}
