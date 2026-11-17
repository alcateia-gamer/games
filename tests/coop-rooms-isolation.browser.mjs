/** Oito gerenciadores reais, duas salas MQTT locais. Não simula oito cenas de combate. */
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { writeFileSync } from "node:fs";
const require = createRequire(import.meta.url), root = process.env.COOP_TEST_TOOLS || "/tmp/nullborns-perf-tools";
const broker = require(`${root}/node_modules/aedes`)();
const { WebSocketServer, createWebSocketStream } = require(`${root}/node_modules/ws`);
const server = new WebSocketServer({ host:"127.0.0.1",port:18885 });
server.on("connection",socket => broker.handle(createWebSocketStream(socket)));
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
const browser = await chromium.launch({headless:true,args:["--no-sandbox","--disable-dev-shm-usage"]});
const checks = [];
let page;
try {
  page = await browser.newPage();
  page.setDefaultTimeout(15000);
  await page.goto(process.env.BASE_URL || "http://127.0.0.1:8765/");
  await page.addScriptTag({path:`${root}/node_modules/mqtt/dist/mqtt.min.js`});
  await page.evaluate(async () => {
    const {default:Client}=await import("/js/mqttClient.js");
    const {default:Manager}=await import("/js/multiplayer/multiplayerManager.js");
    window.__rooms = Array.from({length:8},()=>{
      const client=new Client({brokerUrl:"ws://127.0.0.1:18885",topicPrefix:"stage3-isolation"});
      const manager=new Manager(client), frames=[];
      manager.on("coopFrame",packet=>frames.push({code:packet.roomCode,target:packet.targets[0]?.id}));
      return {manager,client,frames};
    });
  });
  await page.waitForFunction(()=>window.__rooms.every(r=>r.client.connected));
  const codes=await page.evaluate(()=>[window.__rooms[0].manager.createRoom(),window.__rooms[4].manager.createRoom()]);
  assert.notEqual(codes[0],codes[1]);
  for(let count=2;count<=4;count++) {
    await page.evaluate(({count,codes})=>{
      window.__rooms[count-1].manager.joinRoom(codes[0]);
      window.__rooms[count+3].manager.joinRoom(codes[1]);
    },{count,codes});
    await page.waitForFunction(count=>[0,4].every(i=>window.__rooms[i].manager.room?.players.length===count),count);
    checks.push(`duas salas com ${count} jogadores e hosts distintos`);
  }
  await page.evaluate(()=>{window.__rooms[3].manager.leaveRoom();window.__rooms[7].manager.leaveRoom();});
  await page.waitForFunction(()=>[0,4].every(i=>window.__rooms[i].manager.room.players.length===3));
  await page.evaluate(codes=>{window.__rooms[3].manager.joinRoom(codes[0]);window.__rooms[7].manager.joinRoom(codes[1]);},codes);
  await page.waitForFunction(()=>window.__rooms.every(r=>r.manager.room?.players.length===4));
  checks.push("saída e reentrada no lobby sem cruzar salas");
  await page.evaluate(()=>{
    const characters=["kai-mercer","magnus-force","aria-kade","nyx"];
    window.__rooms.forEach((r,i)=>{r.manager.selectCharacter(characters[i%4]);r.manager.setReady(true);});
  });
  await page.waitForFunction(()=>[0,4].every(i=>window.__rooms[i].manager.canStart()));
  await page.evaluate(()=>{window.__rooms[0].manager.startGame();window.__rooms[4].manager.startGame();});
  await page.waitForFunction(()=>window.__rooms.every(r=>r.manager.room?.status==="PLAYING"));
  await page.evaluate(()=>{
    window.__rooms.forEach((r,i)=>{r.manager.enableCoop();r.manager.sendPlayerState(i*100,10,"down",false,false,"down",0,"normal",[],{mapKey:"Level1"});});
  });
  await page.waitForFunction(()=>[0,4].every(start=>window.__rooms[start].manager.room.players.every(p=>{
    const index=window.__rooms.findIndex(r=>r.manager.playerId===p.id);return index>=start&&index<start+4&&p.x===index*100;
  })));
  await page.evaluate(()=>{
    for(const i of [0,4]) window.__rooms[i].manager.publishCoopFrame({mapKey:"Level1",streamId:`stream-${i}`,
      visuals:{full:true,changed:[],removed:[]},targets:[{id:`enemy-${i}`,vida:100}]});
  });
  await page.waitForFunction(()=>[1,2,3,5,6,7].every(i=>window.__rooms[i].frames.length>0));
  const isolated = await page.evaluate(codes=>window.__rooms.every((r,i)=>r.frames.every(f=>
    f.code===codes[i<4?0:1]&&f.target===`enemy-${i<4?0:4}`)),codes);
  assert.equal(isolated,true);
  checks.push("entradas e frames de duas partidas com quatro participantes permanecem isolados");
  await page.evaluate(()=>window.__rooms[0].manager.leaveRoom());
  await page.waitForFunction(()=>[1,2,3].every(i=>{
    const m=window.__rooms[i].manager;return m.room?.players.length===3&&m.room.hostId!==window.__rooms[0].manager.playerId;
  }));
  assert.equal(await page.evaluate(()=>[4,5,6,7].every(i=>window.__rooms[i].manager.room.hostId===window.__rooms[4].manager.playerId)),true);
  checks.push("migração de host na primeira sala preserva host e jogadores da segunda");
  writeFileSync("/tmp/nullborns-stage3-rooms.json",JSON.stringify({passed:true,scope:"MQTT/Manager sem cenas de combate",checks},null,2));
  console.log(JSON.stringify({passed:true,checks}));
} finally {
  await page?.evaluate(()=>window.__rooms?.forEach(r=>r.manager.destroy())).catch(()=>{});
  await browser.close();
  await new Promise(resolve=>server.close(resolve));
  await new Promise(resolve=>broker.close(resolve));
}
