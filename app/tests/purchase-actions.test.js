import {test} from "node:test";
import assert from "node:assert/strict";
import {validPurchaseCatalogItem} from "../lib/purchase-store.js";
import {ACTION_ID,EQUIP_ID,USER_ID} from "../lib/action-store.js";

test("only catalog cosmetics can be purchased and IDs are strictly validated",()=>{
  assert.equal(validPurchaseCatalogItem({id:"banner_ocean",type:"banner",price:900},"banner_ocean"),true);
  assert.equal(validPurchaseCatalogItem({id:"badge_star",type:"badge",price:250},"badge_star"),true);
  assert.equal(validPurchaseCatalogItem({id:"color_blue",type:"color",price:250},"color_blue"),true);
  assert.equal(validPurchaseCatalogItem({id:"title_legend",type:"title",price:250},"title_legend"),true);
  assert.equal(validPurchaseCatalogItem({id:"xp_token",type:"unknown",price:0},"xp_token"),false);
  assert.equal(validPurchaseCatalogItem({id:"banner_ocean",type:"banner",price:-1},"banner_ocean"),false);
  assert.equal(validPurchaseCatalogItem({id:"banner_ocean",type:"banner",price:100},"../banner_ocean"),false);
  assert.equal(EQUIP_ID.test("../test"),false);
  assert.equal(USER_ID.test("x"),false);
  assert.equal(ACTION_ID.test("not-a-uuid"),false);
});
