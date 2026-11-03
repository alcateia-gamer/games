import assert from "node:assert/strict";
import test from "node:test";
import {
  capturarJogadorNovoBoss,
  jogadorPresoNovoBoss,
  liberarJogadorNovoBoss,
  atualizarRestricaoNovoBoss,
} from "./PlayerControlEffects.js";

function criarCena(extra = {}) {
  const velocidades = [];
  const scene = {
    player: { active: true, setVelocity: (...args) => velocidades.push(args) },
    vida: 100,
    estadoDash: { ativo: true },
    novoBoss: { jogadorNaArena: true, morto: false, encerrado: false },
    ...extra,
  };
  return { scene, velocidades };
}

test("contenção cancela o dash e zera a velocidade, com duração em milissegundos", () => {
  const { scene, velocidades } = criarCena();
  assert.equal(capturarJogadorNovoBoss(scene, "tentaculo-a", 2500), true);
  assert.deepEqual(scene.restricaoControleNovoBoss, { fonte: "tentaculo-a", restanteMs: 2500 });
  assert.equal(jogadorPresoNovoBoss(scene), true);
  assert.equal(scene.estadoDash.ativo, false);
  assert.deepEqual(velocidades, [[0, 0]]);
  atualizarRestricaoNovoBoss(scene, 2499);
  assert.equal(jogadorPresoNovoBoss(scene), true);
  assert.equal(scene.restricaoControleNovoBoss.restanteMs, 1);
  atualizarRestricaoNovoBoss(scene, 1);
  assert.equal(scene.restricaoControleNovoBoss, null);
  assert.equal(jogadorPresoNovoBoss(scene), false);
});

test("cada fonte só pode liberar sua contenção e outra captura não renova o prazo", () => {
  const { scene, velocidades } = criarCena();
  capturarJogadorNovoBoss(scene, "tentaculo-a", 2500);
  atualizarRestricaoNovoBoss(scene, 1000);
  assert.equal(capturarJogadorNovoBoss(scene, "tentaculo-b", 3000), false);
  assert.deepEqual(scene.restricaoControleNovoBoss, { fonte: "tentaculo-a", restanteMs: 1500 });
  liberarJogadorNovoBoss(scene, "tentaculo-b");
  assert.equal(jogadorPresoNovoBoss(scene), true);
  assert.equal(velocidades.length, 1);
  liberarJogadorNovoBoss(scene, "tentaculo-a");
  assert.equal(scene.restricaoControleNovoBoss, null);
  liberarJogadorNovoBoss(scene, "tentaculo-a");
  assert.equal(scene.restricaoControleNovoBoss, null);
});

test("captura e liberação preservam os bloqueios de menu ou morte", () => {
  for (const bloqueio of [false, true, "inventario", undefined]) {
    const { scene } = criarCena({ movimentoBloqueado: bloqueio });
    capturarJogadorNovoBoss(scene, "tentaculo", 2500);
    assert.equal(scene.movimentoBloqueado, bloqueio);
    atualizarRestricaoNovoBoss(scene, 2500);
    assert.equal(scene.movimentoBloqueado, bloqueio);
    capturarJogadorNovoBoss(scene, "tentaculo", 2500);
    liberarJogadorNovoBoss(scene);
    assert.equal(scene.movimentoBloqueado, bloqueio);
  }
});

test("delta longo libera; deltas inválidos não alteram o tempo restante", () => {
  const { scene } = criarCena();
  capturarJogadorNovoBoss(scene, "tentaculo", 2500);
  for (const delta of [NaN, Infinity, -1, undefined]) {
    atualizarRestricaoNovoBoss(scene, delta);
    assert.equal(scene.restricaoControleNovoBoss.restanteMs, 2500);
  }
  atualizarRestricaoNovoBoss(scene, 10000);
  assert.equal(scene.restricaoControleNovoBoss, null);
  atualizarRestricaoNovoBoss(scene, 10000);
  assert.equal(jogadorPresoNovoBoss(scene), false);
});

test("morte, derrota, encerramento e saída da arena sempre devolvem o controle", () => {
  const estados = [
    scene => { scene.player.active = false; },
    scene => { scene.morteEmAndamento = true; },
    scene => { scene.vida = 0; },
    scene => { scene.novoBoss.morto = true; },
    scene => { scene.novoBoss.encerrado = true; },
    scene => { scene.novoBoss.jogadorNaArena = false; },
    scene => { scene.novoBoss = null; },
  ];
  for (const alterar of estados) {
    const { scene } = criarCena({ movimentoBloqueado: true });
    capturarJogadorNovoBoss(scene, "tentaculo", 2500);
    alterar(scene);
    atualizarRestricaoNovoBoss(scene, 0);
    assert.equal(scene.restricaoControleNovoBoss, null);
    assert.equal(jogadorPresoNovoBoss(scene), false);
    assert.equal(scene.movimentoBloqueado, true);
  }
});

test("capturas inválidas não criam restrição, cancelam dash ou alteram velocidade", () => {
  for (const [extra, duracao] of [
    [{ morteEmAndamento: true }, 2500],
    [{ vida: 0 }, 2500],
    [{ multiplayer: true }, 2500],
    [{ player: { active: false } }, 2500],
    [{ player: null }, 2500],
    [{}, 0], [{}, -1], [{}, NaN], [{}, Infinity],
  ]) {
    const { scene, velocidades } = criarCena(extra);
    assert.equal(capturarJogadorNovoBoss(scene, "tentaculo", duracao), false);
    assert.equal(scene.restricaoControleNovoBoss, undefined);
    assert.equal(scene.estadoDash.ativo, true);
    assert.deepEqual(velocidades, []);
  }
  assert.equal(capturarJogadorNovoBoss(null, "tentaculo", 2500), false);
  assert.equal(jogadorPresoNovoBoss(null), false);
  liberarJogadorNovoBoss(null);
  atualizarRestricaoNovoBoss(null, 100);
});

