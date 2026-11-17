/** Perfil em execução normal, sem readbacks por quadro ou mudanças na implementação das luzes. */
import {writeFileSync} from "node:fs";
import assert from "node:assert/strict";
import {abrirSessaoNovoBoss} from "./novo-boss-browser-helpers.mjs";
import {novoBossConfig} from "../js/enemies/novoBoss/NovoBossConfig.js";
const session=await abrirSessaoNovoBoss(novoBossConfig,{spawnX:-1100,spawnY:-4800},{viewport:{width:960,height:540},hasTouch:true,isMobile:true,
  userAgent:"Mozilla/5.0 (Linux; Android 12; Mobile) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36"},{waitForBoss:false});
const reports=[];
try{
  const {page}=session,cdp=await session.context.newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate",{rate:4});
  await session.retomar();
  for(const portrait of [false,true]){
    if(portrait){
      await page.evaluate(async()=>{if(document.fullscreenElement)await document.exitFullscreen();});
      await page.setViewportSize({width:390,height:844});await page.waitForTimeout(500);
    }
    for(const mode of ["stationary","continuous","reverse","fast-shake-zoom"]){
      await page.evaluate(mode=>{
        const s=window.__game.scene.getScene("Level1Parte2"),c=s.cameras.main;
        const start=performance.now();c.stopFollow().setRotation(0).setZoom(1).centerOn(-1100,-4800);
        s.__cameraProfile=()=>{
          const elapsed=performance.now()-start;
          let x=-1100,y=-4800;
          if(mode==="continuous"){x+=elapsed*.035;y-=elapsed*.015;}
          if(mode==="reverse")x+=Math.abs((elapsed%1200)-600)*.16;
          if(mode==="fast-shake-zoom"){
            x+=Math.sin(elapsed/160)*180;y+=Math.cos(elapsed/190)*100;
            c.setZoom(1.1+Math.sin(elapsed/250)*.05).setRotation(Math.sin(elapsed/90)*.015);
          }
          c.centerOn(x,y);
        };
        s.events.on("preupdate",s.__cameraProfile);
        window.nullbornsPerformance.reset();
      },mode);
      await cdp.send("Profiler.enable");await cdp.send("Profiler.start");
      await page.waitForTimeout(Number(process.env.PERF_MS||3500));
      const result=await page.evaluate(()=>{
        const s=window.__game.scene.getScene("Level1Parte2"),t=s.textures.get("level1-parte2-escuridao");
        s.events.off("preupdate",s.__cameraProfile);delete s.__cameraProfile;
        const gl=s.game.renderer.gl,extension=gl.getExtension("WEBGL_debug_renderer_info");
        return {...window.nullbornsPerformance.snapshot(),mask:{width:t.width,height:t.height},
          camera:{width:s.cameras.main.width,height:s.cameras.main.height},heap:performance.memory?.usedJSHeapSize,
          renderer:extension?gl.getParameter(extension.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),
          gpuTimerAvailable:!!gl.getExtension("EXT_disjoint_timer_query_webgl2")};
      });
      const {profile}=await cdp.send("Profiler.stop");
      const name=`${portrait?"portrait":"landscape"}-${mode}`;
      writeFileSync(`/tmp/nullborns-stage4-${name}.cpuprofile`,JSON.stringify(profile));
      reports.push({name,...result});
      writeFileSync("/tmp/nullborns-stage4-motion.json",JSON.stringify({reports,errors:session.errors},null,2));
      console.log(JSON.stringify({name,frame:result.metrics["frame.cpu"],refresh:result.metrics["Level1Parte2.lighting.refreshCPU"],counters:result.counters,mask:result.mask}));
    }
  }
  assert.deepEqual(session.errors,[]);
}finally{await session.fechar();}
