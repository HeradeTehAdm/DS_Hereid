const key = "spirit.appearance.v1";
const modes = {system:"Как в системе", light:"Светлый", dark:"Тёмный"};
// Светлые оттенки используются на кнопках и тёмном фоне, насыщенные — на светлом фоне.
const accents = {
  mint: ["Мята", "#95efce", "#006653"],
  sky: ["Небо", "#92ceff", "#12588c"],
  violet: ["Сирень", "#d4b5ff", "#63358e"],
  dawn: ["Рассвет", "#ffc79a", "#8c4118", "#ffabc7", "#94395d"],
  aurora: ["Северное сияние", "#9feacb", "#006653", "#b3bbff", "#494e93"]
};
const systemDark = matchMedia("(prefers-color-scheme: dark)");
let choice;
function restore() {
  let saved;
  try { saved = JSON.parse(localStorage.getItem(key)); } catch {}
  choice = {
    mode:Object.hasOwn(modes,saved?.mode) ? saved.mode : "system",
    accent:Object.hasOwn(accents,saved?.accent) ? saved.accent : "mint"
  };
  apply();
}
function apply() {
  const root = document.documentElement;
  const dark = choice.mode === "system" ? systemDark.matches : choice.mode === "dark";
  const [,pale,deep,endPale=pale,endDeep=deep] = accents[choice.accent];
  root.dataset.scheme = dark ? "dark" : "light";
  root.style.setProperty("--accent-ink",dark ? pale : deep);
  root.style.setProperty("--accent-pale",pale);
  root.style.setProperty("--accent-end",dark ? endPale : endDeep);
  root.style.setProperty("--accent-fill",`linear-gradient(110deg,${pale},${endPale})`);
  document.querySelector('meta[name="theme-color"]').content = dark ? "#0b121e" : "#f4f7fa";
  for (const radio of document.querySelectorAll("[data-appearance]")) radio.checked = choice[radio.name] === radio.value;
}
restore();
systemDark.addEventListener("change", () => { if (choice.mode === "system") apply(); });
window.addEventListener("storage", event => { if (event.key === key || event.key === null) restore(); });
export function setAppearance(name,value) {
  if (!(name === "mode" && Object.hasOwn(modes,value)) && !(name === "accent" && Object.hasOwn(accents,value))) return;
  choice[name] = value;
  apply();
  try { localStorage.setItem(key,JSON.stringify(choice)); } catch {}
}
function option(name,value,label,swatch="") {
  return '<label class="theme-option"><input type="radio" data-appearance name="'+name+'" value="'+value+'" '+(choice[name] === value ? "checked" : "")+'>'+
    (swatch ? '<span class="theme-swatch" aria-hidden="true" style="background:'+swatch+'"></span>' : '')+'<span>'+label+'</span></label>';
}
export function appearancePage() {
  return '<section class="heading"><h1>Оформление</h1><p>Настройки сохраняются в этом браузере.</p></section>'+
    '<fieldset class="theme-group"><legend>Режим</legend>'+Object.entries(modes).map(([id,label])=>option("mode",id,label)).join("")+'</fieldset>'+
    '<fieldset class="theme-group"><legend>Акцент</legend>'+Object.entries(accents).map(([id,[label,start,,end=start]])=>
      option("accent",id,label,`linear-gradient(110deg,${start},${end})`)).join("")+'</fieldset>';
}

