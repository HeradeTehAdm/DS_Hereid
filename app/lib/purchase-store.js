// Signed-in user's purchase requests are processed only by the Discord bot.
// Never write to balances or inventory from Vercel.
import { syncDatabase } from "./sync-store.js";
import { USER_ID, EQUIP_ID, ACTION_ID } from "./action-store.js";

let initialized = null;
async function database() {
  const sql = syncDatabase();
  if (!sql) throw new Error("Sync database unavailable");
  if (!initialized) {
    initialized = (async () => {
      await sql`
        CREATE TABLE IF NOT EXISTS spirit_purchase_actions (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id varchar(20) NOT NULL,
          item_id varchar(100) NOT NULL,
          status varchar(20) NOT NULL DEFAULT 'pending',
          result_code varchar(35),
          requested_at timestamptz NOT NULL DEFAULT now(),
          updated_at timestamptz NOT NULL DEFAULT now()
        )`;
      await sql`CREATE UNIQUE INDEX IF NOT EXISTS spirit_purchases_one_pending
        ON spirit_purchase_actions (user_id) WHERE status = 'pending'`;
    })().catch(error => { initialized = null; throw error; });
  }
  await initialized;
  return sql;
}
export function validPurchaseCatalogItem(row, itemId) {
  return Boolean(row && row.id === itemId &&
    ["banner","color","badge","title"].includes(row.type) &&
    Number.isSafeInteger(row.price) && row.price >= 0);
}
export async function createPurchaseAction(userId, itemId) {
  if (!USER_ID.test(String(userId)) || !EQUIP_ID.test(String(itemId))) return { error:"invalid_item" };
  const sql = await database();
  const cached = await sql`
    SELECT payload FROM spirit_profiles
    WHERE user_id=${userId} AND synced_at > now() - interval '4 minutes'
    LIMIT 1`;
  const profile = cached[0]?.payload;
  if (!profile) return { error: "profile_not_synced" };
  const item = profile.catalog?.find(x => validPurchaseCatalogItem(x, itemId));
  if (!item) return { error: "not_for_sale" };
  if (profile.inventory?.some(x => x.id === itemId)) return { error: "already_owned" };
  if (Number(profile.balance || 0) < item.price) return { error: "insufficient_funds" };
  await sql`UPDATE spirit_purchase_actions
    SET status='rejected',result_code='expired',updated_at=now()
    WHERE user_id=${userId} AND status='pending'
    AND requested_at < now() - interval '5 minutes'`;
  const rows = await sql`
    INSERT INTO spirit_purchase_actions (user_id,item_id)
    VALUES (${userId},${itemId})
    ON CONFLICT DO NOTHING RETURNING id`;
  return rows.length ? { id:String(rows[0].id), status:"pending" } : { error:"busy" };
}
export async function purchaseActionStatus(userId, id) {
  if (!USER_ID.test(String(userId)) || !ACTION_ID.test(String(id))) return null;
  const sql = await database();
  const rows = await sql`
    SELECT status,result_code FROM spirit_purchase_actions
    WHERE id=${id}::uuid AND user_id=${userId} LIMIT 1`;
  return rows[0] ? { status:rows[0].status, code:rows[0].result_code || null } : null;
}
export async function pendingPurchaseActions() {
  const sql = await database();
  const rows = await sql`
    SELECT id,user_id,item_id FROM spirit_purchase_actions
    WHERE status='pending' AND requested_at > now()-interval '5 minutes'
    ORDER BY requested_at LIMIT 10`;
  return rows.map(row=>({id:String(row.id),userId:row.user_id,itemId:row.item_id}));
}
export async function finishPurchaseAction(id,userId,status,code) {
  if (!ACTION_ID.test(String(id)) || !USER_ID.test(String(userId)) ||
      !["complete","rejected"].includes(status) ||
      typeof code !== "string" || !/^[a-z_]{2,35}$/.test(code)) return false;
  const sql = await database();
  const updated = await sql`WITH settled AS (
    UPDATE spirit_purchase_actions SET status=${status},result_code=${code},updated_at=now()
    WHERE id=${id}::uuid AND user_id=${userId} AND status='pending' RETURNING user_id
  ), invalidated AS (
    DELETE FROM spirit_profiles WHERE user_id IN (SELECT user_id FROM settled) AND ${status}='complete'
  ), refreshed AS (
    INSERT INTO spirit_requests (user_id,status,requested_at,updated_at)
    SELECT user_id,'pending',now(),now() FROM settled WHERE ${status}='complete'
    ON CONFLICT(user_id) DO UPDATE SET status='pending',requested_at=now(),updated_at=now()
  ) SELECT user_id FROM settled`;
  if (updated.length === 0) {
    const previous = await purchaseActionStatus(userId,id);
    return Boolean(previous && previous.status === status && previous.code === code);
  }
  return true;
}
