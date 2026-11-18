import { sessionFromRequest, activitySessionFromRequest, json } from "../lib/auth.js";
import { createEquipAction, equipActionStatus, ACTION_ID, EQUIP_ID } from "../lib/action-store.js";

function identify(req) {
  return req.headers.authorization ? activitySessionFromRequest(req) : sessionFromRequest(req);
}
export default async function handler(req, res) {
  if (!["GET", "POST"].includes(req.method)) return json(res, 405, { error: "Method not allowed" });
  const session = identify(req);
  if (!session) return json(res, 401, { error: "Login required" });
  if (req.method === "GET") {
    const rawId = new URL(req.url, "https://duh-svobody-app.vercel.app").searchParams.get("id");
    if (!ACTION_ID.test(rawId || "")) return json(res, 400, { error: "Invalid request ID" });
    try {
      const result = await equipActionStatus(session.id, rawId);
      return json(res, result ? 200 : 404, result || { error: "Not found" });
    } catch { return json(res, 503, { error: "Sync unavailable" }); }
  }
  // A non-simple header prevents third-party form submissions and requires
  // a CORS preflight for cross-origin browser requests (which we never allow).
  if (req.headers["x-spirit-action"] !== "equip" ||
      !String(req.headers["content-type"] || "").toLowerCase().startsWith("application/json")) {
    return json(res, 403, { error: "Invalid action headers" });
  }
  if (!req.headers.authorization && req.headers.origin !== "https://duh-svobody-app.vercel.app") {
    return json(res, 403, { error: "Invalid request origin" });
  }
  if (Number(req.headers["content-length"] || 0) > 2048) {
    return json(res, 413, { error: "Request too large" });
  }
  const itemId = req.body?.itemId;
  if (typeof itemId !== "string" || !EQUIP_ID.test(itemId)) {
    return json(res, 400, { error: "Invalid item ID" });
  }
  try {
    const result = await createEquipAction(session.id, itemId);
    if (result.error === "busy") return json(res, 409, { error: "Previous action pending" });
    if (result.error === "not_owned_or_unsynced") return json(res, 403, { error: "Item not owned or profile not synced" });
    if (result.error) return json(res, 503, { error: "Sync unavailable" });
    return json(res, 202, result);
  } catch { return json(res, 503, { error: "Sync unavailable" }); }
}
