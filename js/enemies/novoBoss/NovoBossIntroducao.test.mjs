import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { prepararIntroducaoNovoBoss } from "./NovoBossIntroducao.js";
import { novoBossConfig } from "./NovoBossConfig.js";
import { prepararGeradoresNovoBoss } from "./NovoBossGeradores.js";
import { causarDanoAlvoAdicional } from "../../combat/CombatTargets.js";

// A câmera é a implementação real do Phaser usada pelo jogo.
const bundle = readFileSync(new URL("../../libs/phaser.min.js", import.meta.url), "utf8");
const contexto = { module: { exports: {} }, exports: {}, importScripts() {}, window: {}, navigator: {} };
vm.runInNewContext(bundle.replace("i(85454)})());", "i})());"), contexto);
const Camera = contexto.module.exports(38058);

function fixture({ velocidade = 1, velocidadeTorres = velocidade } = {}) {
  const player = { active: true, x: -1080, y: -5500,
    body: { x: -1090, y: -5530, width: 20, height: 50 },
    setVelocity(x, y) { this.velocidade = { x, y }; },
    anims: { isPaused: false, pause() { this.isPaused = true; }, resume() { this.isPaused = false; } } };
  const c = new Camera(0, 0, 800, 450);
  c.setZoom(1.2).startFollow(player, false, 0.3, 0.4, 10, -20);
  const chamadas = [];
  const portas = ["porta02", "porta03", "porta05"].map((nome, i) => ({ nome, estado: "aberta",
    area: { x: -1248 + i * 192, y: -5328, width: 144, height: 96 },
    fecharParaBoss() { chamadas.push(`fechar:${nome}`); this.estado = "fechando"; },
    liberarAposBoss() { chamadas.push(`liberar:${nome}`); this.estado = "aberta"; } }));
  const scene = { player, portasFabrica: portas, cameras: { main: c }, vida: 100,
    events: new EventEmitter(), movimentoBloqueado: false,
    input: { enabled: true, keyboard: { enabled: true, resetKeys() {} } } };
  c.scene = scene;
  const encontro = { config: { ...novoBossConfig,
    cenaEntrada: { ...novoBossConfig.cenaEntrada, velocidade, velocidadeTorres } }, jogadorNaArena: true,
    sprite: { active: true, x: -1080, y: -5810 } };
  return { scene, encontro, c, portas, chamadas, sistema: prepararIntroducaoNovoBoss(scene, encontro) };
}
const perto = (a, b) => assert.ok(Math.abs(a - b) < 1e-8, `${a} ≠ ${b}`);
const centro = c => ({ x: c.scrollX + c.width / 2, y: c.scrollY + c.height / 2 });

