import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { criarAtalhoDevFase2Boss, prepararBossDevFase2 } from './DeveloperBoss.js';
import { novoBossConfig } from '../enemies/novoBoss/NovoBossConfig.js';
import { prepararFasesNovoBoss } from '../enemies/novoBoss/NovoBossFases.js';
import { causarDanoNovoBoss } from '../enemies/novoBoss/NovoBossEstados.js';
import { prepararPrologoNovoBoss } from '../enemies/novoBoss/NovoBossPrologo.js';
import { CoopWorld } from '../multiplayer/CoopWorld.js';
import { CoopBossLoading } from '../multiplayer/CoopBossLoading.js';
import { HACKING_KEYS } from '../puzzles/HackingConfig.js';

globalThis.Phaser = { Input: { Keyboard: { KeyCodes: { M: 77 } } }, Scenes: { Events: { SHUTDOWN: 'shutdown' } } };

function fixture() {
  const key = new EventEmitter(), chamadas = [];
  const sistema = nome => ({ destruir() { chamadas.push(nome); } });
  const boss = { combateInicializado: true, vida: 1000, vidaMaxima: 1000, active: true,
    morto: false, encerrado: false, barreiraAtiva: true, estado: 'atacando', config: novoBossConfig,
    teleporte: null, teleportePendente: null, relogioCombate: 5000, suspenso: false,
    danoAdiadoPrologo: 900,
    sprite: { ...novoBossConfig.posicaoInicial, active: true, body: { enable: true }, anims: { pause() {} }, setAlpha(a) { this.alpha = a; } },
    cancelarAtaque() { chamadas.push('ataque'); this.ataqueAtual = null; this.estado = 'preparando'; },
    prologo: { bloqueiaCombatePrincipal: true, ...sistema('prologo'), concluirAntecipado() {
      if (!this.bloqueiaCombatePrincipal) return false;
      chamadas.push('prologo-concluido'); this.bloqueiaCombatePrincipal = false; return true;
    } },
    geradores: [{ ligado: true, morto: false, vida: 80, body: { enable: true }, recolher() { this.recolhido = true; } }],
    sistemaGeradores: { ...sistema('geradores'), controlarEscudo() { boss.barreiraAtiva = false; } },
    sistemaIlusoes: { ...sistema('ilusoes'), encerrarQuatro() { chamadas.push('ilusoes-encerradas'); } },
    sistemaClones: sistema('clones') };
  const scene = { sys: { settings: { key: 'Level1Parte2' } }, developerMode: true, vida: 100,
    game: { registry: new Map() },
    player: { active: true, x: -1080, y: -5500 }, novoBoss: boss, events: new EventEmitter(),
    input: { keyboard: { addKey(code) { assert.equal(code, 77); return key; } } } };
  const autoridade = Object.create(scene); autoridade.multiplayer = false;
  prepararFasesNovoBoss(autoridade, boss);
  criarAtalhoDevFase2Boss(scene);
  return { scene, boss, key, chamadas };
}

test('M deixa vivo na fase 2 com 1 HP, encerrando o prólogo e o escudo sem emitir derrota', () => {
  const { scene, boss, key, chamadas } = fixture(); let derrotas = 0, vida, fases = 0;
  scene.events.on('novo-boss:derrotada', e => { assert.equal(e.encontro, boss); derrotas++; });
  scene.events.on('novo-boss:vida', e => { vida = e.vida; });
  scene.events.on('novo-boss:fase-alterada', () => fases++);
  const geradores = boss.sistemaGeradores;
  key.emit('down'); key.emit('down');
  assert.equal(boss.vida, 1); assert.equal(vida, 1); assert.equal(boss.morto, false); assert.equal(boss.fase, 2);
  assert.equal(boss.estado, 'preparando'); assert.equal(boss.sprite.body.enable, true);
  assert.equal(derrotas, 0); assert.equal(fases, 1); assert.equal(boss.danoAdiadoPrologo, 0);
  assert.equal(boss.barreiraAtiva, false); assert.equal(boss.prologo.bloqueiaCombatePrincipal, false);
  assert.equal(scene.game.registry.get(HACKING_KEYS.fabrica), true);
  for (const key of [HACKING_KEYS.robos, HACKING_KEYS.registro, HACKING_KEYS.final]) assert.equal(scene.game.registry.get(key), undefined);
  assert.equal(boss.sistemaGeradores, geradores); assert.equal(boss.geradores[0].recolhido, true);
  assert.equal(boss.geradores[0].morto, true); assert.equal(boss.geradores[0].body.enable, false);
  assert.deepEqual(chamadas, ['prologo-concluido', 'ataque', 'ilusoes-encerradas']);
  assert.equal(causarDanoNovoBoss(scene, boss, 1), true);
  assert.equal(boss.morto, true); assert.equal(derrotas, 1);
});

