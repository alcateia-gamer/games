import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { candidatosAreaRoboBola, criarSpawnAreasRoboBola, distanciaAteAreaRoboBola,
  lerAreasRoboBola, planejarOndasFabrica, pontoLivreAreaRoboBola, quantidadeRobosArea } from "./RoboBolaSpawnAreas.js";
import { criarFugaRoboBola } from "./RoboBolaFuga.js";
import { CORPO_ROBO_BOLA, ampliarAreaNascimento, obterPisoSpawnRobos, retanguloCorpoSpawnRoboBola } from './EnemySpawnValidation.js';
import { criarAcessoSpawnFabrica } from "./FactorySpawnAccess.js";
import { exigirNascimentoDaArea } from "../../tests/factory-wave-assertions.mjs";
import { caminhoDiretoBloqueado, retanguloLivreDoMapa } from "./EnemyPathfinding.js";
import { carregarMapaSpawns } from '../../tests/spawn-map-fixture.mjs';

function preparar(area = { id: 1, x: 0, y: 0, width: 500, height: 600 }) {
  const scene = { map: { getObjectLayer: () => ({ objects: Array.isArray(area) ? area : [area] }), layers: [] },
    events: new EventEmitter(), time: { now: 0 }, inimigos: [], vida: 100,
    luzFabricaAcesa: true, player: { x: -150, y: 200, active: true } };
  const criar = (_s, ponto) => {
    const robo = { ...ponto, active: true, body: { center: { ...ponto }, enable: true },
      destroy() { this.active = false; } }; scene.inimigos.push(robo); return robo;
  };
  return { scene, sistema: criarSpawnAreasRoboBola(scene, criar) };
}

test("aproximação usa a borda e os cantos do retângulo, não a distância ao centro", () => {
  const a = { x: 0, y: 0, width: 1000, height: 1000 };
  assert.equal(distanciaAteAreaRoboBola({ x: -180, y: 900 }, a), 180);
  assert.equal(distanciaAteAreaRoboBola({ x: 500, y: 500 }, a), 0);
  assert.equal(distanciaAteAreaRoboBola({ x: -30, y: -40 }, a), 50);
});

test("gerador desligado e aproximação distante nunca ativam a onda", () => {
  const { scene, sistema } = preparar();
  scene.luzFabricaAcesa = false;
  sistema.atualizar(5000);
  assert.equal(sistema.snapshot()[0].ativada, false);
  scene.luzFabricaAcesa = true; scene.player.x = -181;
  sistema.atualizar(5000);
  assert.equal(scene.inimigos.length, 0);
  scene.player.x = -180;
  sistema.atualizar(16);
  assert.equal(scene.inimigos.length, 1, "ativa do lado de fora pela borda");
});

test("área define quantidades proporcionais com limite de sete", () => {
  assert.equal(quantidadeRobosArea({ width: 57, height: 61 }), 1);
  assert.equal(quantidadeRobosArea({ width: 200, height: 300 }), 2);
  assert.equal(quantidadeRobosArea({ width: 500, height: 600 }), 7);
  assert.equal(quantidadeRobosArea({ width: 10000, height: 10000 }), 7);
});

test("onda é progressiva e reaproximação não repõe robôs mortos", () => {
  const { scene, sistema } = preparar();
  sistema.atualizar(1);
  assert.equal(scene.inimigos.length, 1);
  sistema.atualizar(449);
  assert.equal(scene.inimigos.length, 1);
  for (let i = 0; i < 30; i++) sistema.atualizar(450);
  assert.equal(scene.inimigos.length, 6);
  scene.inimigos.forEach(r => { r.morto = true; });
  scene.player.x = -1000; sistema.atualizar(1000);
  scene.player.x = -150; sistema.atualizar(1000);
  assert.equal(scene.inimigos.length, 6);
});

test("áreas pequenas usam o entorno; corpo e margem ficam fora dos obstáculos", () => {
  const area = { x: 0, y: 0, width: 57, height: 61 };
  const proxima = ampliarAreaNascimento(area);
  for (const p of candidatosAreaRoboBola(area)) {
    assert.ok(p.x - 36.8 >= proxima.x - .0001 && p.x + 36.8 <= proxima.x + proxima.width + .0001);
    assert.ok(p.y - 36.8 >= proxima.y - .0001 && p.y + 36.8 <= proxima.y + proxima.height + .0001);
  }
  const { scene, sistema } = preparar({ id: 2, x: 0, y: 0, width: 400, height: 400 });
  scene.collisionGroup = { getChildren: () => [{ body: { x: 100, y: 100, width: 200, height: 200 } }] };
  for (let i = 0; i < 10; i++) sistema.atualizar(450);
  assert.equal(scene.inimigos.length, 3);
  for (const p of scene.inimigos) {
    assert.ok(p.x + 36.8 <= 100 || p.x - 36.8 >= 300 || p.y + 36.8 <= 100 || p.y - 36.8 >= 300);
  }
});