test("câmera real vai ao boss, retorna ao jogador e só então fecha as duas persianas", () => {
  const { scene, encontro, c, portas, chamadas, sistema } = fixture();
  const inicio = centro(c);
  assert.equal(sistema.atualizar(0), true);
  assert.equal(scene.movimentoBloqueado, true);
  assert.equal(scene.input.enabled, false);
  assert.equal(scene.input.keyboard.enabled, false);
  assert.equal(scene.player.anims.isPaused, true);
  assert.equal(scene.events.listenerCount("prerender"), 1);
  assert.equal(c._follow, null);
  assert.deepEqual(scene.player.velocidade, { x: 0, y: 0 });
  sistema.atualizar(1600);
  perto(centro(c).x, (inicio.x + encontro.sprite.x) / 2);
  perto(centro(c).y, (inicio.y + encontro.sprite.y) / 2);
  sistema.atualizar(1600);
  assert.equal(sistema.snapshot().etapa, "mostrando");
  perto(centro(c).x, encontro.sprite.x);
  perto(centro(c).y, encontro.sprite.y);
  assert.deepEqual(chamadas, []);
  sistema.atualizar(900);
  assert.equal(sistema.snapshot().etapa, "voltando");
  sistema.atualizar(900);
  assert.equal(sistema.snapshot().etapa, "fechando");
  perto(centro(c).x, scene.player.x - 10);
  perto(centro(c).y, scene.player.y + 20);
  assert.deepEqual(chamadas, ["fechar:porta02", "fechar:porta03"]);
  assert.equal(portas[2].estado, "aberta");
  sistema.atualizar(850);
  assert.equal(sistema.snapshot().concluida, false, "espera as animações reais das portas terminarem");
  portas[0].estado = portas[1].estado = "fechada";
  assert.equal(sistema.atualizar(16), true);
  assert.equal(sistema.snapshot().concluida, true);
  assert.equal(scene.movimentoBloqueado, false);
  assert.equal(scene.cenaEntradaBossAtiva, undefined);
  assert.equal(scene.input.enabled, true);
  assert.equal(scene.input.keyboard.enabled, true);
  assert.equal(scene.player.anims.isPaused, false);
  assert.equal(scene.events.listenerCount("prerender"), 0);
  assert.equal(c._follow, scene.player);
  perto(c.lerp.x, 0.3); perto(c.lerp.y, 0.4);
  perto(c.followOffset.x, 10); perto(c.followOffset.y, -20);
  perto(c.zoom, 1.2);
  assert.equal(sistema.atualizar(10000), false, "não repete a cena ao continuar na sala");
  scene.events.emit("novo-boss:derrotada", { encontro: {} });
  assert.equal(chamadas.length, 2);
  scene.events.emit("novo-boss:derrotada", { encontro });
  assert.deepEqual(chamadas.slice(2), ["liberar:porta02", "liberar:porta03"]);
  sistema.destruir(); sistema.destruir();
  assert.equal(chamadas.length, 4);
  assert.equal(scene.events.listenerCount("novo-boss:derrotada"), 0);
});

test("a entrada espera o corpo passar pelas portas, menus e animações de abertura", () => {
  const { scene, portas, sistema } = fixture();
  const luz = { x: -1080, y: -5600, neon: true };
  assert.equal(sistema.iluminacao.fatorLuz(luz), 0);
  Object.assign(scene.player.body, { x: -1200, y: -5350, height: 50 });
  sistema.atualizar(1000);
  assert.equal(sistema.snapshot().etapa, "aguardando");
  assert.equal(scene.movimentoBloqueado, false, "permite terminar a passagem");
  assert.equal(sistema.iluminacao.fatorLuz(luz), 0);
  scene.player.body.y = -5500;
  portas[0].estado = "abrindo";
  sistema.atualizar(1000);
  assert.equal(sistema.snapshot().etapa, "aguardando");
  portas[0].estado = "aberta";
  scene.generatorMenuOpen = true;
  sistema.atualizar(1000);
  assert.equal(sistema.snapshot().etapa, "aguardando");
  scene.generatorMenuOpen = false;
  sistema.atualizar(0);
  assert.equal(sistema.snapshot().etapa, "indo");
  sistema.destruir();
});

test("a música entra durante a aproximação da câmera e acompanha o avanço da apresentação", () => {
  const { scene, sistema } = fixture();
  const eventosSom = new EventEmitter();
  const sons = [];
  scene.cache = { audio: { exists: () => true, get: () => ({ duration: 100 }) } };
  scene.sound = {
    add() {
      const som = {
        totalDuration: 100,
        volumes: [],
        on: (...args) => eventosSom.on(...args),
        off: (...args) => eventosSom.off(...args),
        addMarker(marcador) { this.marcador = marcador; },
        play(nome, opcoes) {
          this.reproducao = typeof nome === "object"
            ? { nome: "", opcoes: nome }
            : { nome, opcoes };
        },
        setVolume(volume) { this.volumes.push(volume); },
        stop() {},
        destroy() {},
      };
      sons.push(som);
      return som;
    },
  };

  sistema.atualizar(0);
  sistema.atualizar(3200 * 0.34);
  assert.equal(sons.length, 0, "a faixa aguarda a câmera avançar");
  sistema.atualizar(3200 * 0.1);
  assert.equal(sons.length, 1);
  assert.ok(sons[0].volumes.at(-1) > 0);
  sistema.atualizar(3200);
  assert.equal(sons[0].volumes.at(-1), 0.2);
  assert.equal(sons[0].marcador.start, 48);
  assert.deepEqual(sons[0].reproducao, {
    nome: "boss-continuo", opcoes: { volume: 0, seek: -48 },
  });
  eventosSom.emit("complete");
  assert.deepEqual(sons[0].reproducao, {
    nome: "boss-continuo", opcoes: { volume: 0, seek: -48 },
  });
  sistema.destruir();
});

