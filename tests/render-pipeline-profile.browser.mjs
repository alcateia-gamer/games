/** Isolamentos gráficos temporários; não são otimizações nem cenas de combate completas. */
import assert from "node:assert/strict";
import {writeFileSync} from "node:fs";
import {abrirSessaoNovoBoss} from "./novo-boss-browser-helpers.mjs";
import {novoBossConfig} from "../js/enemies/novoBoss/NovoBossConfig.js";
const session=await abrirSessaoNovoBoss(novoBossConfig,{spawnX:-1100,spawnY:-4800},{viewport:{width:960,height:540},hasTouch:true,isMobile:true,
  userAgent:"Mozilla/5.0 (Linux; Android 12; Mobile) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36"},{waitForBoss:false});
const reports=[];
const sampleCount=Number(process.env.PIPELINE_SAMPLES||25);
if(!Number.isInteger(sampleCount)||sampleCount<5||sampleCount>200)throw new Error("PIPELINE_SAMPLES inválido");
try{
  const {page}=session,cdp=await session.context.newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate",{rate:4});
  for(const portrait of [false,true]){
    if(portrait){await page.evaluate(async()=>{if(document.fullscreenElement)await document.exitFullscreen();});
      await page.setViewportSize({width:390,height:844});await page.waitForTimeout(500);}
    await cdp.send("Profiler.enable");await cdp.send("Profiler.start");
    const result=await page.evaluate(async sampleCount=>{
      const game=window.__game,s=game.scene.getScene("Level1Parte2"),c=s.cameras.main;
      const {installPerformanceProbe}=await import("/debug/PerformanceProbe.js");
      const probe=installPerformanceProbe(game,{observeLongTasks:false});probe.watchScene(s);
      await probe.enableRendererCounters();
      const mask=s.textures.get("level1-parte2-escuridao");
      const overlay=s.children.list.find(o=>o.texture?.key==="level1-parte2-escuridao");
      const layers=s.map.layers.map(l=>l.tilemapLayer).filter(Boolean);
      const listeners=game.renderer.listeners("render").map(fn=>fn.name);
      if(listeners.length!==1||listeners[0]!=="atualizarIluminacao")throw new Error("Listeners de render inesperados");
      const emit=game.renderer.emit,refresh=mask.refresh,undo=[];
      let mode="full",tileCalls=0,tileMs=0,tileCandidates=0;
      game.renderer.emit=function(event,...args){
        if(mode==="freeze-lighting"&&event==="render"&&args[0]===s)return false;
        return emit.call(this,event,...args);
      };
      for(const layer of layers){
        const original=layer.cull;
        layer.cull=function(...args){const start=performance.now();try{const result=original.apply(this,args);tileCalls++;tileCandidates+=result.length;return result;}finally{tileMs+=performance.now()-start;}};
        undo.push(()=>{layer.cull=original;});
      }
      const summary=times=>{const sorted=[...times].sort((a,b)=>a-b);const p=n=>sorted[Math.ceil(n*sorted.length)-1];
        return {n:times.length,mean:times.reduce((a,b)=>a+b,0)/times.length,median:p(.5),p95:p(.95),p99:p(.99),max:sorted.at(-1),overBudget:times.filter(t=>t>1000/30).length};};
      game.loop.sleep();
      const batches=[];let robots=[];c.stopFollow().setZoom(1).setRotation(0);s.player.setVelocity(0,0);
      const filterValues=layers.map(l=>l.cameraFilter),overlayFilter=overlay.cameraFilter;
      async function run(selected){
        mode=selected;
        for(let j=0;j<layers.length;j++)layers[j].cameraFilter=selected==="no-tilemaps"?filterValues[j]|c.id:filterValues[j];
        overlay.cameraFilter=selected==="no-overlay"?overlayFilter|c.id:overlayFilter;
        const times=[];
        for(let i=0;i<sampleCount+10;i++){
          s.time.now=1000+i*1000/30;c.centerOn(-1100+i*2,-4800);
          if(i===10){probe.reset();tileCalls=tileMs=tileCandidates=0;}
          const start=performance.now();game.step(1000+i*1000/30,1000/30);
          const elapsed=performance.now()-start;
          if(i>=10)times.push(elapsed);
          await new Promise(resolve=>setTimeout(resolve,Math.max(0,1000/30-elapsed)));
        }
        const snapshot=probe.snapshot();
        batches.push({mode:selected,frame:summary(times),gl:snapshot.rendererCounters,metrics:snapshot.metrics,counters:snapshot.counters,
          tileCull:{calls:tileCalls,ms:tileMs,candidates:tileCandidates}});
      }
      try{
        for(const selected of ["full","freeze-lighting","no-tilemaps","no-overlay","no-overlay","no-tilemaps","freeze-lighting","full"])await run(selected);
        // Cenário adicional: oito robôs renderizados; sem simular combate na cena pausada.
        const {criarInimigoTeste}=await import("/js/enemies/EnemyTest.js");
        robots=Array.from({length:8},(_,i)=>criarInimigoTeste(s,{x:-1200+(i%4)*60,y:-4800+Math.floor(i/4)*70}));
        await run("full-with-robots");await run("full-with-robots");
        const gl=game.renderer.gl,ext=gl.getExtension("WEBGL_debug_renderer_info");
        return {canvas:{width:game.canvas.width,height:game.canvas.height},mask:{width:mask.width,height:mask.height},dpr:devicePixelRatio,
          display:{width:game.scale.displaySize.width,height:game.scale.displaySize.height},heap:performance.memory?.usedJSHeapSize,
          adapter:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),
          gpuTimerAvailable:!!gl.getExtension("EXT_disjoint_timer_query_webgl2"),listeners,
          objects:s.children.list.length,shaders:s.children.list.filter(o=>o.type==="Shader").length,
          robotColorFX:robots.filter(o=>o.efeitoCores).length,
          layers:layers.map(l=>({name:l.layer.name,width:l.layer.width,height:l.layer.height,skipCull:l.skipCull,paddingX:l.cullPaddingX,paddingY:l.cullPaddingY})),batches};
      }finally{
        for(let j=0;j<layers.length;j++)layers[j].cameraFilter=filterValues[j];overlay.cameraFilter=overlayFilter;
        for(const restore of undo)restore();game.renderer.emit=emit;mask.refresh=refresh;probe.stop();
        for(const robot of robots)robot.destroy();
        s.inimigos=(s.inimigos||[]).filter(o=>!robots.includes(o));
        if(robots.includes(s.inimigoTeste))s.inimigoTeste=s.inimigos[0]||null;
        game.loop.wake();
      }
    },sampleCount);
    const {profile}=await cdp.send("Profiler.stop");
    writeFileSync(`/tmp/nullborns-stage5-${portrait?"portrait":"landscape"}.cpuprofile`,JSON.stringify(profile));
    reports.push(result);writeFileSync("/tmp/nullborns-stage5-pipeline.json",JSON.stringify({reports,errors:session.errors},null,2));
    console.log(JSON.stringify({canvas:result.canvas,batches:result.batches.map(b=>({mode:b.mode,frame:b.frame,gl:b.gl,tileCull:b.tileCull}))}));
  }
  assert.deepEqual(session.errors,[]);
}finally{await session.fechar();}