function cenaComCorpo() {
  const { scene } = criarCena();
  const player = scene.player;
  Object.assign(player, { x: 100, y: 100,
    setPosition(x,y) { this.x=x;this.y=y; },
  });
  player.body = { x:85,y:111,width:30,height:15,
    reset(x,y) { player.x=x;player.y=y; },
    updateFromGameObject() { this.x=player.x-15;this.y=player.y+11; },
  };
  scene.hitboxDanoPlayer = { x:85,y:80,width:30,height:46 };
  scene.collisionGroup = { getChildren: () => [] };
  return scene;
}

test("tentáculo puxa os pés do jogador em 180 ms, sincroniza hitbox e mantém 2,5 s sem dano", () => {
  const scene=cenaComCorpo(), ponto={x:115,y:100};
  assert.ok(capturarJogadorNovoBoss(scene,'ancorado',2500,ponto));
  assert.equal(scene.player.x,100);
  atualizarRestricaoNovoBoss(scene,90);
  assert.equal(scene.player.x,107.5);assert.equal(scene.player.y,87);
  assert.equal(scene.player.body.x,92.5);assert.equal(scene.hitboxDanoPlayer.x,92.5);
  atualizarRestricaoNovoBoss(scene,90);
  assert.equal(scene.player.x,115);assert.equal(scene.player.y,74);
  assert.equal(scene.hitboxDanoPlayer.y+scene.hitboxDanoPlayer.height,ponto.y);
  atualizarRestricaoNovoBoss(scene,2319);assert.ok(jogadorPresoNovoBoss(scene));
  atualizarRestricaoNovoBoss(scene,1);assert.equal(jogadorPresoNovoBoss(scene),false);
  assert.equal(scene.vida,100);
});

test("puxão recusa destino inválido e não atravessa parede fina, gerador ou escudo", () => {
  for(const tipo of ['parede','gerador','escudo','invalido']) {
    const scene=cenaComCorpo();
    const obstaculo={x:120,y:0,width:2,height:200,enable:true};
    if(tipo==='parede')scene.collisionGroup.getChildren=()=>[{body:obstaculo}];
    if(tipo==='gerador')scene.novoBoss.obstaculosTeleporte=[{body:obstaculo}];
    if(tipo==='escudo')scene.novoBoss.sistemaGeradores={corpoBarreira:{x:120,y:85,radius:20,isCircle:true,enable:true}};
    assert.equal(capturarJogadorNovoBoss(scene,'a',2500,{x:tipo==='invalido'?NaN:160,y:126}),false,tipo);
    assert.equal(scene.restricaoControleNovoBoss,undefined);
    assert.equal(scene.estadoDash.ativo,true);
    assert.equal(scene.player.x,100);
  }
});

test("cancelar ou um obstáculo novo durante o puxão devolve o controle sem mover através dele", () => {
  const scene=cenaComCorpo();
  assert.ok(capturarJogadorNovoBoss(scene,'a',2500,{x:160,y:126}));
  scene.collisionGroup.getChildren=()=>[{body:{x:120,y:0,width:2,height:200,enable:true}}];
  atualizarRestricaoNovoBoss(scene,180);
  assert.equal(scene.player.x,100);assert.equal(jogadorPresoNovoBoss(scene),false);
});

test('oito apertos libertam sem consumir tempo; segurar exige novas entradas do controle',async()=>{
  const {registrarApertoLibertacaoNovoBoss}=await import('./PlayerControlEffects.js');
  const {scene}=criarCena();scene.time={now:1000};
  assert.ok(capturarJogadorNovoBoss(scene,'tentaculo',2500,null,{apertos:8}));
  atualizarRestricaoNovoBoss(scene,60000);assert.ok(jogadorPresoNovoBoss(scene));
  for(let i=0;i<7;i++){assert.ok(registrarApertoLibertacaoNovoBoss(scene));assert.ok(jogadorPresoNovoBoss(scene));}
  assert.ok(registrarApertoLibertacaoNovoBoss(scene));assert.equal(jogadorPresoNovoBoss(scene),false);
  assert.equal(capturarJogadorNovoBoss(scene,'outro',2500),false);
  scene.time.now+=600;assert.equal(capturarJogadorNovoBoss(scene,'outro',2500),true);
});

test('puxão sincroniza os pontos anteriores usados pelo postUpdate real da física',()=>{
  const scene=cenaComCorpo(),b=scene.player.body;
  b.position={x:b.x,y:b.y};
  for(const chave of ['prev','prevFrame','autoFrame'])b[chave]={x:0,y:0,copy(p){Object.assign(this,p);}};
  const sincronizar=b.updateFromGameObject.bind(b);
  b.updateFromGameObject=()=>{sincronizar();b.position={x:b.x,y:b.y};};
  assert.ok(capturarJogadorNovoBoss(scene,'t',2500,{x:115,y:100}));
  atualizarRestricaoNovoBoss(scene,90);
  assert.equal(b.position.x,b.prevFrame.x);assert.equal(b.position.y,b.prevFrame.y);
  assert.equal(b.position.x,b.prev.x);assert.equal(b.position.y,b.autoFrame.y);
});