test("sair durante a apresentação volta a deixar a arena apagada para a próxima entrada", () => {
  const { encontro, sistema } = fixture();
  const luz = { x: -1080, y: -5600, neon: true };
  sistema.atualizar(0); sistema.atualizar(3650);
  assert.equal(sistema.iluminacao.fatorLuz(luz), 1);
  assert.equal(sistema.iluminacao.aura, 1);
  encontro.jogadorNaArena = false;
  sistema.atualizar(0);
  assert.equal(sistema.snapshot().etapa, "aguardando");
  assert.equal(sistema.iluminacao.fatorLuz(luz), 0);
  assert.equal(sistema.iluminacao.aura, 0);
  encontro.jogadorNaArena = true;
  sistema.atualizar(0);
  assert.equal(sistema.snapshot().etapa, "indo");
  assert.equal(sistema.iluminacao.fatorLuz(luz), 0);
  sistema.destruir();
});

test("interrupção restaura câmera e controles e libera portas, inclusive no meio do fechamento", () => {
  for (const fechar of [false, true]) {
    for (const interromper of [f => { f.scene.morteEmAndamento = true; },
      f => { f.encontro.jogadorNaArena = false; }, f => { f.scene.multiplayer = true; },
      f => { f.scene.cameras.main = {}; }, f => f.sistema.destruir()]) {
      const f = fixture();
      f.scene.input.enabled = false;
      f.sistema.atualizar(0);
      if (fechar) f.sistema.atualizar(5000);
      interromper(f);
      f.sistema.atualizar(16);
      assert.equal(f.scene.movimentoBloqueado, false);
      assert.equal(f.scene.cenaEntradaBossAtiva, undefined);
      assert.equal(f.scene.input.enabled, false, "preserva o bloqueio de entrada anterior");
      assert.equal(f.scene.input.keyboard.enabled, true);
      assert.equal(f.c._follow, f.scene.player);
      assert.equal(f.scene.events.listenerCount("prerender"), 0);
      assert.ok(f.portas.every(porta => porta.estado === "aberta"));
      f.sistema.destruir();
    }
  }
});

test("encerrar a cena restaura os controles sem reiniciar as animações já destruídas", () => {
  const { scene, encontro, sistema } = fixture();
  sistema.atualizar(0);
  encontro.sistemaGeradores = { cancelarApresentacao() { assert.fail("não reanima sprites durante o shutdown"); } };
  encontro.encerrado = true;
  sistema.destruir();
  assert.equal(scene.movimentoBloqueado, false);
  assert.equal(scene.input.enabled, true);
  assert.equal(scene.events.listenerCount("prerender"), 0);
});

test("movimento da câmera independe do FPS e cenas sem suporte ou com opção desativada não são bloqueadas", () => {
  const a = fixture(), b = fixture();
  a.sistema.atualizar(0); b.sistema.atualizar(0);
  a.sistema.atualizar(1000);
  for (let i = 0; i < 50; i++) b.sistema.atualizar(20);
  perto(centro(a.c).x, centro(b.c).x); perto(centro(a.c).y, centro(b.c).y);
  assert.equal(a.sistema.snapshot().etapa, b.sistema.snapshot().etapa);
  a.sistema.destruir(); b.sistema.destruir();
  assert.equal(prepararIntroducaoNovoBoss({}, { config: novoBossConfig }), null);
  assert.equal(prepararIntroducaoNovoBoss(a.scene, { config: { cenaEntrada: { ativo: false } } }), null);
});