test("área e entorno ocupados aguardam uma nova posição livre sem forçar spawn", () => {
  const { scene, sistema } = preparar({ id: 3, x: 0, y: 0, width: 57, height: 61 });
  scene.player.x = 28; scene.player.y = 30;
  scene.collisionGroup = { getChildren: () => [{ body: ampliarAreaNascimento({ x: 0, y: 0, width: 57, height: 61 }) }] };
  sistema.atualizar(1000);
  assert.equal(sistema.snapshot()[0].ativada, true);
  assert.equal(scene.inimigos.length, 0);
  scene.collisionGroup = { getChildren: () => [] };
  scene.player.x = -100;
  for (let quadro = 0; quadro < 20 && !scene.inimigos.length; quadro++) sistema.atualizar(450);
  assert.equal(scene.inimigos.length, 1);
});

test('retângulo ocupado por máquina usa o entorno e espalha a onda inteira', () => {
  const area = { id: 10, x: 0, y: 0, width: 400, height: 400 };
  const { scene, sistema } = preparar(area);
  scene.collisionGroup = { getChildren: () => [{ body: area }] };
  for (let i = 0; i < 20; i++) sistema.atualizar(450);
  assert.equal(scene.inimigos.length, 3);
  for (const [i, p] of scene.inimigos.entries()) {
    assert.ok(p.x + 36.8 <= 0 || p.x - 36.8 >= 400 || p.y + 36.8 <= 0 || p.y - 36.8 >= 400,
      '20px de folga além do corpo físico');
    for (const outro of scene.inimigos.slice(0, i)) assert.ok(Math.hypot(p.x - outro.x, p.y - outro.y) >= 120);
  }
});

test("parede total e piso ausente não geram robôs sobre colisões nem no vazio", () => {
  const { scene, sistema } = preparar();
  scene.collisionGroup = { getChildren: () => [{ body: ampliarAreaNascimento({ x: 0, y: 0, width: 500, height: 600 }) }] };
  sistema.atualizar(1000);
  assert.equal(scene.inimigos.length, 0);
  assert.equal(pontoLivreAreaRoboBola(scene, { x: 600, y: 600 }, { contem: () => false }), false);
});

test("host pode ativar por aliado remoto; cliente, morte e shutdown não criam inimigos", () => {
  const { scene, sistema } = preparar();
  scene.multiplayer = true; scene.isMultiplayerHost = false;
  sistema.atualizar(1000); assert.equal(scene.inimigos.length, 0);
  scene.isMultiplayerHost = true; scene.vida = 0;
  sistema.atualizar(1000); assert.equal(scene.inimigos.length, 0);
  scene.vida = 100; scene.player.x = -2000;
  scene.remotePlayers = new Map([["aliado", { active: true, x: -150, y: 200 }]]);
  sistema.atualizar(1000); assert.equal(scene.inimigos.length, 1);
  scene.events.emit("shutdown");
  sistema.atualizar(1000); assert.equal(scene.inimigos.length, 1);
  assert.equal(scene.events.listenerCount("shutdown"), 0);
});

test("mapa real contém 18 áreas; todas têm candidatos livres ao redor das colisões", () => {
  const { scene } = carregarMapaSpawns('parte2-fase1.json');
  const areas = lerAreasRoboBola(scene.map);
  assert.equal(areas.length, 18);
  assert.equal(areas.reduce((soma, a) => soma + quantidadeRobosArea(a), 0), 53);
  for (const equipe of [1, 2, 3, 4]) {
    const jogo = preparar(areas);
    jogo.scene.multiplayer = equipe > 1;
    jogo.scene.isMultiplayerHost = true;
    jogo.scene.remotePlayers = new Map(Array.from({ length: equipe - 1 }, (_, i) =>
      [i, { active: true, x: 0, y: 0 }]));
    const cotas = jogo.sistema.snapshot();
    assert.equal(cotas.reduce((soma, a) => soma + a.total, 0), 35);
    assert.ok(cotas.filter(a => quantidadeRobosArea(a) === 1).every(a => a.total === 1));
  }
  for (const a of areas) {
    assert.ok(quantidadeRobosArea(a) <= 7);
    assert.ok(candidatosAreaRoboBola(a, undefined, 8).some(p => pontoLivreAreaRoboBola(scene, p)), `área ${a.id}`);
  }
});

