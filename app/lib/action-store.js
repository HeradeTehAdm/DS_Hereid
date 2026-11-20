import { syncDatabase } from "./sync-store.js";

export const EQUIP_ID = /^[a-z][a-z0-9_]{2,99}$/;
export const ACTION_ID = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
export const USER_ID = /^\d{17,20}$/;
export const EQUIP_TYPES = new Set(["banner", "color", "badge", "title"]);

export function validEquipItem(item, itemId) {
  return Boolean(item && item.id === itemId && EQUIP_TYPES.has(item.type));
}

export async function createEquipAction(userId, itemId) {
  if (!USER_ID.test(String(userId)) || !EQUIP_ID.test(itemId)) return { error: "invalid_item" };
  const sql = syncDatabase();
  if (!sql) return { error: "unavailable" };
  // The cached snapshot is advisory; the Discord bot re-checks ownership
  // in its SQLite transaction before applying any change.
  const snapshots = await sql`
    SELECT payload FROM spirit_profiles WHERE user_id = ${userId}
    ORDER BY synced_at DESC LIMIT 1
  `;
  const found = snapshots[0]?.payload?.inventory?.find(item => validEquipItem(item, itemId));
  if (!found) return { error: "not_owned_or_unsynced" };
  await sql`
    UPDATE spirit_actions SET status = 'rejected', result_code = 'expired', updated_at = now()
    WHERE user_id = ${userId} AND status = 'pending'
      AND requested_at < now() - interval '5 minutes'
  `;
  const active = await sql`
    SELECT id FROM spirit_actions WHERE user_id = ${userId} AND status = 'pending' LIMIT 1
  `;
  if (active.length) return { error: "busy" };
  const rows = await sql`
    INSERT INTO spirit_actions (user_id, item_id)
    VALUES (${userId}, ${itemId})
    ON CONFLICT DO NOTHING RETURNING id
  `;
  return rows.length ? { id: String(rows[0].id), status: "pending" } : { error: "busy" };
}

export async function equipActionStatus(userId, actionId) {
  if (!USER_ID.test(String(userId)) || !ACTION_ID.test(String(actionId))) return null;
  const sql = syncDatabase();
  if (!sql) return null;
  const rows = await sql`
    SELECT status, result_code FROM spirit_actions
    WHERE id = ${actionId}::uuid AND user_id = ${userId} LIMIT 1
  `;
  return rows[0] ? { status: rows[0].status, code: rows[0].result_code || null } : null;
}

export async function pendingEquipActions() {
  const sql = syncDatabase();
  if (!sql) throw new Error("Sync DB not configured");
  const rows = await sql`
    SELECT id, user_id, item_id FROM spirit_actions
    WHERE status='pending' AND requested_at > now()-interval '5 minutes'
    ORDER BY requested_at ASC LIMIT 10
  `;
  return rows.map(row => ({
    id: String(row.id), userId: row.user_id, itemId: row.item_id,
  }));
}

export async function finishEquipAction(actionId, userId, status, code) {
  if (!ACTION_ID.test(String(actionId)) || !USER_ID.test(String(userId)) ||
      !["complete", "rejected"].includes(status) ||
      typeof code !== "string" || !/^[a-z_]{2,35}$/.test(code)) return false;
  const sql = syncDatabase();
  if (!sql) throw new Error("Sync DB not configured");
  const updated = await sql`WITH settled AS (
    UPDATE spirit_actions SET status=${status},result_code=${code},updated_at=now()
    WHERE id=${actionId}::uuid AND user_id=${userId} AND status='pending' RETURNING user_id
  ), invalidated AS (
    DELETE FROM spirit_profiles WHERE user_id IN (SELECT user_id FROM settled) AND ${status}='complete'
  ), refreshed AS (
    INSERT INTO spirit_requests (user_id,status,requested_at,updated_at)
    SELECT user_id,'pending',now(),now() FROM settled WHERE ${status}='complete'
    ON CONFLICT(user_id) DO UPDATE SET status='pending',requested_at=now(),updated_at=now()
  ) SELECT user_id FROM settled`;
  if (updated.length === 0) {
    const previous = await equipActionStatus(userId, actionId);
    return Boolean(previous && previous.status === status && previous.code === code);
  }
  return true;
}