function fixtureTorres(t, opcoes) {
  const anterior = globalThis.Phaser;
  globalThis.Phaser = { Geom: { Rectangle: class {
    constructor(x, y, width, height) { Object.assign(this, { x, y, width, height }); }
  } } };
  t.after(() => { globalThis.Phaser = anterior; });
  const f = fixture(opcoes), visuais = [];
  f.scene.input.keyboard = Object.assign(new EventEmitter(), { enabled: true, resetKeys() {} });
  const raw = JSON.parse(readFileSync(new URL("../../../assets/map/parte2-fase1.json", import.meta.url)));
  f.scene.map = { getObjectLayer: nome => raw.layers.find(l => l.name === nome) };
  function visual(x = 0, y = 0, key = null, frame = 0, width = 1, height = 1) {
    const v = { x, y, width, height, key, frame, visible: true, active: true, alpha: 1,
      paths: [],
      setOrigin() { return this; }, setName(name) { this.name = name; return this; },
      setScale(scale) { this.scale = scale; return this; },
      setDepth(depth) { this.depth = depth; return this; },
      setVisible(visible) { this.visible = visible; return this; },
      setAlpha(alpha) { this.alpha = alpha; return this; },
      setPosition(x, y) { Object.assign(this, { x, y }); return this; },
      setTexture(key, frame) { Object.assign(this, { key, frame }); return this; },
      setFrame(frame) { this.frame = frame; return this; },
      clear() { this.paths = []; return this; },
      lineStyle() { return this; }, beginPath() { this.path = []; return this; },
      moveTo(x, y) { this.path.push({ x, y }); return this; },
      lineTo(x, y) { this.path.push({ x, y }); return this; },
      strokePath() { this.paths.push(this.path); return this; },
      fillStyle() { return this; }, fillCircle() { return this; }, strokeCircle() { return this; },
      destroy() { this.active = false; this.destruicoes = (this.destruicoes ?? 0) + 1; },
    };
    visuais.push(v); return v;
  }
  f.scene.add = { sprite: (x, y, key, frame) => visual(x, y, key, frame),
    rectangle: (x, y, w, h) => visual(x, y, null, 0, w, h),
    circle: (x, y, r) => visual(x, y, null, 0, r * 2, r * 2), graphics: () => visual() };
  f.scene.textures = { exists: () => true };
  f.scene.physics = { add: { existing(v) {
    v.body = { enable: true, setCircle(r) { this.radius = r; }, updateFromGameObject() {} };
  }, collider() { return { destroy() {} }; } } };
  f.scene.novoBoss = f.encontro;
  Object.assign(f.encontro.sprite, { visible: true, alpha: 1 });
  f.encontro.introducao = f.sistema;
  Object.defineProperty(f.encontro, "active", { get: () => !f.sistema.bloqueiaCombate &&
    f.encontro.jogadorNaArena && !f.encontro.morto && !f.encontro.suspenso });
  f.geradores = prepararGeradoresNovoBoss(f.scene, f.encontro);
  f.visuais = visuais;
  t.after(() => { f.sistema.destruir(); f.geradores.destruir(); });
  return f;
}

function avancarAte(f, etapa) {
  for (let i = 0; i < 1000 && f.sistema.snapshot().etapa !== etapa; i++) f.sistema.atualizar(50);
  assert.equal(f.sistema.snapshot().etapa, etapa);
}