test('não avança sem DEV, fora da arena, durante menus, morte, introdução ou transição', () => {
  for (const patch of [{ developerMode: false }, { generatorMenuOpen: true }, { devItemMenuOpen: true },
    { upgradeMenuOpen: true }, { morteEmAndamento: true }, { vida: 0 }, { cenaEntradaBossAtiva: true },
    { transicaoEmAndamento: true }, { transicaoRetornoEmAndamento: true },
    { player: { active: true, x: 0, y: 0 } }, { player: { active: false } },
    { sys: { settings: { key: 'Level1' } } }]) {
    const { scene, boss } = fixture(); Object.assign(scene, patch);
    assert.equal(prepararBossDevFase2(scene), false); assert.equal(boss.vida, 1000);
    assert.equal(scene.game.registry.get(HACKING_KEYS.fabrica), undefined);
  }
  for (const patch of [{ combateInicializado: false }, { encerrado: true }, { sprite: { active: false } }]) {
    const { scene, boss } = fixture(); Object.assign(boss, patch);
    assert.equal(prepararBossDevFase2(scene), false); assert.equal(boss.vida, 1000);
  }
});

test('M não é instalado na cidade e seu listener é removido no shutdown', () => {
  let registrou = false;
  criarAtalhoDevFase2Boss({ sys: { settings: { key: 'Level1' } }, input: { keyboard: { addKey() { registrou = true; } } } });
  assert.equal(registrou, false);
  const { scene, key, boss } = fixture(); scene.events.emit('shutdown');
  assert.equal(key.listenerCount('down'), 0); key.emit('down'); assert.equal(boss.vida, 1000);
});

test('prólogo real termina em combate principal e não volta a criar ondas após M', () => {
  const { scene, boss, key } = fixture(); let limpezas = 0, conclusoes = 0;
  const grafico = { setDepth() { return this; }, setName() { return this; }, clear() { limpezas++; }, destroy() {} };
  scene.add = { graphics: () => grafico }; scene.inimigos = [];
  scene.lasersInimigo = { getChildren: () => [] };
  boss.geradores = Array.from({ length: 4 }, (_, id) => ({ id, torre: true, ligado: true,
    morto: false, vida: 80, body: { enable: true }, recolher() {}, suspenderColisao() {} }));
  delete boss.prologo;
  const prologo = prepararPrologoNovoBoss(scene, boss);
  scene.events.on('novo-boss:prologo-concluido', () => conclusoes++);
  key.emit('down'); key.emit('down');
  assert.equal(prologo.estado, 'COMBATE_PRINCIPAL'); assert.equal(prologo.bloqueiaCombatePrincipal, false);
  assert.equal(prologo.atualizar(60000), false); assert.equal(conclusoes, 1); assert.equal(limpezas, 1);
  assert.equal(boss.prologo, prologo); assert.equal(boss.fase, 2); assert.equal(boss.vida, 1);
  assert.equal(boss.barreiraAtiva, false); assert.ok(boss.geradores.every(g => g.morto && !g.ligado && !g.body.enable));
});

test('no cooperativo, M pede ao host e não altera a réplica local', () => {
  const { scene, key, boss } = fixture(), pedidos = [];
  scene.coopRuntime = { manager: { sendCoopAction(...a) { pedidos.push(a); } } };
  key.emit('down'); assert.deepEqual(pedidos, [['devBossPhase2']]); assert.equal(boss.vida, 1000);
  scene.developerMode = false; key.emit('down'); assert.equal(pedidos.length, 1);
});

test('host valida o DEV do cliente e a arena antes de mudar a fase; payload não concede permissão', () => {
  const { scene, boss } = fixture(); scene.developerMode = false;
  const remote = { actor: { active: true, x: -1080, y: -5500 }, data: { coop: { developer: false } } };
  remote.context = { player: remote.actor, vida: 100, get developerMode() { return remote.data.coop.developer; } };
  const world = Object.create(CoopWorld.prototype);
  world.scene = scene;
  world.manager = { playerId: 'host', room: { coopProgress: { flags: {} } } };
  world.r = { host: true, mapKey: 'Level1Parte2', players: { remotes: new Map([['cliente', remote]]) } };
  world.bossLoading = new CoopBossLoading(world);
  world.generator = { receive: () => false };
  const pedido = { kind: 'devBossPhase2', playerId: 'cliente', payload: { developer: true } };
  world.receive(pedido); assert.equal(boss.morto, false);
  assert.equal(scene.game.registry.get(HACKING_KEYS.fabrica), undefined);
  remote.data.coop.developer = true; remote.actor.x = 0;
  world.receive(pedido); assert.equal(boss.morto, false);
  remote.actor.x = -1080; world.r.host = false;
  world.receive(pedido); assert.equal(boss.morto, false);
  world.r.host = true; scene.multiplayer = true; world.receive(pedido);
  assert.equal(boss.morto, false); assert.equal(boss.fase, 2); assert.equal(boss.vida, 1);
  assert.equal(scene.game.registry.get(HACKING_KEYS.fabrica), true);
});
