import assert from "node:assert/strict";
import { test } from "node:test";
import { renderCosmeticProfile, renderCosmeticsGallery } from "../src/cosmetic-profile.js";

const item = (type,id,name,rarity="Эпический") => ({
  id, name, type, rarity, price:100, category:"Косметика",description:"Описание",
});
const banner=item("banner","banner_blackhole","Баннер «Горизонт событий»","Мифический");
const color=item("color","color_neon","Цвет «Неоновый»");
const badge=item("badge","badge_crown","Значок «Корона»");
const title=item("title","title_legend","Титул «Легенда»","Легендарный");
const session={
 identity:{id:"123456789012345678",username:"TestUser",displayName:"Test User",avatar:null},
 profile:{
  level:4,xp:2472,balance:482960,rank:{rank:"LEGEND",messages:1704,activeDays:21},
  inventory:[banner,color,badge,title],
  equipped:{banner,color,badge,title}
 }
};
test("renders real equipped banner, colors, badges and titles",()=>{
 const html=renderCosmeticProfile(session);
 for(const value of ["Горизонт событий","Неоновый","Корона","Легенда","482 960","2 472","LEGEND"]){
  assert.ok(html.includes(value), "missing "+value);
 }
 assert.equal((html.match(/✓ Экипировано/g)||[]).length,4);
 assert.ok(html.includes("cos-banner-art"));
 assert.ok(!html.includes("Редактировать профиль"));
});
test("gallery lists only owned items and never invents cosmetics",()=>{
 const html=renderCosmeticsGallery({...session,profile:{
  ...session.profile,inventory:[badge],equipped:{banner:null,color:null,badge,title:null}
 }});
 assert.ok(html.includes("Корона"));
 assert.ok(!html.includes("Горизонт событий"));
 assert.ok(!html.includes("Абсолютная легенда"));
 assert.ok(html.includes("Пока нет предметов"));
});
test("escapes user controlled names and keeps theme CSS inert",()=>{
 const html=renderCosmeticProfile({...session,identity:{...session.identity,displayName:'<img src=x onerror=alert(1)>'}});
 assert.ok(html.includes("&lt;img"));
 assert.ok(!html.includes("<img src=x"));
});

test("all 20 original banner item IDs load their matching WebP and SVG fallback", () => {
  const ids = [
    "ocean","forest","sunset","neon","ice","galaxy","shadow","gold","pumpkin","graveyard",
    "dawn","lake","dunes","sakura","storm","autumn","megacity","orbit","volcano","skycastle"
  ];
  for (const suffix of ids) {
    const updated = {...session, profile: {
      ...session.profile,
      equipped: {...session.profile.equipped, banner: item("banner", "banner_" + suffix, "Баннер «" + suffix + "»")}
    }};
    const html = renderCosmeticProfile(updated);
    assert.ok(html.includes("/banners/banner_" + suffix + ".webp"), "missing generated banner " + suffix);
    assert.ok(html.includes("/profile-banners/" + suffix + ".svg"), "missing original fallback " + suffix);
  }
  const fallback = renderCosmeticProfile({...session,profile:{
    ...session.profile,equipped:{...session.profile.equipped,banner:item("banner","banner_blackhole","Баннер «Горизонт событий»")}
  }});
  assert.ok(!fallback.includes("/banners/banner_blackhole.webp"), "unavailable artwork must not be linked");
  assert.ok(fallback.includes("/profile-banners/blackhole.svg"));
});