test("torres reais nascem uma por vez; quatro raios formam o escudo com a câmera enquadrando a sala", t => {
  const f = fixtureTorres(t), { encontro, sistema, geradores, c } = f;
  const escudo = f.visuais.find(v => v.name === "novo-boss-escudo-energia");
  assert.equal(encontro.barreiraAtiva, false); assert.equal(escudo.visible, false);
  assert.ok(encontro.geradores.every(torre => torre.visible && torre.visual.frame === 0 && !torre.body.enable));
  sistema.atualizar(0); sistema.atualizar(4100);
  assert.equal(sistema.snapshot().etapa, "indo-torre");
  assert.equal(encontro.barreiraAtiva, false);
  const reveladas = new Set();
  for (let i = 0; i < 4; i++) {
    const id = sistema.snapshot().torre;
    assert.equal(id, [1597, 1594, 1593, 1596][i], "superior esquerda → superior direita → inferior direita → inferior esquerda");
    const torre = encontro.geradores.find(torre => torre.id === id);
    assert.equal(torre.visible, true, "o primeiro frame já está no chão");
    assert.equal(torre.visual.frame, 0, "a animação espera a câmera chegar");
    assert.equal(torre.body.enable, false);
    sistema.atualizar(650);
    assert.equal(sistema.snapshot().etapa, "invocando-torre");
    reveladas.add(id);
    assert.equal(torre.visible, true); assert.equal(torre.visual.frame, 0);
    assert.ok(encontro.geradores.every(t => t.visible && (reveladas.has(t.id) || t.visual.frame === 0)));
    sistema.atualizar(800); assert.equal(torre.visual.frame, 8);
    assert.equal(torre.estado, "summon");
    sistema.atualizar(800); assert.equal(torre.estado, "idle");
    assert.equal(sistema.snapshot().etapa, "mostrando-choque-torre");
    sistema.atualizar(200);
    assert.ok(torre.luzChoqueIdle.intensidade > 0, "o choque real do idle aparece antes da próxima torre");
    assert.equal(sistema.snapshot().torre, id);
    sistema.atualizar(torre.duracaoIdleMs - 200);
    assert.equal(encontro.barreiraAtiva, false);
    assert.equal(causarDanoAlvoAdicional(f.scene, torre, 1000), false, "combate bloqueado na apresentação");
  }
  assert.equal(reveladas.size, 4);
  assert.equal(sistema.snapshot().etapa, "enquadrando");
  sistema.atualizar(1000);
  assert.equal(sistema.snapshot().etapa, "carregando-escudo");
  c.preRender();
  perto(centro(c).x, encontro.sprite.x); perto(centro(c).y, encontro.sprite.y);
  assert.ok(c.zoom < 1.2);
  for (const torre of encontro.geradores) {
    const a = torre.hitboxDano;
    assert.ok(a.x >= c.worldView.x && a.x + a.width <= c.worldView.right);
    assert.ok(a.y >= c.worldView.y && a.y + a.height <= c.worldView.bottom);
  }
  sistema.atualizar(450);
  const raios = f.visuais.find(v => v.name === "novo-boss-raios-torres");
  assert.ok(raios.visible); assert.equal(raios.paths.length, 12);
  const verificarBorda = raio => {
    for (const path of raios.paths) {
      const origem = path[0], fim = path.at(-1), x = encontro.sprite.x, y = encontro.sprite.y + 16;
      const distancia = Math.hypot(origem.x - x, origem.y - y);
      perto(Math.hypot(fim.x - x, fim.y - y), raio);
      perto(fim.x, x + (origem.x - x) / distancia * raio);
      perto(fim.y, y + (origem.y - y) / distancia * raio);
      assert.ok(encontro.geradores.some(t => t.pontoEmissor.x === origem.x && t.pontoEmissor.y === origem.y));
    }
  };
  verificarBorda(encontro.config.geradores.raioBarreira * 0.3);
  assert.equal(escudo.visible, false, "primeiro os raios alcançam o boss");
  sistema.atualizar(525);
  perto(geradores.cargaEscudo, 0.5); assert.equal(escudo.visible, true);
  perto(escudo.alpha, 0.35); assert.equal(encontro.barreiraAtiva, true);
  verificarBorda(escudo.scale * 640 / 2);
  const escalaParcial = escudo.scale;
  sistema.atualizar(525);
  perto(geradores.cargaEscudo, 1); assert.ok(escudo.scale > escalaParcial);
  verificarBorda(encontro.config.geradores.raioBarreira);
  assert.equal(sistema.snapshot().etapa, "dissipando-raios");
  sistema.atualizar(175); perto(raios.alpha, 0.5);
  verificarBorda(encontro.config.geradores.raioBarreira);
  sistema.atualizar(175);
  assert.equal(sistema.snapshot().etapa, "voltando"); assert.equal(raios.destruicoes, 1);
  sistema.atualizar(900);
  perto(c.zoom, 1.2); assert.equal(sistema.snapshot().etapa, "fechando");
  assert.deepEqual(f.chamadas, ["fechar:porta02", "fechar:porta03"]);
  f.portas[0].estado = f.portas[1].estado = "fechada";
  sistema.atualizar(16);
  assert.equal(sistema.snapshot().concluida, true); assert.equal(c._follow, f.scene.player);
  assert.equal(geradores.snapshot().apresentando, false);
  for (const torre of encontro.geradores) assert.equal(causarDanoAlvoAdicional(f.scene, torre, 1000), true);
  assert.equal(encontro.barreiraAtiva, false, "destruir as quatro torres ainda remove o escudo");
});

