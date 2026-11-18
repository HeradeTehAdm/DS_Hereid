import { neon } from "@neondatabase/serverless";

const USER_ID = /^\d{17,20}$/;
let sqlClient;

export function syncDatabase() {
  const connectionString = process.env.SPIRIT_SYNC_DATABASE_URL;
  if (!connectionString) return null;
  if (!sqlClient) sqlClient = neon(connectionString);
  return sqlClient;
}

export async function getCachedOrRequest(userId) {
  if (!USER_ID.test(String(userId))) throw new Error("Invalid member ID");
  const sql = syncDatabase();
  if (!sql) return { profile: null, sync: "not_configured" };
  const cached = await sql`
    SELECT payload FROM spirit_profiles
    WHERE user_id = ${userId} AND synced_at > now() - interval '120 seconds'
    LIMIT 1
  `;
  if (cached.length) return { profile: cached[0].payload, sync: "connected" };
  await sql`
    INSERT INTO spirit_requests (user_id, status, requested_at, updated_at)
    VALUES (${userId}, 'pending', now(), now())
    ON CONFLICT (user_id) DO UPDATE
      SET status = 'pending', requested_at = now(), updated_at = now()
    WHERE spirit_requests.updated_at < now() - interval '12 seconds'
  `;
  return { profile: null, sync: "pending" };
}

export async function pendingProfileJobs() {
  const sql = syncDatabase();
  if (!sql) throw new Error("Database not configured");
  const rows = await sql`
    SELECT user_id FROM spirit_requests
    WHERE status = 'pending' AND requested_at > now() - interval '10 minutes'
    ORDER BY requested_at ASC LIMIT 15
  `;
  return rows.map((row) => row.user_id);
}

export async function saveRequestedProfile(userId, payload) {
  const sql = syncDatabase();
  if (!sql || !USER_ID.test(String(userId))) return false;
  const serialized = JSON.stringify(payload);
  if (Buffer.byteLength(serialized, "utf8") > 512_000) return false;
  const rows = await sql`
    INSERT INTO spirit_profiles (user_id, payload, synced_at)
    SELECT user_id, ${serialized}::jsonb, now()
    FROM spirit_requests
    WHERE user_id = ${userId} AND status = 'pending'
      AND requested_at > now() - interval '10 minutes'
    ON CONFLICT (user_id) DO UPDATE
      SET payload = EXCLUDED.payload, synced_at = EXCLUDED.synced_at
    RETURNING user_id
  `;
  if (!rows.length) return false;
  await sql`
    UPDATE spirit_requests SET status='complete', updated_at=now()
    WHERE user_id = ${userId}
  `;
  return true;
}
