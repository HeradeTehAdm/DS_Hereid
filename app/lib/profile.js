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
  return { level: value.level, xp: value.xp, balance: value.balance, achievements };
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
