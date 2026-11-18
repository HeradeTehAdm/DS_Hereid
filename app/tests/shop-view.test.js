import assert from "node:assert/strict";
import {test} from "node:test";
import {filterShopItems, renderShopPage, renderShopResults, itemIsEquipped, itemIsOwned} from "../src/shop-view.js";

const catalog=[
  {id:"banner_sakura",name:"Баннер «Сакура»",type:"banner",category:"Баннеры",description:"Цветущий лес",rarity:"Эпический",price:800},
  {id:"banner_skycastle",name:"Баннер «Небесный замок»",type:"banner",category:"Баннеры",description:"Небесное королевство",rarity:"Мифический",price:5000},
  {id:"color_blue",name:"Цвет «Синий»",type:"color",category:"Цвета",description:"Сияние",rarity:"Обычный",price:120},
  {id:"badge_star",name:"Значок «Звезда»",type:"badge",category:"Значки",description:"Яркая звезда",rarity:"Редкий",price:230},
  {id:"title_legend",name:"Титул «Легенда»",type:"title",category:"Титулы",description:"Титул",rarity:"Легендарный",price:600},
];
const profile={catalog,inventory:[catalog[0],catalog[3]],equipped:{banner:catalog[0],badge:null,title:null,color:null},balance:900};
test("shop filters, sorting and affordability use real catalog values",()=>{
  assert.equal(filterShopItems(catalog,{category:"banner"}).length,2);
  assert.deepEqual(filterShopItems(catalog,{category:"banner",affordable:true,balance:900}).map(i=>i.id),["banner_sakura"]);
  assert.deepEqual(filterShopItems(catalog,{search:"небес",sort:"price-low"}).map(i=>i.id),["banner_skycastle"]);
  assert.equal(filterShopItems(catalog,{sort:"price-high"})[0].id,"banner_skycastle");
  assert.equal(filterShopItems(catalog,{sort:"name"})[0].name.startsWith("Баннер"),true);
});
test("owned and equipped indicators are based on bot snapshot, not balance",()=>{
  assert.ok(itemIsOwned(profile,catalog[0]));
  assert.ok(itemIsEquipped(profile,catalog[0]));
  assert.ok(!itemIsOwned(profile,catalog[1]));
  const markup=renderShopResults(profile);
  assert.ok(markup.includes("/banners/banner_sakura.webp"));
  assert.ok(markup.includes("/profile-banners/skycastle.svg"));
  assert.ok(markup.includes('data-equip-id="badge_star"'));
  assert.ok(!markup.includes('data-equip-id="banner_skycastle"'));
  assert.ok(markup.includes("Купить в Discord"));
  assert.ok(!markup.includes("Купить сейчас"));
});
test("all categories and search controls rendered without untrusted markup",()=>{
  const html=renderShopPage({...profile,catalog:[...catalog,{...catalog[0],id:"banner_test",name:"<img onerror=alert(1)>"}]});
  for(const label of ["Баннеры","Цвета","Значки","Титулы","Поиск по предметам","Сортировка"]) assert.ok(html.includes(label));
  assert.ok(html.includes("&lt;img"));
  assert.ok(!html.includes("<img onerror"));
  assert.equal(filterShopItems(null).length,0);
});
