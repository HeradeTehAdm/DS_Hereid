import { createHmac, randomBytes } from "node:crypto";

const PROFILE_PATH = "/api/v1/spirit/profile";

export function profileConfig() {
  const raw = process.env.SPIRIT_PROFILE_API_URL || "";
  const secret = process.env.SPIRIT_PROFILE_API_SECRET || "";
  if (!raw || Buffer.byteLength(secret, "utf8") < 32) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" || url.username || url.password ||
        url.pathname !== "/" || url.search || url.hash) return null;
    return { origin: url.origin, secret };
  } catch {
    return null;
  }
}

export function signedHeaders(secret, pathname, now = Date.now(), nonce = randomBytes(16).toString("hex")) {
  const timestamp = String(Math.floor(now / 1000));
  const canonical = [timestamp, nonce, "GET", pathname].join("\n");
  return {
    "x-spirit-timestamp": timestamp,
    "x-spirit-nonce": nonce,
    "x-spirit-signature": createHmac("sha256", secret).update(canonical).digest("hex"),
    Accept: "application/json",
  };
}

function nonNegativeInteger(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

export function validatedProfile(value) {
  if (!value || typeof value !== "object" ||
      !nonNegativeInteger(value.level) ||
      !nonNegativeInteger(value.xp) ||
      !nonNegativeInteger(value.balance) ||
      !Array.isArray(value.achievements) ||
      value.achievements.length > 200) return null;

  const achievements = [];
  for (const award of value.achievements) {
    if (!award || typeof award !== "object" ||
        typeof award.id !== "string" || award.id.length > 80 ||
        typeof award.name !== "string" || award.name.length > 100 ||
        typeof award.description !== "string" || award.description.length > 300 ||
        typeof award.badge !== "string" || award.badge.length > 24 ||
        typeof award.rarity !== "string" || award.rarity.length > 40) return null;
    achievements.push({
      id: award.id, name: award.name, description: award.description,
      badge: award.badge, rarity: award.rarity,
    });
  }
  const text = (v, max) => typeof v === "string" && v.length <= max;
  const item = (row) => row && text(row.id, 100) && text(row.name, 150) &&
    text(row.category, 100) && text(row.description, 400) &&
    text(row.type, 40) && text(row.rarity, 60) && nonNegativeInteger(row.price) &&
    (row.value === undefined || text(row.value, 80));
  const inventory = value.inventory;
  const catalog = value.catalog;
  if (!Array.isArray(inventory) || inventory.length > 400 || !inventory.every(item) ||
      !Array.isArray(catalog) || catalog.length > 1000 || !catalog.every(item)) return null;
  const equipped = value.equipped;
  if (!equipped || typeof equipped !== "object" ||
      !["title", "badge", "banner", "color"].every((key) =>
        equipped[key] === null || item(equipped[key]))) return null;
  const rank = value.rank;
  if (rank !== null && (typeof rank !== "object" || !text(rank.rank, 40) ||
      !["messages", "activeDays", "voiceSeconds", "days"].every((key) =>
        nonNegativeInteger(rank[key])))) return null;
  const quests = value.quests;
  if (!Array.isArray(quests) || quests.length > 30 || !quests.every((q) =>
    q && text(q.key, 50) && text(q.name, 120) && text(q.description, 300) &&
    nonNegativeInteger(q.target) && nonNegativeInteger(q.reward) &&
    nonNegativeInteger(q.progress) && typeof q.completed === "boolean")) return null;
  const redeemedPromos = value.redeemedPromos;
  if (!Array.isArray(redeemedPromos) || redeemedPromos.length > 40 ||
      !redeemedPromos.every((p) => p && text(p.code, 24) && nonNegativeInteger(p.redeemedAt))) return null;
  const transactions = value.transactions;
  if (!Array.isArray(transactions) || transactions.length > 25 ||
      !transactions.every((t) => t && Number.isSafeInteger(t.amount) &&
        text(t.kind, 70) && text(t.details, 200) && nonNegativeInteger(t.createdAt))) return null;
  return {
    level: value.level, xp: value.xp, balance: value.balance, achievements,
    rank, inventory: inventory.map((i) => ({ id:i.id,name:i.name,category:i.category,description:i.description,
      price:i.price,type:i.type,rarity:i.rarity,...(i.value === undefined ? {} : {value:i.value}) })),
    catalog: catalog.map((i) => ({ id:i.id,name:i.name,category:i.category,description:i.description,
      price:i.price,type:i.type,rarity:i.rarity,...(i.value === undefined ? {} : {value:i.value}) })),
    equipped: Object.fromEntries(["title","badge","banner","color"].map((k) => [k,equipped[k] ? {
      id: equipped[k].id, name: equipped[k].name, category: equipped[k].category,
      description: equipped[k].description, price: equipped[k].price,
      type: equipped[k].type, rarity: equipped[k].rarity,
      ...(equipped[k].value === undefined ? {} : {value: equipped[k].value}),
    } : null])),
    quests: quests.map((q) => ({key:q.key,name:q.name,description:q.description,target:q.target,
      reward:q.reward,progress:q.progress,completed:q.completed})),
    redeemedPromos: redeemedPromos.map((p) => ({code:p.code,redeemedAt:p.redeemedAt})),
    transactions: transactions.map((t) => ({amount:t.amount,kind:t.kind,details:t.details,createdAt:t.createdAt})),
  };
}

export async function loadVerifiedProfile(userId) {
  if (!/^\d{17,20}$/.test(String(userId))) return null;
  const config = profileConfig();
  if (!config) return null;
  const url = new URL(PROFILE_PATH, config.origin);
  url.searchParams.set("userId", userId);
  try {
    const response = await fetch(url, {
      method: "GET",
      headers: signedHeaders(config.secret, url.pathname + url.search),
      signal: AbortSignal.timeout(4500),
      redirect: "error",
      cache: "no-store",
    });
    if (!response.ok) return null;
    const result = await response.json();
    return validatedProfile(result?.profile);
  } catch {
    return null;
  }
}