test("cancelar o ritual restaura zoom/controle e reinicia torres e escudo sem deixar raios", t => {
  for (const interromper of [f => { f.encontro.jogadorNaArena = false; },
    f => { f.scene.morteEmAndamento = true; }, f => { f.scene.cameras.main = {}; },
    f => f.sistema.destruir()]) {
    const f = fixtureTorres(t);
    avancarAte(f, "carregando-escudo"); f.sistema.atualizar(1000);
    assert.ok(f.encontro.barreiraAtiva);
    interromper(f); f.sistema.atualizar(16);
    perto(f.c.zoom, 1.2); assert.equal(f.c._follow, f.scene.player);
    assert.equal(f.scene.movimentoBloqueado, false); assert.equal(f.scene.input.enabled, true);
    assert.ok(f.encontro.geradores.every(torre => torre.estado === "summon" && torre.visual.frame === 0 && !torre.body.enable));
    assert.equal(f.encontro.barreiraAtiva, false);
    const raios = f.visuais.find(v => v.name === "novo-boss-raios-torres");
    assert.equal(raios.destruicoes, 1);
    f.sistema.destruir(); assert.equal(raios.destruicoes, 1);
  }
});

test("avanço do ritual independe do FPS e respeita as fronteiras de invocação em frames longos", t => {
  for (const total of [4100 + 650, 5000, 11750, 15000, 21000, 26000]) {
    const opcoes = { velocidade: novoBossConfig.cenaEntrada.velocidade,
      velocidadeTorres: novoBossConfig.cenaEntrada.velocidadeTorres };
    const a = fixtureTorres(t, opcoes), b = fixtureTorres(t, opcoes);
    a.sistema.atualizar(0); b.sistema.atualizar(0);
    a.sistema.atualizar(total);
    for (let ms = 0; ms < total; ms += 50) b.sistema.atualizar(Math.min(50, total - ms));
    assert.deepEqual(a.sistema.snapshot(), b.sistema.snapshot());
    perto(a.c.scrollX, b.c.scrollX); perto(a.c.scrollY, b.c.scrollY); perto(a.c.zoom, b.c.zoom);
    perto(a.geradores.cargaEscudo, b.geradores.cargaEscudo);
    assert.deepEqual(a.encontro.geradores.map(t => [t.visible, t.estado, t.visual.frame]),
      b.encontro.geradores.map(t => [t.visible, t.estado, t.visual.frame]));
  }
});

