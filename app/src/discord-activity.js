import { DiscordSDK } from "@discord/embedded-app-sdk";

const clientId = import.meta.env.VITE_DISCORD_CLIENT_ID || "";
const query = new URLSearchParams(window.location.search);

export const isDiscordActivity =
  window.parent !== window &&
  (query.has("frame_id") || query.has("instance_id"));

let sessionToken = null;
export function activityApiPath(path) {
  return isDiscordActivity ? `/.proxy${path}` : path;
}
export function activityAuthHeaders() {
  return sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {};
}
export function clearActivitySession() { sessionToken = null; }

export async function connectDiscordActivity() {
  if (!isDiscordActivity) return false;
  if (!/^\d{17,20}$/.test(clientId)) throw new Error("Не настроен Discord Application ID.");
  const sdk = new DiscordSDK(clientId);
  await sdk.ready();
  const { code } = await sdk.commands.authorize({
    client_id: clientId,
    response_type: "code",
    state: "",
    prompt: "none",
    scope: ["identify"],
  });
  if (!code) throw new Error("Discord не предоставил код авторизации.");
  const response = await fetch(activityApiPath("/api/activity/session"), {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ code }),
    cache: "no-store",
  });
  if (!response.ok) throw new Error("Не удалось подтвердить вход через Discord.");
  const { access_token: accessToken, activity_session: activitySession } = await response.json();
  if (!accessToken || !activitySession) throw new Error("Сервер не выдал Activity-сессию.");
  const auth = await sdk.commands.authenticate({ access_token: accessToken });
  if (!auth?.user?.id) throw new Error("Discord не подтвердил учётную запись.");
  // The server independently authenticated the OAuth code; the SDK verifies
  // the same identity within the host client.
  sessionToken = activitySession;
  return true;
}