test("três retângulos junto de (-1067, -4478) continuam abaixo do limite regional de sete", () => {
  const dados = JSON.parse(readFileSync(new URL("../../assets/map/parte2-fase1.json", import.meta.url)));
  const { scene, sistema } = preparar(dados.layers.find(l => l.name === "SpawnRoboBola").objects);
  const ids = [1625, 1629, 1630];
  const cotas = sistema.snapshot().filter(a => ids.includes(a.id));
  assert.deepEqual(cotas.map(a => [a.id, a.total]), [[1625, 2], [1629, 2], [1630, 2]]);
  assert.equal(sistema.snapshot().find(a => a.id === 1627).total, 2, "retângulo vizinho segue a redução global");
  for (const [x, y] of [[-1067, -4478], [-1100, -4180], [-1067, -4478]]) {
    Object.assign(scene.player, { x, y });
    for (let i = 0; i < 30; i++) sistema.atualizar(450);
  }
  const robosRegiao = scene.inimigos.filter(r => ids.includes(r.spawnAreaRoboBolaId));
  assert.equal(robosRegiao.length, 6);
  robosRegiao.forEach(r => { r.morto = true; });
  for (let i = 0; i < 30; i++) sistema.atualizar(450);
  assert.equal(scene.inimigos.filter(r => ids.includes(r.spawnAreaRoboBolaId)).length, 6,
    "derrotar os robôs não libera mais spawns nos retângulos da região");
});

test("fuga usa o corpo atual, reinicia pela câmera ou pelo combate e não repõe a unidade", () => {
  const { scene, sistema } = preparar({ id: 1, x: 0, y: 0, width: 100, height: 100 });
  scene.player.y = 30;
  sistema.atualizar(1);
  const [robo] = scene.inimigos;
  const portal = { active: true, prologoEncontroId: "portal", spawnAreaRoboBolaId: 1,
    x: robo.x, y: robo.y };
  scene.inimigos.push(portal);
  scene.inimigoTeste = robo;
  const fuga = criarFugaRoboBola(scene);
  scene.player.x = 3000;
  robo.body.center.x = 2800;
  for (let t = 0; t <= 3500; t += 500) fuga(t);
  assert.equal(robo.active, true, "continua acompanhando pelo corredor");

  robo.body.center.x = 0;
  fuga(4000);
  fuga(4500);
  scene.player.x = 800;
  fuga(5000);
  scene.player.x = 3000;
  scene.cameras = { main: { worldView: { x: -400, y: -225, right: 400, bottom: 225 } } };
  for (let t = 5500; t <= 9000; t += 500) fuga(t);
  assert.equal(robo.active, true, "continua enquadrado pela câmera");

  scene.cameras.main.worldView = { x: 2600, y: -225, right: 3400, bottom: 225 };
  robo.alerta = true;
  robo.ultimoCombateOnda = 9500;
  for (let t = 9500; t < 15500; t += 500) fuga(t);
  assert.equal(robo.active, true);
  fuga(15500);
  assert.deepEqual(scene.inimigos, [portal]);
  assert.equal(scene.inimigoTeste, portal);
  assert.equal(robo.body.enable, false);

  scene.player.x = -150;
  sistema.atualizar(450);
  assert.equal(sistema.snapshot()[0].invocados, 1);
  assert.deepEqual(scene.inimigos, [portal]);

  const novoHost = preparar({ id: 1, x: 0, y: 0, width: 100, height: 100 });
  novoHost.scene.player.y = 30;
  novoHost.sistema.restaurar(sistema.progresso());
  novoHost.sistema.restaurar({ 1: 0 });
  novoHost.sistema.atualizar(450);
  assert.equal(novoHost.sistema.snapshot()[0].invocados, 1);
  assert.equal(novoHost.scene.inimigos.length, 0);
});

