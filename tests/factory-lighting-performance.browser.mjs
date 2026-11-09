/** Comparação reproduzível da composição de iluminação com CPU limitada em 4×. */
import { writeFileSync } from "node:fs";
import { abrirSessaoNovoBoss } from "./novo-boss-browser-helpers.mjs";
import { novoBossConfig } from "../js/enemies/novoBoss/NovoBossConfig.js";
const label = process.argv[2] ?? "current";
const session = await abrirSessaoNovoBoss({ ...novoBossConfig,
  ataques: { ...novoBossConfig.ataques, ativo: false },
  geradores: { ...novoBossConfig.geradores, ativo: false },
  fase2: { ...novoBossConfig.fase2, ativo: false },
}, {}, { viewport: {width: 960,height: 540}, hasTouch: true, isMobile: true,
  userAgent: "Mozilla/5.0 (Linux; Android 12; Mobile) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36" });
const {page} = session;
try {
 const cdp = await session.context.newCDPSession(page);
 await cdp.send("Emulation.setCPUThrottlingRate", {rate: 4});
 await page.evaluate(async () => {
  const names = ["FactoryLighting", "EmergencyLighting", "BossWallLighting", "FixedLightCache",
   "GiroflexLightCache", "FlashlightWalls", "EmergencyStatueOcclusion"];
  window.__lightingPerf = {};
  for (const name of names) {
   const cls = (await import(`/js/effects/${name}.js`)).default;
   for (const key of ["atualizar", "desenhar", "obter", "recortar", "recortarFonte", "sincronizar"]) {
    const method=cls.prototype[key]; if(!method)continue;
    const metric=window.__lightingPerf[`${name}.${key}`]={calls:0,ms:0};
    cls.prototype[key]=function(...args) {
     const start=performance.now();try{return method.apply(this,args);}finally{metric.calls++;metric.ms+=performance.now()-start;}
    };
   }
  }
  const proto=CanvasRenderingContext2D.prototype;
  window.__canvasCalls={drawImage:0,clearRect:0,fillRect:0,clip:0};
  for(const key of Object.keys(window.__canvasCalls)) {
   const method=proto[key];proto[key]=function(...args){window.__canvasCalls[key]++;return method.apply(this,args);};
  }
  const s=window.__game.scene.getScene("Level1Parte2");
  window.__lightRender=s.game.renderer.listeners(Phaser.Renderer.Events.RENDER)
   .find(fn=>fn.name==="atualizarIluminacao");
  if(!window.__lightRender)throw new Error("callback de iluminação não encontrado");
  s.player.setVelocity(0,0);s.cameras.main.stopFollow().setZoom(1);
  for(const zone of s.zonasLuzApagada.zonas){zone.liberada=zone.restaurada=true;zone.opacidade=0;}
  if(s.novoBoss?.introducao?.iluminacao) s.novoBoss.introducao.iluminacao.fatorLuz=()=>1;
 });
 await cdp.send("Profiler.enable");await cdp.send("Profiler.start");
 const report=[];
 for(const config of [
  {name:"arena-neons",x:-1093,y:-5770,power:false},
  {name:"giroflex",x:-1100,y:-5200,power:false},
  {name:"fabrica-ligada",x:-1093,y:-5770,power:true},
  {name:"andando",x:-1100,y:-5200,power:false,moving:true},
 ]) {
  const result=await page.evaluate(config=>{
   const s=window.__game.scene.getScene("Level1Parte2"),c=s.cameras.main;
   s.definirIluminacaoFabrica(config.power);
   const times=[];
   const reset=()=>{for(const m of Object.values(window.__lightingPerf)){m.calls=0;m.ms=0;}for(const k in window.__canvasCalls)window.__canvasCalls[k]=0;};
   reset();
   for(let i=0;i<100;i++) {
    if(i===20)reset();
    s.time.now=1000+i*1000/30;
    s.player.setPosition(config.x+(config.moving?i*2:0),config.y);
    c.centerOn(s.player.x,s.player.y);c.preRender();
    const start=performance.now();window.__lightRender(s,c);const ms=performance.now()-start;
    if(i>=20)times.push(ms);
   }
   const sorted=times.slice().sort((a,b)=>a-b);
   const perf=JSON.parse(JSON.stringify(window.__lightingPerf));
   return {name:config.name,frames:times.length,mean:times.reduce((a,b)=>a+b,0)/times.length,
    p95:sorted[Math.floor(sorted.length*.95)],max:Math.max(...times),
    methods:perf,canvas:{...window.__canvasCalls},visible:s.iluminacaoEmergencia.fontesVisiveis.length,
    image:s.textures.get("level1-parte2-escuridao").getSourceImage().toDataURL()};
  },config);
  writeFileSync(`/tmp/factory-light-${label}-${config.name}.png`,Buffer.from(result.image.split(",")[1],"base64"));
  delete result.image;report.push(result);console.log(JSON.stringify(result));
 }
 const {profile}=await cdp.send("Profiler.stop");
 writeFileSync(`/tmp/factory-light-${label}.cpuprofile`,JSON.stringify(profile));
 writeFileSync(`/tmp/factory-light-${label}.json`,JSON.stringify(report,null,2));
 console.log("ERRORS",JSON.stringify(session.errors));
} finally { await session.fechar(); }
