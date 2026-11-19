const db = require("./database");
const promo = require("./promo");
const admin = require("./commands/admin");
const { isFeatureEnabled } = require("./features");

db.exec(`CREATE TABLE IF NOT EXISTS web_promo_receipts (
  guild_id TEXT NOT NULL, id TEXT NOT NULL, user_id TEXT NOT NULL,
  result TEXT NOT NULL, PRIMARY KEY (guild_id, id)
)`);

async function promoMember(client, guildId, userId) {
  if (!client.isReady()) throw new Error("Бот ещё не подключён");
  const guild = await client.guilds.fetch(guildId);
  try {
    return await guild.members.fetch({ user: userId, force: true });
  } catch (error) {
    if (error.code === 10007) return null;
    throw error;
  }
}

function canManage(member) {
  return Boolean(member && admin.allowed({
    client: member.client, guild: member.guild, guildId: member.guild.id,
    member, user: member.user, memberPermissions: member.permissions
  }, "promo"));
}

const settle = db.transaction((guildId, job, member, now = Date.now()) => {
  const receipt = db.prepare("SELECT result,user_id FROM web_promo_receipts WHERE guild_id=? AND id=?").get(guildId, job.id);
  if (receipt) {
    if (receipt.user_id !== job.userId) throw new Error("Владелец операции не совпадает");
    return JSON.parse(receipt.result);
  }
  let result;
  if (!Number.isFinite(job.deadline) || now >= job.deadline) result = { ok:false, reason:"timeout" };
  else if (!member || member.user.id !== job.userId || member.guild.id !== guildId) result = { ok:false, reason:"forbidden" };
  else if (job.kind === "create") {
    if (!canManage(member)) result = { ok:false, reason:"forbidden" };
    else {
      result = promo.createPromo(guildId, { ...job.payload, createdBy: job.userId }, now);
      if (result.ok) admin.audit(guildId, job.userId, "promo_created", null, result.code + ": " + result.coins + " монет");
    }
  } else if (job.kind === "redeem" && isFeatureEnabled(guildId, "economy")) {
    const limiter = require("./commands/promo");
    const key = guildId + ":" + job.userId;
    result = limiter.blockedFor(key, now) ? {ok:false, reason:"limited"} : promo.redeemPromo(guildId, job.userId, job.payload.code, now);
    if (result.reason === "not_found") limiter.registerFailure(key, now);
    if (result.ok) limiter.failures.delete(key);
    if (result.ok) require("./achievements").evaluateAchievements(guildId, job.userId);
  } else result = { ok:false, reason:"unavailable" };
  db.prepare("INSERT INTO web_promo_receipts VALUES (?,?,?,?)").run(guildId, job.id, job.userId, JSON.stringify(result));
  return result;
});
module.exports = { promoMember, canManage, settle };