for (const runtime of [false, true]) {
  test(`fuga coop ${runtime ? "atual" : "legada"} espera aliado caído e posição indisponível`, () => {
    const { scene, sistema } = preparar({ id: 1, x: 0, y: 0, width: 100, height: 100 });
    scene.player.y = 30;
    sistema.atualizar(1);
    const [robo] = scene.inimigos;
    scene.multiplayer = true;
    scene.coopRuntime = runtime ? {} : null;
    scene.player.x = 3000;
    scene.morteEmAndamento = true;
    const remoto = { x: 0, y: 0, active: true, morto: true };
    const dados = { id: "aliado", ...remoto, mapKey: "Level1Parte2", positionKnown: true,
      positionReceivedAt: Date.now() };
    scene.remotePlayers = new Map([["aliado", remoto]]);
    scene.multiplayerManager = { playerId: "host", room: { players: [dados] } };
    const fuga = criarFugaRoboBola(scene);
    for (let t = 0; t <= 3500; t += 500) fuga(t);
    scene.isMultiplayerHost = true;
    for (let t = 4000; t <= 7500; t += 500) fuga(t);
    assert.equal(robo.active, true);

    dados.x = remoto.x = 3000;
    fuga(8000);
    fuga(8500);
    dados.positionKnown = false;
    for (let t = 9000; t <= 12500; t += 500) fuga(t);
    assert.equal(robo.active, true);

    dados.positionKnown = true;
    for (let t = 13000; t < 16000; t += 500) fuga(t);
    assert.equal(robo.active, true);
    fuga(16000);
    assert.equal(scene.inimigos.length, 0);
  });
}

test("área 1621 compartilha orçamento, encontra o fim da grade e revalida antes de nascer", t => {
  const { map } = carregarMapaSpawns("parte2-fase1.json");
  const area = lerAreasRoboBola(map).find(a => a.id === 1621);
  const detalhados = candidatosAreaRoboBola(area, undefined, 8);
  const grossos = candidatosAreaRoboBola(area);
  const indice = detalhados.length - 300;
  const vaga = detalhados[indice];
  assert.equal(detalhados.length, 6925);
  assert.ok(!grossos.some(p => p.x === vaga.x && p.y === vaga.y));
  const { scene, sistema } = preparar(area);
  Object.assign(scene.player, { x: area.x - 120, y: area.y + area.height / 2 });
  const montar = (janela) => {
    const r = 36.85, limite = 30000;
    const ret = (x, y, right, bottom) => ({ body: { x, y, width: right - x, height: bottom - y } });
    const paredes = janela ? [
      ret(-limite, -limite, vaga.x - r, limite), ret(vaga.x + r, -limite, limite, limite),
      ret(vaga.x - r, -limite, vaga.x + r, vaga.y - r), ret(vaga.x - r, vaga.y + r, vaga.x + r, limite),
    ] : [ret(-limite, -limite, limite, limite)];
    scene.collisionGroup = { getChildren: () => paredes };
  };
  const medir = { gerados: 0, avaliados: 0, areas: 0 };
  function passo(delta = 16) {
    sistema.atualizar(delta);
    const stats = sistema.trabalhoUltimaAtualizacao();
    for (const chave of Object.keys(medir)) medir[chave] = Math.max(medir[chave], stats[chave]);
    return stats;
  }
  montar(false);
  for (let i = 0; i < 16; i++) passo();
  assert.equal(scene.inimigos.length, 0);
  montar(true);
  assert.ok(pontoLivreAreaRoboBola(scene, vaga));
  let total = 0;
  for (let i = 0; i < 55 && total <= grossos.length + indice; i++) total += passo().gerados;
  assert.ok(total > grossos.length + indice && total < grossos.length + detalhados.length);
  montar(false);
  const revalidacao = passo();
  assert.equal(revalidacao.revalidados, 1);
  assert.equal(sistema.snapshot()[0].invocados, 0);

  montar(true);
  for (let i = 0; i < 65 && scene.inimigos.length === 0; i++) passo();
  assert.deepEqual(scene.inimigos.map(({ x, y }) => ({ x, y })), [vaga]);
  assert.equal(medir.gerados, 512);
  assert.equal(medir.avaliados, 512);

  const simultaneas = preparar([area, { ...area, id: 9999, y: area.y + 1000 }]);
  simultaneas.scene.multiplayer = simultaneas.scene.isMultiplayerHost = true;
  simultaneas.scene.player = { ...scene.player };
  simultaneas.scene.remotePlayers = new Map([["aliado", { ...scene.player, y: scene.player.y + 1000 }]]);
  simultaneas.scene.collisionGroup = { getChildren: () => [{ body: { x: -30000, y: -30000, width: 60000, height: 60000 } }] };
  simultaneas.sistema.atualizar(16);
  const compartilhado = simultaneas.sistema.trabalhoUltimaAtualizacao();
  assert.deepEqual(compartilhado, { areas: 2, gerados: 512, avaliados: 512, revalidados: 0,
    consultasNascimento: 512, consultasNavegacao: 0, navegacaoPendente: false });
  t.diagnostic(JSON.stringify({ antesMaximo: grossos.length + detalhados.length, medir, compartilhado }));
});

