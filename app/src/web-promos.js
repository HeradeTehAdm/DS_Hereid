import { activityApiPath, activityAuthHeaders, isDiscordActivity } from "./discord-activity.js";

const reasons = {
  forbidden:"У тебя нет доступа к этой операции.", already_used:"Ты уже активировал этот код.",
  exists:"Такой код уже существует.", exhausted:"Лимит участников исчерпан.", timeout:"Срок обработки истёк.",
  expired:"Срок действия кода закончился.", inactive:"Код отключён.", not_found:"Код не найден.",
  unavailable:"Экономика временно недоступна.", limited:"Слишком много неверных попыток. Попробуй через пять минут."
};
const numberField = (label,name,max,required=false) => '<label>'+label+'<input type="number" name="'+name+'" min="1" max="'+max+'" step="1" '+(required?'required':'')+'></label>';
export function promoForm(kind) {
  return '<form class="promo-form" data-promo="'+kind+'"><label>Промокод<input name="code" required minlength="3" maxlength="32" autocomplete="off" placeholder="Код сообщества"></label>'+
    (kind === "create" ? numberField("Приз в монетах","coins",1000000,true)+numberField("Лимит участников (необязательно)","maxUses",1000000)+numberField("Срок в днях (необязательно)","days",3650) : '')+
    '<button class="primary" type="submit">'+(kind === "create" ? "Создать промокод" : "Получить приз")+'</button><p role="status"></p></form>';
}

export function bindPromo(form, signal, refresh) {
  const status = form.querySelector('[role="status"]');
  const submit = form.querySelector("button");
  const write = message => { if (!signal.aborted) status.textContent = message; };
  const request = async body => {
    const response = await fetch(activityApiPath("/api/promos"), {
      method:body ? "POST":"GET", credentials:isDiscordActivity ? "omit":"same-origin", cache:"no-store", signal,
      headers:{ ...activityAuthHeaders(), ...(body ? {"Content-Type":"application/json","x-spirit-action":"promo"} : {}) },
      body:body ? JSON.stringify(body) : undefined
    });
    const data = await response.json();
    if (!response.ok) {
      const error = new Error(data.error || "Сервис временно недоступен.");
      error.status = response.status;
      throw error;
    }
    return data;
  };
  let pending = false;
  const check = async (attempt=0) => {
    try {
      const {action} = await request();
      if (signal.aborted) return;
      if (action && !action.result) {
        pending = true;
        submit.disabled = true;
        write("Запрос принят. Ожидаем подтверждения бота.");
        setTimeout(() => { if (!signal.aborted) void check(attempt+1); }, document.hidden ? 15000 : Math.min(8000,1500 * (attempt+1)));
        return;
      }
      submit.disabled = false;
      if (action && action.kind === form.dataset.promo) {
        const result = action.result;
        write(result.ok ? (action.kind === "create" ? "Создан код «"+action.code+"». Приз: " : "Код «"+action.code+"» активирован. Начислено ") +
          result.coins.toLocaleString("ru-RU")+" монет." : reasons[result.reason] || "Бот отклонил запрос.");
      } else write("");
      if (pending && action?.kind === "redeem" && action.result?.ok) void refresh();
      pending = false;
    } catch (error) {
      if (signal.aborted) return;
      write("Статус не подтверждён. Проверим соединение повторно.");
      setTimeout(() => { if (!signal.aborted) void check(attempt+1); },10000);
    }
  };
  submit.disabled = true;
  void check();
  form.addEventListener("submit", async event => {
    event.preventDefault();
    if (submit.disabled) return;
    submit.disabled = true;
    const values = new FormData(form);
    const body = {kind:form.dataset.promo,code:values.get("code")};
    if (body.kind === "create") for (const key of ["coins","maxUses","days"]) body[key] = values.get(key) ? Number(values.get(key)) : null;
    write("Отправляем запрос…");
    try {
      await request(body);
      pending = true;
      await check();
    } catch (error) {
      if (signal.aborted) return;
      write(error.message || "Не удалось подтвердить отправку.");
      submit.disabled = false;
      if (error.status === 403) void refresh();
    }
  },{signal});
}

