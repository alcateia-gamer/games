/** Compara o descarte geométrico com a rasterização original, incluindo atlas com trim. */
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
const browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
try {
  const page = await browser.newPage();
  await page.goto(process.env.BASE_URL || "http://127.0.0.1:8765/");
  const result = await page.evaluate(async () => {
    const { spriteIntersectsLightingCanvas: intersects } = await import("/js/effects/SpriteLightingBounds.js");
    const { ocultarBrilhoAtrasSprite: draw } = await import("/js/effects/SpriteLightOcclusion.js");
    let seed = 93817;
    const random = () => { seed = (Math.imul(seed,1664525)+1013904223) >>> 0; return seed/2**32; };
    const source = document.createElement("canvas"); source.width = source.height = 64;
    const sc = source.getContext("2d");
    sc.fillStyle = "rgba(20,50,200,.7)"; sc.fillRect(1,3,48,53); sc.clearRect(7,8,12,14);
    let skipped = 0;
    for (let i = 0; i < 320; i++) {
      const rotation = random()*6, zoom = .2+random()*3;
      const matrix = { a: Math.cos(rotation)*zoom, b: Math.sin(rotation)*zoom,
        c: -Math.sin(rotation)*zoom, d: Math.cos(rotation)*zoom, e: random()*200, f: random()*130 };
      const sprite = { x: random()*1200-600, y: random()*800-400, scaleX: random()*4-2,
        scaleY: random()*4-2, rotation: random()*6, flipX: random()<.5, flipY: random()<.5,
        displayOriginX: random()*150, displayOriginY: random()*150, alpha: random(),
        frame: { source: { image: source }, cutX: 3, cutY: 4, cutWidth: 40, cutHeight: 44,
          x: i%3 ? 0 : 17, y: i%3 ? 0 : 21, realWidth: 128, realHeight: 128 } };
      const canvases = [document.createElement("canvas"),document.createElement("canvas")];
      const keep = intersects(sprite,matrix,193,127);
      if (!keep) skipped++;
      for (let j=0;j<2;j++) {
        const canvas=canvases[j];canvas.width=193;canvas.height=127;
        const ctx=canvas.getContext("2d",{willReadFrequently:true});
        ctx.fillStyle="rgba(10,20,30,.8)";ctx.fillRect(0,0,193,127);
        ctx.setTransform(matrix.a,matrix.b,matrix.c,matrix.d,matrix.e,matrix.f);
        if (j===0 || keep) draw(ctx,sprite);
      }
      const a=canvases[0].getContext("2d").getImageData(0,0,193,127).data;
      const b=canvases[1].getContext("2d").getImageData(0,0,193,127).data;
      if (a.some((value,index)=>value!==b[index])) throw new Error(`pixel diferente no caso ${i}`);
    }
    return { cases:320,skipped,identical:true };
  });
  assert.ok(result.skipped>0);
  writeFileSync("/tmp/nullborns-stage3-sprite-pixels.json",JSON.stringify(result,null,2));
  console.log(JSON.stringify(result));
} finally { await browser.close(); }