test("host caído autoriza o aliado em área nova e a perda da autoridade cancela busca pendente", () => {
  const areas = [{ id: 1, x: 0, y: 0, width: 60, height: 60 },
    { id: 2, x: 2000, y: 0, width: 60, height: 60 },
    { id: 3, x: 4500, y: 0, width: 650, height: 600 }];
  const { scene, sistema } = preparar(areas);
  scene.multiplayer = scene.isMultiplayerHost = true;
  scene.player.y = 30;
  const aliado = { active: true, x: 1000, y: 30 };
  scene.remotePlayers = new Map([["aliado", aliado]]);
  sistema.atualizar(16);
  assert.deepEqual(sistema.progresso(), { 1: 1 });
  scene.morteEmAndamento = true; scene.vida = 0;
  aliado.x = 1850;
  sistema.atualizar(16);
  assert.deepEqual(sistema.progresso(), { 1: 1, 2: 1 });
  aliado.morto = true; aliado.x = 4350;
  sistema.atualizar(16);
  assert.deepEqual(sistema.progresso(), { 1: 1, 2: 1 });
  scene.morteEmAndamento = false; scene.vida = 100; aliado.morto = false;
  sistema.atualizar(16);
  assert.equal(sistema.trabalhoUltimaAtualizacao().gerados, 512);
  scene.isMultiplayerHost = false;
  sistema.atualizar(16);
  assert.equal(sistema.trabalhoUltimaAtualizacao().gerados, 0);
  assert.deepEqual(sistema.progresso(), { 1: 1, 2: 1, 3: 0 });
  const novo = preparar(areas);
  novo.scene.player = { ...aliado };
  novo.sistema.restaurar(sistema.progresso());
  for (let i = 0; i < 6; i++) novo.sistema.atualizar(16);
  assert.equal(novo.scene.inimigos.length, 1);
  assert.deepEqual(novo.sistema.progresso(), { 1: 1, 2: 1, 3: 1 });
});

function fabricaComPortas() {
  const { scene, map } = carregarMapaSpawns("parte2-fase1.json");
  const porta01 = map.objects.flatMap(layer => layer.objects).find(o => o.name === "porta01");
  // As outras persianas são reconhecidas pelos tiles Portas em FactoryDoor.js.
  const areasPortas = [porta01, { x: 240, y: -1920, width: 144, height: 96 },
    { x: -1248, y: -5328, width: 144, height: 96 }, { x: -1056, y: -5328, width: 144, height: 96 }];
  scene.portasFabrica = areasPortas.map(({ x, y, width, height }) => ({
    colisao: scene.collisionGroup.create(x + width / 2, y + height / 2)
      .setDisplaySize(width, height).refreshBody(),
  }));
  return { scene, map };
}

test("mapa real separa os trechos pelas portas e rejeita colisões e ilhas de piso", () => {
  const { scene, map } = fabricaComPortas();
  const piso = obterPisoSpawnRobos(scene);
  const acesso = criarAcessoSpawnFabrica(scene, piso);
  const entrada = { x: 98, y: -1040 };
  function preencher(jogadores) {
    for (let i = 0; i < 120; i++) if (acesso.atualizar(jogadores)) return;
    assert.fail("componentes ainda pendentes");
  }
  const areas = planejarOndasFabrica(map);
  const centros = () => areas.filter(a => acesso.alcanca({ x: a.x + a.width / 2, y: a.y + a.height / 2 }));
  preencher([entrada]);
  assert.deepEqual(centros().map(a => a.id), [1608, 1610, 1613]);
  assert.deepEqual(areas.filter(a => a.trecho === 1).map(a => a.id), centros().map(a => a.id));

  const colisao = { x: -1081, y: -1588.53 };
  assert.equal(retanguloLivreDoMapa(scene, retanguloCorpoSpawnRoboBola(colisao)), false);
  assert.equal(pontoLivreAreaRoboBola(scene, colisao, piso), false);
  const detour = { x: -1081, y: -1304 };
  assert.ok(caminhoDiretoBloqueado(scene, entrada, detour));
  assert.ok(pontoLivreAreaRoboBola(scene, detour, piso) && acesso.alcanca(detour));

  const ilha = { x: -1246.4091, y: -1247.3159 };
  const primeira = areas.find(a => a.id === 1608);
  assert.ok(ilha.x < primeira.x && ilha.x >= ampliarAreaNascimento(primeira).x);
  assert.ok(pontoLivreAreaRoboBola(scene, ilha, piso));
  assert.equal(acesso.alcanca(ilha), false);
  const segundoTrecho = { x: 1041, y: -2747 };
  assert.ok(pontoLivreAreaRoboBola(scene, segundoTrecho, piso));
  assert.equal(acesso.alcanca(segundoTrecho), false);
  const cliente = { x: 985, y: -2326 };
  preencher([entrada, cliente]);
  assert.ok(acesso.alcanca(segundoTrecho, acesso.componentesDos([cliente])));
  assert.equal(acesso.alcanca(segundoTrecho, acesso.componentesDos([entrada])), false);

  for (const { colisao: porta } of scene.portasFabrica.slice(0, 2)) porta.body.enable = false;
  preencher([entrada]);
  assert.ok(acesso.alcanca(segundoTrecho));
  assert.equal(acesso.alcanca(ilha), false);
  assert.equal(centros().length, 18);

  const subtotais = [1, 2].map(trecho => ["original", "atual", "total"]
    .map(chave => areas.filter(a => a.trecho === trecho).reduce((soma, a) => soma + a[chave], 0)));
  assert.deepEqual(subtotais, [[8, 5, 6], [36, 30, 29]]);
  assert.deepEqual(areas.filter(a => a.atual !== a.total).map(a => [a.id, a.total]), [[1608, 2], [1621, 4]]);
});

