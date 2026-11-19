import { authorizedSyncWorker, privateJson } from "../../lib/sync-auth.js";
import { pendingProfileJobs } from "../../lib/sync-store.js";
import { pendingEquipActions } from "../../lib/action-store.js";
import { pendingPurchaseActions } from "../../lib/purchase-store.js";
import { pendingPromos, finishPromo } from "../../lib/promo-store.js";
import { ACTION_ID, USER_ID } from "../../lib/action-store.js";

export default async function handler(req, res) {
  if (!["GET","POST"].includes(req.method)) return privateJson(res,405,{error:"Метод не поддерживается."});
  if (!authorizedSyncWorker(req)) return privateJson(res, 401, { error: "Unauthorized" });
  try {
    if (req.method === "POST") {
      const { id,userId,result } = req.body || {};
      if (!ACTION_ID.test(id) || !USER_ID.test(userId) || typeof result?.ok !== "boolean") return privateJson(res,400,{ok:false});
      const ok = await finishPromo(id,userId,result);
      return privateJson(res,ok ? 200 : 409,{ok});
    }
    const [userIds, actions, purchases, promos] = await Promise.all([pendingProfileJobs(), pendingEquipActions(), pendingPurchaseActions(), pendingPromos()]);
    return privateJson(res, 200, { userIds, actions, purchases, promos });
  } catch {
    return privateJson(res, 503, { error: "Synchronization unavailable" });
  }
}
