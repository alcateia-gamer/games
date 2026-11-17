import test from "node:test";
import assert from "node:assert/strict";
import { spriteIntersectsLightingCanvas as intersects } from "./SpriteLightingBounds.js";
const matrix = { a:1,b:0,c:0,d:1,e:0,f:0 };
const sprite = () => ({ x:0,y:0, frame:{ source:{ image:{} },cutWidth:20,cutHeight:20 } });
test("conserva a margem das bordas, recortes e escalas negativas sem mutar o sprite", () => {
  const s = sprite();
  for (const [x,expected] of [[0,true],[-12,true],[-12.01,false],[112,true],[112.01,false]]) {
    s.x=x; assert.equal(intersects(s,matrix,100,100),expected);
  }
  s.x=50;s.y=50;s.scaleX=-2;s.scaleY=.5;s.flipX=true;s.rotation=.7;
  const before=structuredClone(s);
  assert.equal(intersects(s,matrix,100,100),true);
  assert.deepEqual(s,before);
  s.frame.realWidth=200;s.displayOriginX=0;s.frame.x=180;s.x=-200;s.rotation=0;s.scaleX=1;s.flipX=false;
  assert.equal(intersects(s,matrix,100,100),true,"recorte com trim cruza a borda");
});
test("campos incompletos ou não finitos não descartam silhuetas por hipótese", () => {
  const s=sprite(); s.frame.cutWidth=undefined;
  assert.equal(intersects(s,matrix,100,100),true);
  s.x=Infinity;assert.equal(intersects(s,matrix,100,100),true);
  s.frame=null;assert.equal(intersects(s,matrix,100,100),true);
});