test("o ponto restaurado 1608 gera dois corpos acessíveis, com cadência e espaço", () => {
  const { scene } = fabricaComPortas();
  const piso = obterPisoSpawnRobos(scene);
  Object.assign(scene.player, { x: -1080, y: -1140 });
  const fonte = readFileSync(new URL("../libs/phaser.min.js", import.meta.url), "utf8");
  const contexto = { module: { exports: {} }, exports: {} };
  vm.runInNewContext(fonte.replace("i(85454)})());", "i(37742)})());"), contexto);
  const Body = contexto.module.exports;
  const { quadro, tamanho, escala } = CORPO_ROBO_BOLA;
  const offset = (quadro - tamanho) / 2;
  const sistema = criarSpawnAreasRoboBola(scene, (_scene, ponto, _perfil, _portal, _id, validarCentro) => {
    const robo = { ...ponto, active: true, angle: 0, scaleX: escala, scaleY: escala,
      width: quadro, height: quadro, displayWidth: quadro * escala, displayHeight: quadro * escala,
      displayOriginX: quadro / 2, displayOriginY: quadro / 2,
      frame: { realWidth: quadro, realHeight: quadro },
      getCenter() { return { x: this.x, y: this.y }; },
    };
    robo.body = new Body({ defaults: {} }, robo);
    robo.body.setSize(tamanho, tamanho).setOffset(offset, offset).updateFromGameObject();
    assert.ok(validarCentro(robo.body.center));
    assert.ok(Math.abs(robo.body.width - 33.6) < 1e-6);
    const previsto = retanguloCorpoSpawnRoboBola(ponto);
    assert.ok(Math.abs(robo.body.x - previsto.x) < 1e-6);
    assert.ok(Math.abs(robo.body.y - previsto.y) < 1e-6);
    assert.ok(Math.abs(robo.body.height - previsto.height) < 1e-6);
    scene.inimigos.push(robo);
    return robo;
  });
  for (let i = 0; i < 50 && !scene.inimigos.length; i++) sistema.atualizar(40);
  assert.equal(scene.inimigos.length, 1);
  sistema.atualizar(449);
  assert.equal(scene.inimigos.length, 1);
  for (let i = 0; i < 80 && scene.inimigos.length < 2; i++) sistema.atualizar(16);
  assert.equal(scene.inimigos.length, 2);
  const acesso = criarAcessoSpawnFabrica(scene, piso);
  while (!acesso.atualizar([scene.player])) {}
  for (const robo of scene.inimigos) {
    assert.equal(robo.spawnAreaRoboBolaId, 1608);
    const corpo = retanguloCorpoSpawnRoboBola(robo, 20, robo.body);
    assert.ok(piso.contem(corpo) && retanguloLivreDoMapa(scene, corpo));
    assert.ok(acesso.alcanca(robo.body.center));
  }
  const [a, b] = scene.inimigos;
  assert.ok(Math.hypot(a.x - b.x, a.y - b.y) >= 120);
});

