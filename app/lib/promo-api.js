import { activitySessionFromRequest, configuration, json, sessionFromRequest } from "../lib/auth.js";
import { enqueue, latestPromo, promoInput } from "../lib/promo-store.js";

export default async function handler(req, res) {
  const session = req.headers.authorization ? activitySessionFromRequest(req) : sessionFromRequest(req);
  if (!session) return json(res,401,{error:"Войди через Discord."});
  try {
    if (req.method === "GET") return json(res,200,{action:await latestPromo(session.id)});
    if (req.method !== "POST") return json(res,405,{error:"Метод не поддерживается."});
    if (req.headers["x-spirit-action"] !== "promo" || !/^application\/json(?:\s*;|$)/i.test(req.headers["content-type"] || "") ||
        (!req.headers.authorization && req.headers.origin !== new URL(configuration().redirectUri).origin))
      return json(res,403,{error:"Источник запроса не подтверждён."});
    const payload = promoInput(req.body);
    if (!payload) return json(res,400,{error:"Проверь код, сумму, лимит и срок действия."});
    const answer = await enqueue(session.id, req.body.kind, payload);
    return json(res,answer.status,answer.body);
  } catch { return json(res,503,{error:"Очередь бота временно недоступна."}); }
}