test("reentrada após interrupção reapresenta as torres; sem recursos prontos a câmera aguarda", t => {
  const f = fixtureTorres(t);
  f.encontro.pendencia = "assets-torres-indisponiveis";
  f.sistema.atualizar(3000); assert.equal(f.sistema.snapshot().etapa, "aguardando");
  assert.equal(f.scene.movimentoBloqueado, false);
  f.encontro.pendencia = null;
  avancarAte(f, "invocando-torre"); f.sistema.atualizar(800);
  f.encontro.jogadorNaArena = false; f.sistema.atualizar(16);
  f.encontro.jogadorNaArena = true;
  avancarAte(f, "invocando-torre");
  const torre = f.encontro.geradores.find(t => t.id === f.sistema.snapshot().torre);
  assert.equal(torre.estado, "summon"); assert.equal(torre.visual.frame, 0);
  assert.equal(f.encontro.barreiraAtiva, false);
});

test("enquadramento inclui as quatro torres em telas horizontais e verticais", t => {
  for (const [largura, altura] of [[1280, 720], [360, 640], [640, 360]]) {
    const f = fixtureTorres(t);
    f.c.setSize(largura, altura);
    avancarAte(f, "carregando-escudo");
    f.c.preRender();
    for (const torre of f.encontro.geradores) {
      const a = torre.hitboxDano, vista = f.c.worldView;
      assert.ok(a.x >= vista.x && a.x + a.width <= vista.right);
      assert.ok(a.y >= vista.y && a.y + a.height <= vista.bottom);
    }
  }
});

test("invocação mantém ritmo acelerado, mas raios e formação do escudo usam os tempos originais", t => {
  const velocidade = novoBossConfig.cenaEntrada.velocidade;
  const velocidadeTorres = novoBossConfig.cenaEntrada.velocidadeTorres;
  const f = fixtureTorres(t, { velocidade, velocidadeTorres });
  f.c.id = 1;
  const botao = { depth: 100, scrollFactorX: 0, scrollFactorY: 0, cameraFilter: 0 };
  const status = { style: { visibility: "" } };
  f.scene.children = { list: [botao] }; f.scene.hudStatus = { elemento: status };
  f.sistema.atualizar(0);
  assert.equal(botao.cameraFilter, 1); assert.equal(status.style.visibility, "hidden");
  f.sistema.atualizar(3200 + 900 + 650 / velocidadeTorres);
  assert.equal(f.sistema.snapshot().etapa, "invocando-torre");
  const torre = f.encontro.geradores.find(t => t.id === f.sistema.snapshot().torre);
  f.sistema.atualizar(800 / velocidadeTorres);
  assert.equal(torre.visual.frame, 8);
  f.sistema.atualizar((800 + 3 * (650 + 1600) + 4 * torre.duracaoIdleMs) / velocidadeTorres + 1000 / velocidade);
  assert.equal(f.sistema.snapshot().etapa, "carregando-escudo");
  f.sistema.atualizar(450); perto(f.geradores.cargaEscudo, 0);
  f.sistema.atualizar(525); perto(f.geradores.cargaEscudo, 0.5);
  f.sistema.atualizar(525); perto(f.geradores.cargaEscudo, 1);
  assert.equal(f.sistema.snapshot().etapa, "dissipando-raios");
  f.sistema.atualizar(350);
  assert.equal(f.sistema.snapshot().etapa, "voltando");
  assert.equal(botao.cameraFilter, 1, "HUD permanece oculto durante o retorno");
  f.sistema.atualizar(900 / velocidade);
  f.portas[0].estado = f.portas[1].estado = "fechada";
  f.sistema.atualizar(0);
  assert.equal(f.sistema.snapshot().concluida, true);
  assert.equal(botao.cameraFilter, 0); assert.equal(status.style.visibility, "");
});
