import {readFileSync} from "node:fs";
import {resolve} from "node:path";
import {test} from "node:test";
import assert from "node:assert/strict";
import {renderCosmeticArtwork} from "../src/cosmetic-profile.js";
const ids=[
  "moontemple","phoenix","rift","fractal","worldtree",
  "lavender","camp","harbor","village","tropic",
  "bamboo","aurora","ghostship","steam","ruins",
  "dragoneye","bifrost","blackhole","gem","clock",
];
test("banner packs 3 and 4 are valid original bot JPEGs with accurate catalog IDs",()=>{
  const catalog=readFileSync(resolve("../src/economy.js"),"utf8");
  for(const id of ids) {
    const file=readFileSync(resolve("public/banners/banner_"+id+".jpg"));
    assert.ok(file.length>1024,id+" too small");
    assert.deepEqual([...file.subarray(0,3)],[255,216,255],id+" not JPEG");
    assert.ok(catalog.includes('id: "banner_'+id+'"'),id+" not in Discord catalog");
    const html=renderCosmeticArtwork({id:"banner_"+id,type:"banner",name:id});
    assert.ok(html.includes('/banners/banner_'+id+'.jpg'),id+" missing website image");
    assert.ok(html.includes('/profile-banners/'+id+'.svg'),id+" missing original fallback");
  }
});
