import { syncDatabase } from "./sync-store.js";

export function promoInput(body) {
  if (!body || typeof body.code !== "string" || body.code.length > 32) return null;
  const code = body.code.trim().replace(/\s+/g, "").toLocaleUpperCase("ru-RU");
  if (!/^[A-ZА-ЯЁ0-9_-]{3,24}$/u.test(code)) return null;
  if (body.kind === "redeem") return { code };
  const within = (value, max) => Number.isSafeInteger(value) && value >= 1 && value <= max;
  const { coins, maxUses = null, days = null } = body;
  if (body.kind !== "create" || !within(coins, 1000000) ||
      (maxUses !== null && !within(maxUses, 1000000)) || (days !== null && !within(days, 3650))) return null;
  return { code, coins, maxUses, days };
}

let ready;
async function database() {
  const sql = syncDatabase();
  if (!sql) throw new Error("Очередь не настроена");
  ready ??= sql`CREATE TABLE IF NOT EXISTS spirit_web_promos (
    user_id varchar(20) PRIMARY KEY, id uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
    kind text NOT NULL, payload jsonb NOT NULL, result jsonb, requested_at timestamptz NOT NULL DEFAULT now()
  )`.catch(error => { ready = null; throw error; });
  await ready;
  return sql;
}

export async function enqueue(userId, kind, payload) {
  const sql = await database();
  const [row] = await sql`INSERT INTO spirit_web_promos (user_id,kind,payload)
    SELECT ${userId},${kind},${JSON.stringify(payload)}::jsonb
    WHERE ${kind} <> 'create' OR EXISTS (SELECT 1 FROM spirit_profiles WHERE user_id=${userId}
      AND synced_at > now()-interval '120 seconds' AND payload->>'canManagePromos'='true')
    ON CONFLICT(user_id) DO UPDATE SET id=excluded.id,kind=excluded.kind,payload=excluded.payload,
      result=NULL,requested_at=now()
    WHERE spirit_web_promos.result IS NOT NULL AND spirit_web_promos.requested_at < now()-interval '10 seconds'
    RETURNING id`;
  if (row) return { status:202, body:{id:row.id} };
  if (kind === "create") {
    const [grant] = await sql`SELECT 1 FROM spirit_profiles WHERE user_id=${userId}
      AND synced_at > now()-interval '120 seconds' AND payload->>'canManagePromos'='true'`;
    if (!grant) return {status:403, body:{error:"Нет действующего права на создание. Обнови профиль."}};
  }
  return {status:409, body:{error:"Предыдущий запрос ещё обрабатывается или был отправлен только что."}};
}
export async function latestPromo(userId) {
  const sql = await database();
  const [row] = await sql`SELECT id,kind,payload->>'code' AS code,result FROM spirit_web_promos WHERE user_id=${userId}`;
  return row || null;
}
export async function pendingPromos() {
  const sql = await database();
  return sql`SELECT id,user_id AS "userId",kind,payload,
    (extract(epoch FROM requested_at)*1000)::float8 + 300000 AS deadline
    FROM spirit_web_promos WHERE result IS NULL ORDER BY requested_at LIMIT 10`;
}
export async function finishPromo(id,userId,result) {
  const sql = await database();
  const data = JSON.stringify(result);
  const rows = await sql`WITH settled AS (
    UPDATE spirit_web_promos SET result=${data}::jsonb
    WHERE id=${id} AND user_id=${userId} AND result IS NULL RETURNING user_id,kind
  ), invalidated AS (
    DELETE FROM spirit_profiles WHERE user_id IN (SELECT user_id FROM settled WHERE kind='redeem') AND ${result.ok}
  ), refreshed AS (
    INSERT INTO spirit_requests (user_id,status,requested_at,updated_at)
    SELECT user_id,'pending',now(),now() FROM settled WHERE kind='redeem' AND ${result.ok}
    ON CONFLICT(user_id) DO UPDATE SET status='pending',requested_at=now(),updated_at=now()
  ) SELECT user_id FROM settled`;
  if (rows.length) return true;
  const [previous] = await sql`SELECT 1 FROM spirit_web_promos WHERE id=${id} AND user_id=${userId} AND result=${data}::jsonb`;
  return Boolean(previous);
}