test("corpo de 15 px encostado conta como acesso também para o aliado remoto", () => {
  const { scene } = fabricaComPortas();
  const piso = obterPisoSpawnRobos(scene);
  const acesso = criarAcessoSpawnFabrica(scene, piso);
  const corpo = { x: -1275.75, y: -1344.75, width: 30, height: 15,
    center: { x: -1260.75, y: -1337.75 } };
  const aliado = { active: true, body: corpo, x: -1260.75, y: -1350 };
  assert.ok(retanguloLivreDoMapa(scene, corpo));
  while (!acesso.atualizar([aliado])) {}
  assert.ok(acesso.alcanca({ x: -1081, y: -1304 }));
  corpo.y -= 0.25;
  assert.equal(retanguloLivreDoMapa(scene, corpo), false);
  acesso.atualizar([aliado]);
  assert.equal(acesso.alcanca({ x: -1081, y: -1304 }), false);
  corpo.y += 0.25;

  scene.multiplayer = scene.isMultiplayerHost = true;
  scene.multiplayerManager = { room: { players: [{ id: "cliente", mapKey: "Level1Parte2" }] } };
  scene.remotePlayers = new Map([["cliente", aliado]]);
  Object.assign(scene.player, { x: 98, y: -1040 });
  const sistema = criarSpawnAreasRoboBola(scene, (_s, ponto) => {
    const novo = { ...ponto, active: true };
    scene.inimigos.push(novo);
    return novo;
  });
  for (let i = 0; i < 120 && !scene.inimigos.some(r => r.spawnAreaRoboBolaId === 1608); i++) sistema.atualizar(16);
  assert.ok(scene.inimigos.some(r => r.spawnAreaRoboBolaId === 1608), "host em outra sala respeita corpo do aliado");

  const outroLado = { collisionGroup: { getChildren: () => [{ body: { x: -100, y: 0, width: 200, height: 30 } }] } };
  const norte = criarAcessoSpawnFabrica(outroLado, { contem: r => r.x >= -100 && r.y >= -96 &&
    r.x + r.width <= 100 && r.y + r.height <= 32 });
  while (!norte.atualizar([{ body: { x: -15, y: -15, width: 30, height: 15, center: { x: 0, y: -8 } } }])) {}
  assert.ok(norte.alcanca({ x: 0, y: -48 }));
});

test("refina a passagem de 32 px fora da grade, mantém bloqueios e não corta quinas", () => {
  const piso = { contem: r => r.x >= -108 && r.y >= -108 && r.x + r.width <= 108 && r.y + r.height <= 108 };
  const origem = { x: 6, y: -72 }, destino = { x: 6, y: 72 };
  const ret = (x, y, width, height) => ({ body: { x, y, width, height, enable: true } });
  const criar = (limite, largura, porta = null) => {
    const paredes = [ret(-108, -36, limite + 108, 72), ret(limite + largura, -36, 108 - limite - largura, 72)];
    if (porta) paredes.push(porta);
    return { collisionGroup: { getChildren: () => paredes }, portasFabrica: porta ? [{ colisao: porta }] : [] };
  };
  const avaliar = (scene, inicio = origem, fim = destino) => {
    const acesso = criarAcessoSpawnFabrica(scene, piso);
    for (let i = 0; i < 150; i++) {
      if (!acesso.atualizar([inicio], 96)) continue;
      const ok = acesso.alcanca(fim);
      if (ok || !acesso.pendente) return ok;
    }
    assert.fail("refinamento com orçamento não concluiu");
  };
  for (const centro of [0, 3, 6, 9, 10.5, -6]) {
    const cena = criar(centro - 16, 32);
    assert.ok(retanguloLivreDoMapa(cena, { x: centro - 15, y: -79.5, width: 30, height: 159 }));
    assert.ok(avaliar(cena, { ...origem, x: centro }, { ...destino, x: centro }), `corredor em x=${centro}`);
  }
  assert.equal(avaliar(criar(-8, 29)), false);
  assert.equal(avaliar(criar(-10, 32, ret(-10, -6, 32, 12))), false);
  const quinas = { collisionGroup: { getChildren: () => [ret(-108, 0, 108, 108), ret(0, -108, 108, 108)] } };
  assert.equal(avaliar(quinas, { x: -50, y: -48 }, { x: 50, y: 48 }), false);
  // A ilha do mapa real continua bloqueada no teste anterior, com e sem as portas.
});

test("as 18 ondas elegíveis precisam gerar uma unidade própria dentro do prazo", () => {
  const { scene, map } = fabricaComPortas();
  const areas = planejarOndasFabrica(map);
  for (const area of [...areas].sort((a, b) => a.trecho - b.trecho)) {
    if (area.trecho === 2) for (const p of scene.portasFabrica.slice(0, 2)) p.colisao.body.enable = false;
    Object.assign(scene.player, area.id === 1608 ? { x: -1080, y: -1140 } :
      { x: area.x + area.width / 2, y: area.y + area.height / 2 });
    scene.inimigos = [];
    const sistema = criarSpawnAreasRoboBola(scene, (_s, ponto) => {
      const novo = { ...ponto, active: true };
      scene.inimigos.push(novo);
      return novo;
    });
    sistema.restaurar(Object.fromEntries(areas.filter(a => a !== area).map(a => [a.id, a.total])));
    const minimo = area.id === 1608 ? 2 : 1;
    for (let i = 0; i < 360 && scene.inimigos.length < minimo; i++) sistema.atualizar(16);
    const estado = { id: area.id, invocados: sistema.snapshot().find(a => a.id === area.id).invocados,
      robos: scene.inimigos, portas: scene.portasFabrica.map(p => p.colisao.body.enable !== false),
      pendencia: JSON.stringify(sistema.trabalhoUltimaAtualizacao()) };
    exigirNascimentoDaArea(estado, minimo);
    assert.throws(() => exigirNascimentoDaArea({ ...estado, robos: [{ area: -1 }] }, minimo), new RegExp(`Área ${area.id}`));
    sistema.destruir();
  }
});

