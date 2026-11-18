import { sessionFromRequest, activitySessionFromRequest, json } from "../lib/auth.js";
import { createPurchaseAction, purchaseActionStatus } from "../lib/purchase-store.js";
import { ACTION_ID, EQUIP_ID } from "../lib/action-store.js";

export default async function handler(req,res) {
  if (!["GET","POST"].includes(req.method)) return json(res,405,{error:"Method not allowed"});
  const session = req.headers.authorization ? activitySessionFromRequest(req) : sessionFromRequest(req);
  if (!session) return json(res,401,{error:"Login required"});
  if (req.method === "GET") {
    const id = new URL(req.url,"https://duh-svobody-app.vercel.app").searchParams.get("id");
    if (!ACTION_ID.test(id || "")) return json(res,400,{error:"Invalid request ID"});
    try {
      const status = await purchaseActionStatus(session.id,id);
      return json(res,status ? 200 : 404,status || {error:"Not found"});
    } catch { return json(res,503,{error:"Sync unavailable"}); }
  }
  if (req.headers["x-spirit-action"] !== "purchase" ||
      !String(req.headers["content-type"] || "").toLowerCase().startsWith("application/json"))
    return json(res,403,{error:"Invalid action headers"});
  if (!req.headers.authorization && req.headers.origin !== "https://duh-svobody-app.vercel.app")
    return json(res,403,{error:"Invalid request origin"});
  if (Number(req.headers["content-length"] || 0) > 2048) return json(res,413,{error:"Request too large"});
  const itemId = req.body?.itemId;
  if (typeof itemId !== "string" || !EQUIP_ID.test(itemId))
    return json(res,400,{error:"Invalid item ID"});
  try {
    const action = await createPurchaseAction(session.id,itemId);
    if (action.error === "busy") return json(res,409,{error:"Previous purchase pending"});
    if (["already_owned","not_for_sale","insufficient_funds","profile_not_synced"].includes(action.error))
      return json(res,409,{error:action.error});
    if (action.error) return json(res,503,{error:"Sync unavailable"});
    return json(res,202,action);
  } catch { return json(res,503,{error:"Sync unavailable"}); }
}