test("abrir as duas portas reaproveita acesso comprovado e divide consultas com duas ondas", t => {
  const { scene } = fabricaComPortas();
  const piso = obterPisoSpawnRobos(scene);
  const entrada = { x: 98, y: -1040 };
  const acesso = criarAcessoSpawnFabrica(scene, piso);
  while (!acesso.atualizar([entrada])) {}
  const inicial = { x: -1081, y: -1304 };
  assert.ok(acesso.alcanca(inicial));

  let podeNascer = false;
  scene.multiplayer = scene.isMultiplayerHost = true;
  Object.assign(scene.player, { x: -1080, y: -1140 });
  scene.remotePlayers = new Map([["aliado", { x: 0, y: -1170, active: true }]]);
  const sistema = criarSpawnAreasRoboBola(scene, (_s, p) => {
    if (!podeNascer) return null;
    const robo = { ...p, active: true };
    scene.inimigos.push(robo);
    return robo;
  });
  sistema.restaurar(Object.fromEntries(sistema.snapshot()
    .map(a => [a.id, [1608, 1610].includes(a.id) ? 0 : a.total])));
  const arvore = scene.physics.world.staticTree;
  const buscar = arvore.search;
  let consultas = 0, pico = 0, primeira = null, duas = null;
  arvore.search = (...args) => { consultas++; return buscar(...args); };
  const passo = () => {
    consultas = 0;
    scene.time.now += 1000 / 30;
    sistema.atualizar(1000 / 30);
    const w = sistema.trabalhoUltimaAtualizacao();
    assert.equal(consultas, w.consultasNavegacao + w.consultasNascimento);
    assert.ok(consultas <= 640);
    assert.ok(w.avaliados <= 512);
    return w;
  };
  for (let i = 0; i < 85; i++) passo();
  for (const p of scene.portasFabrica.slice(0, 2)) p.colisao.body.enable = false;
  acesso.atualizar([entrada], 96);
  assert.ok(acesso.alcanca(inicial), "abertura preserva o componente anterior");
  podeNascer = true;
  for (let i = 1; i <= 160; i++) {
    passo();
    pico = Math.max(pico, consultas);
    if (scene.inimigos.length) primeira ??= i;
    if (new Set(scene.inimigos.map(r => r.spawnAreaRoboBolaId)).size === 2) duas ??= i;
  }
  assert.ok(primeira && duas);
  assert.ok(duas < 60);
  scene.portasFabrica[1].colisao.body.enable = true;
  acesso.atualizar([entrada], 96);
  assert.equal(acesso.alcanca({ x: 1041, y: -2747 }), false, "fechamento descarta caminhos antigos");
  t.diagnostic(JSON.stringify({ pico, primeira, duas }));
});

test("a expectativa de navegador falha se a fábrica recusar a criação da onda", () => {
  const { scene } = fabricaComPortas();
  Object.assign(scene.player, { x: -1080, y: -1140 });
  let recusar = true, recusas = 0;
  const sistema = criarSpawnAreasRoboBola(scene, (_s, p, _perfil, _portal, id) => {
    if (id === 1608 && recusar) { recusas++; return null; }
    const robo = { ...p, active: true };
    scene.inimigos.push(robo);
    return robo;
  });
  const estado = () => ({ id: 1608, invocados: sistema.snapshot().find(a => a.id === 1608).invocados,
    robos: scene.inimigos, portas: { porta01: "fechada", porta04: "fechada" }, pendencia: "criação recusada" });
  for (let i = 0; i < 90; i++) sistema.atualizar(16);
  assert.ok(recusas > 0);
  assert.throws(() => exigirNascimentoDaArea(estado()), /Área 1608.*0 nascimentos.*porta01.*criação recusada/);
  recusar = false;
  for (let i = 0; i < 90 && estado().invocados === 0; i++) sistema.atualizar(16);
  exigirNascimentoDaArea(estado());
});
