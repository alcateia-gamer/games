/** Exercita mira, colisão varrida, dano real e ciclo de vida; não simula o renderizador. */
import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { readFileSync } from "node:fs";
import { PERSONAGEM_TESTE, PERSONAGEM_TESTE_2, ESPADA_PERSONAGEM_TESTE, FLORETE_PERSONAGEM_TESTE, ARMA_DOURADA_TESTE, GOLPES_ESPADA_TESTE,
  ARMAS_PERSONAGEM_TESTE, carregarPersonagemTeste, criarAnimacoesPersonagemTeste,
  configurarVisualPersonagemTeste, configurarHitboxPersonagemTeste } from "./PersonagemTeste.js";
import { calcularFaseFlorete, obterImpulsoFlorete } from "./FloretePersonagemTeste.js";
import { calcularFaseEspada } from "./EspadaPersonagemTeste.js";
import { criarArmaPersonagemTeste, atualizarArmaPersonagemTeste,
  dispararLaserPersonagemTeste, obterAlvoArmaTeste, calcularPoseArmaTeste,
  trocarArmaPersonagemTeste } from "./ArmaPersonagemTeste.js";
import { atacar } from "./Player.js";
import { atualizarAnimacaoCaminhada } from "../controls/PlayerAnimations.js";
import { atualizarMovimento } from "../controls/PlayerMovement.js";

const config = PERSONAGEM_TESTE.arma;
globalThis.Phaser = {
  BlendModes: { ADD: 1 }, TintModes: { FILL: 1, MULTIPLY: 0 },
  Math: { Clamp: (v, min, max) => Math.min(max, Math.max(min, v)),
    FloatBetween: (a, b) => (a + b) / 2, Between: (a, b) => Math.floor((a + b) / 2),
    Angle: { Between: (x, y, a, b) => Math.atan2(b - y, a - x) } },
};

beforeEach(() => { PERSONAGEM_TESTE.ativo = true; config.disparoAutomatico = false; });

function objeto(x = 0, y = 0) {
  return { x, y, active: true, visible: true, alpha: 1, depth: 0,
    setPosition(x, y) { Object.assign(this, { x, y }); return this; },
    setScale(x, y = x) { Object.assign(this, { scaleX: x, scaleY: y }); return this; },
    setOrigin(x, y) { Object.assign(this, { originX: x, originY: y }); return this; },
    setRotation(rotation) { this.rotation = rotation; return this; },
    setFlipY(flipY) { this.flipY = flipY; return this; },
    setFlipX(flipX) { this.flipX = flipX; return this; },
    setTexture(key, frame) { this.texture = { key }; this.frame = { name: frame }; return this; },
    setDepth(depth) { this.depth = depth; return this; },
    setVisible(visible) { this.visible = visible; return this; },
    setAlpha(alpha) { this.alpha = alpha; return this; },
    setActive(active) { this.active = active; return this; },
    setStrokeStyle() { return this; }, setBlendMode() { return this; },
    clear() { this.linhas = []; return this; }, lineStyle() { return this; },
    fillStyle() { return this; }, fillTriangle() { return this; },
    lineBetween(...linha) { (this.linhas ??= []).push(linha); return this; },
    setTint() { return this; }, setTintMode() { return this; }, clearTint() {},
    setVelocity(x, y) { if (this.body?.velocity) Object.assign(this.body.velocity, { x, y }); return this; },
    destroy() { this.active = false; },
  };
}

function inimigo(x, y, opcoes = {}) {
  return Object.assign(objeto(x, y), {
    hitboxDano: { x: x - 10, y: y - 10, width: 20, height: 20 },
    body: { enable: true, setVelocity() {} },
    vida: 100, vidaMaxima: 100, morto: false, remoteOnly: true, tipoRobo: "serra",
  }, opcoes);
}

function cena() {
  const player = objeto();
  player.body = { velocity: { x: 0, y: 0 } };
  player.anims = { play() {} };
  const scene = {
    personagemSelecionada: PERSONAGEM_TESTE.id, player, direcaoAtual: "right",
    inimigos: [], atacando: false, estamina: 80, vida: 100,
    time: { now: 0, delayedCall() {} }, events: new EventEmitter(),
    input: { keyboard: new EventEmitter() },
    textures: { get: () => ({ has: () => true }) },
    add: { image: objeto, circle: objeto, rectangle: objeto, graphics: objeto },
    tweens: { add: c => c.onComplete?.() },
  };
  criarArmaPersonagemTeste(scene);
  return scene;
}
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-8, `${a} != ${b}`);

test("carrega a arma mesmo quando o sprite do personagem já está em cache", () => {
  const arquivos = [], folhas = [];
  carregarPersonagemTeste({ textures: { exists: key => key === PERSONAGEM_TESTE.textura },
    load: { image: (...args) => arquivos.push(args),
      spritesheet: (...args) => folhas.push(args) } }, "assets/");
  assert.deepEqual(folhas.map(([key, , dados]) => [key, dados.frameWidth, dados.endFrame]),
    [[PERSONAGEM_TESTE_2.textura, 240, 7], [PERSONAGEM_TESTE_2.walk.textura, 240, 15]]);
  assert.equal(arquivos.length, 32);
  assert.deepEqual(arquivos.slice(0, 2), [[config.textura, "assets/" + config.arquivo],
    [ESPADA_PERSONAGEM_TESTE.textura, "assets/" + ESPADA_PERSONAGEM_TESTE.arquivo]]);
  const efeitos = GOLPES_ESPADA_TESTE.flatMap(g => Array.from({ length: g.quadros }, (_, i) =>
    [g.prefixoTextura + i, "assets/" + g.pasta + g.arquivo + (i + 1) + ".png"]));
  assert.deepEqual(arquivos.slice(2, -5), efeitos);
  for (const [, caminho] of efeitos) {
    assert.ok(readFileSync(new URL("../../" + caminho, import.meta.url)).length > 0);
  }
  assert.deepEqual(arquivos.at(-1),
    [PERSONAGEM_TESTE.botaoTroca.textura, "assets/" + PERSONAGEM_TESTE.botaoTroca.arquivo]);
});

test("empunhadura fica na lateral e a trajetória sai do cano em oito direções", () => {
  for (let a = 0; a < Math.PI * 2; a += Math.PI / 4) {
    const alvo = inimigo(Math.cos(a) * 180, Math.sin(a) * 180);
    const pose = calcularPoseArmaTeste({ x: 0, y: 0 }, { x: 1, y: 0 }, alvo);
    near(Math.abs(pose.mao.x), config.maoX);
    near(pose.mao.y, config.maoY);
    // Produto vetorial zero: o centro da hitbox está sobre a linha que sai do cano.
    near((alvo.x - pose.cano.x) * pose.direcao.y -
      (alvo.y - pose.cano.y) * pose.direcao.x, 0);
    assert.ok((alvo.x - pose.cano.x) * pose.direcao.x +
      (alvo.y - pose.cano.y) * pose.direcao.y > 0);
  }
});

test("mira escolhe inimigo próximo visível e ignora mortos, ocultos e fora de alcance", () => {
  const s = cena(), livre = inimigo(0, 180), bloqueado = inimigo(100, 0);
  s.inimigos = [inimigo(20, 0, { morto: true }), inimigo(30, 0, { active: false }),
    inimigo(40, 0, { visible: false }), inimigo(10, 0, { vida: 0 }),
    inimigo(500, 0), bloqueado, livre];
  s.collisionGroup = { getChildren: () => [{ active: true,
    body: { x: 50, y: -20, width: 5, height: 50 } }] };
  assert.equal(obterAlvoArmaTeste(s), livre);
});

test("mantém o foco e troca quando o inimigo sai do alcance ou morre", () => {
  const s = cena(), a = inimigo(180, 0), b = inimigo(100, 80);
  s.inimigos = [a, b];
  assert.equal(obterAlvoArmaTeste(s), b);
  assert.equal(obterAlvoArmaTeste(s, a), a);
  a.x = a.hitboxDano.x = 500;
  assert.equal(obterAlvoArmaTeste(s, a), b);
  b.morto = true;
  assert.equal(obterAlvoArmaTeste(s, b), null);
});

test("botão de ataque dispara sem interromper o idle, gasta três de estamina e respeita cadência", () => {
  const s = cena();
  assert.equal(atacar(s), true);
  assert.equal(s.armaPersonagemTeste.lasers.length, 1);
  assert.equal(s.atacando, false);
  assert.equal(s.estamina, 77);
  assert.equal(atacar(s), false);
  assert.equal(s.estamina, 77);
  s.time.now = config.intervaloDisparos;
  assert.equal(atacar(s), true);
  assert.equal(s.armaPersonagemTeste.lasers.length, 2);
});

test("tiro automático começa no alcance e compartilha a cadência com o manual", () => {
  const s = cena(), alvo = inimigo(500, 0);
  config.disparoAutomatico = true;
  s.inimigos = [alvo];
  atualizarArmaPersonagemTeste(s, 0);
  assert.equal(s.armaPersonagemTeste.lasers.length, 0);
  alvo.x = 180; alvo.hitboxDano.x = 170;
  atualizarArmaPersonagemTeste(s, 0);
  assert.equal(s.armaPersonagemTeste.lasers.length, 1);
  assert.equal(atacar(s), false);
  s.time.now = config.intervaloDisparos;
  atualizarArmaPersonagemTeste(s, 0);
  assert.equal(s.armaPersonagemTeste.lasers.length, 2);
  alvo.morto = true;
  s.time.now += config.intervaloDisparos;
  atualizarArmaPersonagemTeste(s, 0);
  assert.equal(s.armaPersonagemTeste.lasers.length, 2);
});

test("laser rápido causa dano uma vez ao primeiro alvo, mesmo com delta longo", () => {
  const s = cena(), perto = inimigo(120, 12), longe = inimigo(200, 12);
  s.inimigos = [longe, perto];
  atacar(s);
  atualizarArmaPersonagemTeste(s, 500);
  assert.equal(perto.vida, 75);
  assert.equal(longe.vida, 100);
  assert.equal(s.armaPersonagemTeste.lasers.length, 0);
  atualizarArmaPersonagemTeste(s, 500);
  assert.equal(perto.vida, 75);
});

test("parede fina barra laser antes de atingir o inimigo", () => {
  const s = cena(), alvo = inimigo(180, 12);
  s.inimigos = [alvo];
  s.collisionGroup = { getChildren: () => [{ active: true,
    body: { x: 100, y: -20, width: 2, height: 80 } }] };
  atacar(s);
  atualizarArmaPersonagemTeste(s, 500);
  assert.equal(alvo.vida, 100);
  assert.equal(s.armaPersonagemTeste.lasers.length, 0);
});

test("laser também acerta o boss pelo sistema de dano existente", () => {
  const s = cena();
  s.bossFinal = inimigo(150, 12, { sprite: objeto() });
  atacar(s);
  atualizarArmaPersonagemTeste(s, 500);
  assert.equal(s.bossFinal.vida, 75);
  assert.equal(s.armaPersonagemTeste.lasers.length, 0);
});

test("matar o último alvo não dispara um tiro automático extra", () => {
  const s = cena(), alvo = inimigo(150, 12, { vida: 25 });
  s.inimigos = [alvo];
  config.disparoAutomatico = true;
  atualizarArmaPersonagemTeste(s, 0);
  s.time.now = config.intervaloDisparos;
  atualizarArmaPersonagemTeste(s, 500);
  assert.equal(alvo.morto, true);
  assert.equal(s.armaPersonagemTeste.lasers.length, 0);
});

test("cano encostado na parede não cria tiro do outro lado", () => {
  const s = cena();
  s.collisionGroup = { getChildren: () => [{ active: true,
    body: { x: 22, y: -20, width: 2, height: 80 } }] };
  assert.equal(atacar(s), true);
  assert.equal(s.armaPersonagemTeste.lasers.length, 0);
});

test("lasers expiram pelo alcance e delta negativo não os faz voltar", () => {
  const s = cena();
  atacar(s);
  const laser = s.armaPersonagemTeste.lasers[0], x = laser.sprite.x;
  atualizarArmaPersonagemTeste(s, -100);
  assert.equal(laser.sprite.x, x);
  atualizarArmaPersonagemTeste(s, 2000);
  assert.equal(laser.sprite.active, false);
  assert.equal(s.armaPersonagemTeste.lasers.length, 0);
});

test("menu, morte, bloqueio e multiplayer impedem tiros manuais e automáticos", () => {
  for (const bloqueio of [{ generatorMenuOpen: true }, { morteEmAndamento: true },
    { movimentoBloqueado: true }, { vida: 0 }, { multiplayer: true }]) {
    const s = Object.assign(cena(), bloqueio);
    s.inimigos = [inimigo(150, 0)];
    config.disparoAutomatico = true;
    assert.equal(dispararLaserPersonagemTeste(s), false);
    atualizarArmaPersonagemTeste(s, 16);
    assert.equal(s.armaPersonagemTeste.lasers.length, 0);
  }
});

test("seguir movimento diagonal e espelhar à esquerda preserva a empunhadura", () => {
  const s = cena();
  s.player.body.velocity = { x: -100, y: 100 };
  atualizarArmaPersonagemTeste(s, 16);
  const arma = s.armaPersonagemTeste.sprite;
  near(arma.rotation, 3 * Math.PI / 4);
  assert.equal(arma.flipY, true);
  near(arma.originY, 1 - config.empunhadura.y / config.recorte.altura);
  const mao = { x: arma.x, y: arma.y };
  s.player.body.velocity = { x: 0, y: 0 };
  atualizarArmaPersonagemTeste(s, 16);
  near(arma.rotation, 3 * Math.PI / 4);
  assert.deepEqual({ x: arma.x, y: arma.y }, mao);
});

test("personagem mira no alvo andando de costas para ambos os lados, inclusive nas diagonais", () => {
  for (const lado of [-1, 1]) {
    for (const y of [-100, 0, 100]) {
      const s = cena(), alvo = inimigo(lado * 150, 0);
      s.inimigos = [alvo];
      s.player.body.velocity = { x: -lado * 100, y };
      const velocidade = { ...s.player.body.velocity };
      const direcaoMovimento = y === 0 ? (lado < 0 ? "right" : "left")
        : y < 0 ? "up" : "down";
      atualizarAnimacaoCaminhada(s, direcaoMovimento);
      atualizarArmaPersonagemTeste(s, 0);
      assert.equal(s.player.flipX, lado < 0);
      assert.equal(s.armaPersonagemTeste.pose.esquerda, s.player.flipX);
      assert.deepEqual(s.player.body.velocity, velocidade);
      assert.equal(atacar(s), true);
      assert.equal(s.player.flipX, lado < 0);
      assert.deepEqual(s.player.body.velocity, velocidade);
      // A animação da caminhada não pode voltar o corpo contra a direção do tiro.
      atualizarAnimacaoCaminhada(s, direcaoMovimento);
      assert.equal(s.player.flipX, lado < 0);
      assert.equal(s.armaPersonagemTeste.lasers[0].direcao.x < 0, lado < 0);
    }
  }
});

test("ao perder o alvo, volta a olhar para o movimento e mantém o disparo manual", () => {
  const s = cena(), alvo = inimigo(150, 0);
  s.inimigos = [alvo];
  s.player.body.velocity = { x: -100, y: 0 };
  atualizarArmaPersonagemTeste(s, 16);
  assert.equal(s.player.flipX, false);
  assert.equal(s.armaPersonagemTeste.lasers.length, 0);
  alvo.morto = true;
  atualizarArmaPersonagemTeste(s, 16);
  assert.equal(s.player.flipX, true);
  assert.equal(s.armaPersonagemTeste.alvo, null);
  assert.equal(s.armaPersonagemTeste.lasers.length, 0);
  s.player.body.velocity = { x: 0, y: 0 };
  atualizarArmaPersonagemTeste(s, 16);
  assert.equal(s.player.flipX, true);
});

test("recriar e encerrar removem lasers e listeners sem duplicar disparos", () => {
  const s = cena();
  atacar(s);
  const antigo = s.armaPersonagemTeste, laser = antigo.lasers[0];
  criarArmaPersonagemTeste(s);
  assert.equal(antigo.sprite.active, false);
  assert.equal(laser.sprite.active, false);
  assert.equal(s.events.listenerCount("postupdate"), 1);
  assert.equal(s.events.listenerCount("shutdown"), 1);
  s.events.emit("shutdown");
  assert.equal(s.armaPersonagemTeste, null);
  assert.equal(s.events.listenerCount("postupdate"), 0);
  assert.equal(s.events.listenerCount("shutdown"), 0);
});

test("ativo:false remove a arma e seus tiros na próxima atualização", () => {
  const s = cena();
  atacar(s);
  const sprite = s.armaPersonagemTeste.sprite;
  PERSONAGEM_TESTE.ativo = false;
  atualizarArmaPersonagemTeste(s, 16);
  assert.equal(sprite.active, false);
  assert.equal(s.armaPersonagemTeste, null);
});

test("troca alterna rifle e espada sem iniciar ataques", () => {
  const s = cena();
  assert.equal(trocarArmaPersonagemTeste(s), true);
  assert.equal(s.armaPersonagemTeste.config, ESPADA_PERSONAGEM_TESTE);
  assert.equal(s.armaPersonagemTeste.golpeEspada, null);
  assert.equal(trocarArmaPersonagemTeste(s), true);
  assert.equal(s.armaPersonagemTeste.config, config);
  assert.equal(s.armaPersonagemTeste.lasers.length, 0);
});

test("troca preserva cadência, dano do laser em voo e arma equipada ao recriar", t => {
  const extra = { ...config, id: "segunda-arma-de-teste", textura: "segunda-textura",
    danoLaser: 5, velocidadeLaser: 100, alcanceLaser: 50 };
  ARMAS_PERSONAGEM_TESTE.push(extra);
  t.after(() => ARMAS_PERSONAGEM_TESTE.pop());
  const s = cena(), registro = new Map();
  s.game = { registry: registro };
  assert.equal(atacar(s), true);
  const tiro = s.armaPersonagemTeste.lasers[0];
  assert.equal(trocarArmaPersonagemTeste(s), true);
  assert.equal(trocarArmaPersonagemTeste(s), true);
  assert.equal(s.armaPersonagemTeste.config, extra);
  assert.equal(registro.get("personagem-teste-arma-equipada"), extra.id);
  assert.equal(atacar(s), false, "trocar não pode burlar a cadência");
  s.inimigos = [inimigo(150, 12)];
  atualizarArmaPersonagemTeste(s, 500);
  assert.equal(s.inimigos[0].vida, 75, "laser anterior conserva os 25 de dano");
  assert.equal(tiro.sprite.active, false);
  criarArmaPersonagemTeste(s);
  assert.equal(s.armaPersonagemTeste.config, extra);
  assert.equal(trocarArmaPersonagemTeste(s), true);
  assert.equal(s.armaPersonagemTeste.config, config);
});

function cenaEspada() {
  const s = cena();
  trocarArmaPersonagemTeste(s);
  return s;
}
function avancar(s, tempo) {
  const delta = tempo - s.time.now;
  s.time.now = tempo;
  atualizarArmaPersonagemTeste(s, delta);
}
const gEspada = ESPADA_PERSONAGEM_TESTE.golpe;
const duracaoGolpe = gEspada.preparo + gEspada.quadros * gEspada.msPorQuadro + gEspada.recuperacao;
function avancarAte(s, tempo) {
  while (s.time.now < tempo) avancar(s, Math.min(tempo, s.time.now + 10));
}

test("recorte cabe na Assassin WebP e as armas ficam próximas da altura visível da personagem", () => {
  const c = ESPADA_PERSONAGEM_TESTE;
  const png = readFileSync(new URL("../../assets/" + c.arquivo, import.meta.url));
  assert.equal(png.toString("ascii", 8, 12), "WEBP");
  assert.equal(png.toString("ascii", 12, 16), "VP8L");
  const dimensoes = png.readUInt32LE(21);
  assert.ok(c.recorte.x + c.recorte.largura <= (dimensoes & 0x3fff) + 1);
  assert.ok(c.recorte.y + c.recorte.altura <= ((dimensoes >>> 14) & 0x3fff) + 1);
  for (const ponto of [c.empunhadura, c.cano]) {
    assert.ok(ponto.x >= 0 && ponto.x < c.recorte.largura);
    assert.ok(ponto.y >= 0 && ponto.y < c.recorte.altura);
  }
  const alcance = Math.hypot(c.cano.x - c.empunhadura.x, c.cano.y - c.empunhadura.y) *
    c.largura / c.recorte.largura;
  assert.ok(alcance >= 34 && alcance <= 37);
  const f = FLORETE_PERSONAGEM_TESTE;
  const alcanceFlorete = Math.hypot(f.cano.x - f.empunhadura.x, f.cano.y - f.empunhadura.y) *
    f.largura / f.recorte.largura;
  assert.ok(alcanceFlorete >= 40 && alcanceFlorete <= 43);
  near(c.anguloArte, Math.atan2(c.cano.y - c.empunhadura.y, c.cano.x - c.empunhadura.x));
});

test("espada usa o mesmo relógio para lâmina e nove quadros, com efeito sobre a lâmina", () => {
  const s = cenaEspada();
  s.player.depth = 100;
  assert.equal(atacar(s), true);
  const golpe = s.armaPersonagemTeste.golpeEspada;
  assert.equal(golpe.efeito.visible, false);
  assert.equal(s.armaPersonagemTeste.lasers.length, 0);
  for (let i = 0; i < 9; i++) {
    const t = gEspada.preparo + i * gEspada.msPorQuadro;
    avancarAte(s, t);
    const estado = s.armaPersonagemTeste;
    assert.equal(golpe.efeito.texture.key, ESPADA_PERSONAGEM_TESTE.golpe.prefixoTextura + i);
    near(estado.sprite.rotation,
      golpe.angulo + calcularFaseEspada(estado.config, t).angulo - estado.config.anguloArte);
    assert.equal(golpe.efeito.visible, true);
    assert.ok(golpe.efeito.depth > s.player.depth);
    assert.ok(golpe.efeito.depth > estado.sprite.depth);
    near(golpe.efeito.scaleX * gEspada.raioEfeito,
      Math.hypot(estado.pose.cano.x - estado.pose.mao.x, estado.pose.cano.y - estado.pose.mao.y));
    near(estado.sprite.depth, s.player.depth + 0.1);
    assert.equal(estado.clarao.visible, false);
  }
  avancarAte(s, duracaoGolpe);
  assert.equal(s.armaPersonagemTeste.golpeEspada, null);
  assert.equal(golpe.efeito.active, false);
});

test("golpe só causa dano na fase ativa e acerta cada inimigo uma vez", () => {
  const s = cenaEspada(), frente = inimigo(40, 18), costas = inimigo(-40, 18), longe = inimigo(150, 18);
  s.inimigos = [frente, costas, longe];
  atacar(s);
  avancarAte(s, gEspada.preparo + gEspada.msPorQuadro - 1);
  assert.equal(frente.vida, 100);
  avancarAte(s, gEspada.preparo + (gEspada.quadroAtivoFim + 1) * gEspada.msPorQuadro);
  assert.equal(frente.vida, 65);
  assert.equal(costas.vida, 100);
  assert.equal(longe.vida, 100);
  avancarAte(s, duracaoGolpe);
  assert.equal(frente.vida, 65);
});

test("os três atalhos mostram todos os quadros a 60, 30 e 7 FPS e após travamento", () => {
  for (const g of GOLPES_ESPADA_TESTE) {
    for (const intervalo of [1000 / 60, 1000 / 30, 1000 / 7, 600]) {
      const s = cenaEspada(), alvo = inimigo(40, 18), vistos = [];
      s.inimigos = [alvo];
      s.input.keyboard.emit("keydown-" + g.tecla, { repeat: false });
      const golpe = s.armaPersonagemTeste.golpeEspada;
      assert.equal(golpe.config, g);
      for (let i = 0; i < 120 && s.armaPersonagemTeste.golpeEspada; i++) {
        avancar(s, s.time.now + intervalo);
        if (golpe.efeito.active && golpe.efeito.visible) {
          const quadro = Number(golpe.efeito.texture.key.split("-").at(-1));
          if (vistos.at(-1) !== quadro) vistos.push(quadro);
          near(s.armaPersonagemTeste.sprite.rotation,
            golpe.angulo + calcularFaseEspada(ESPADA_PERSONAGEM_TESTE, golpe.tempo, g).angulo -
            ESPADA_PERSONAGEM_TESTE.anguloArte);
          if (quadro < g.quadroAtivoInicio) assert.equal(alvo.vida, 100);
          assert.ok(golpe.efeito.depth > s.armaPersonagemTeste.sprite.depth);
        }
      }
      assert.deepEqual(vistos, Array.from({ length: g.quadros }, (_, i) => i),
        `${g.id}, ${intervalo} ms por atualização`);
      assert.equal(alvo.vida, 65);
      assert.equal(s.armaPersonagemTeste.golpeEspada, null);
      assert.equal(golpe.efeito.active, false);
    }
  }
});

test("B/N/M exigem espada, não repetem por tecla segurada nem interrompem outro golpe", () => {
  const s = cena();
  s.input.keyboard.emit("keydown-B", {});
  assert.equal(s.armaPersonagemTeste.golpeEspada, null);
  assert.equal(s.armaPersonagemTeste.lasers.length, 0);
  trocarArmaPersonagemTeste(s);
  s.input.keyboard.emit("keydown-B", { repeat: true });
  assert.equal(s.armaPersonagemTeste.golpeEspada, null);
  s.input.keyboard.emit("keydown-B", {});
  const golpe = s.armaPersonagemTeste.golpeEspada;
  s.input.keyboard.emit("keydown-N", {});
  assert.equal(s.armaPersonagemTeste.golpeEspada, golpe);
  assert.equal(golpe.config.id, "slash-1");
  avancarAte(s, ESPADA_PERSONAGEM_TESTE.intervaloDisparos);
  s.generatorMenuOpen = true;
  s.input.keyboard.emit("keydown-N", {});
  assert.equal(s.armaPersonagemTeste.golpeEspada, null);
});

test("recriar e encerrar limpam os três atalhos; outros personagens não os recebem", () => {
  const s = cenaEspada();
  for (let i = 0; i < 3; i++) criarArmaPersonagemTeste(s);
  for (const g of GOLPES_ESPADA_TESTE) assert.equal(s.input.keyboard.listenerCount("keydown-" + g.tecla), 1);
  s.events.emit("shutdown");
  for (const g of GOLPES_ESPADA_TESTE) assert.equal(s.input.keyboard.listenerCount("keydown-" + g.tecla), 0);
  s.personagemSelecionada = "kai-mercer";
  criarArmaPersonagemTeste(s);
  for (const g of GOLPES_ESPADA_TESTE) assert.equal(s.input.keyboard.listenerCount("keydown-" + g.tecla), 0);
});

test("os três efeitos giram pela mão, acompanham o raio da lâmina e espelham", () => {
  for (const g of GOLPES_ESPADA_TESTE) {
    for (const lado of [-1, 1]) {
      const s = cenaEspada();
      s.armaPersonagemTeste.direcao = { x: lado, y: 0 };
      s.input.keyboard.emit("keydown-" + g.tecla, {});
      s.player.depth = 172;
      for (let quadro = 0; quadro < g.quadros; quadro++) {
        avancarAte(s, g.preparo + g.msPorQuadro * quadro);
        const w = s.armaPersonagemTeste, e = w.golpeEspada.efeito;
        assert.ok(e.depth > w.sprite.depth);
        assert.equal(e.flipX, lado < 0 && g.rotacaoEfeito === 90);
        assert.equal(e.flipY, lado < 0 && g.rotacaoEfeito === 0);
        const { x, y } = g.origemEfeito;
        near(e.originX, e.flipX ? 1 - x / 128 : x / 128);
        near(e.originY, e.flipY ? 1 - y / 128 : y / 128);
        near(e.x, w.pose.mao.x);
        near(e.y, w.pose.mao.y);
        near(e.scaleX * g.raioEfeito, Math.hypot(w.pose.cano.x - w.pose.mao.x, w.pose.cano.y - w.pose.mao.y));
      }
    }
  }
});

test("espada respeita paredes entre a empunhadura e o inimigo", () => {
  const s = cenaEspada(), alvo = inimigo(32, 18);
  s.inimigos = [alvo];
  s.collisionGroup = { getChildren: () => [{ active: true,
    body: { x: 18, y: -100, width: 2, height: 200 } }] };
  atacar(s);
  avancarAte(s, duracaoGolpe);
  assert.equal(alvo.vida, 100);
});

test("giro da espada tem velocidade contínua entre quadros e não ultrapassa o arco", () => {
  for (const g of GOLPES_ESPADA_TESTE) {
    const angulo = t => calcularFaseEspada(ESPADA_PERSONAGEM_TESTE, t, g).angulo;
    for (let i = 0; i < g.quadros - 1; i++) {
      const t = g.preparo + i * g.msPorQuadro;
      const minimo = Math.min(g.angulos[i], g.angulos[i + 1]) * Math.PI / 180;
      const maximo = Math.max(g.angulos[i], g.angulos[i + 1]) * Math.PI / 180;
      for (let dt = 0; dt < g.msPorQuadro; dt++) {
        assert.ok(angulo(t + dt) >= minimo - 1e-8 && angulo(t + dt) <= maximo + 1e-8);
      }
      const antes = (angulo(t) - angulo(t - 0.001)) / 0.001;
      const depois = (angulo(t + 0.001) - angulo(t)) / 0.001;
      assert.ok(Math.abs(antes - depois) < 0.00001, `${g.id}, quadro ${i}`);
    }
  }
});

test("arco e lâmina giram juntos entre quadros e a empunhadura encaixa em cada personagem", () => {
  for (const personagem of [PERSONAGEM_TESTE, PERSONAGEM_TESTE_2]) {
    for (const lado of [-1, 1]) {
      const s = cenaEspada();
      s.personagemSelecionada = personagem.id;
      criarArmaPersonagemTeste(s);
      if (s.armaPersonagemTeste.config.tipo !== "espada") trocarArmaPersonagemTeste(s);
      s.armaPersonagemTeste.direcao = { x: lado, y: 0 };
      atacar(s);
      const w = s.armaPersonagemTeste, g = w.golpeEspada.config;
      avancarAte(s, g.preparo + 2 * g.msPorQuadro + 5);
      const angulo = w.pose.angulo, rotacao = w.golpeEspada.efeito.rotation;
      avancarAte(s, s.time.now + 20);
      near(w.pose.angulo - angulo, w.golpeEspada.efeito.rotation - rotacao);
      const encaixe = personagem.encaixeArmas?.espada ?? ESPADA_PERSONAGEM_TESTE;
      near(w.pose.mao.x, s.player.x + lado * encaixe.maoX);
      near(w.pose.mao.y, s.player.y + encaixe.maoY);
    }
  }
});

test("espada causa dano ao boss sem criar laser", () => {
  const s = cenaEspada();
  s.bossFinal = inimigo(32, 18, { sprite: objeto() });
  atacar(s); avancarAte(s, duracaoGolpe);
  assert.equal(s.bossFinal.vida, 65);
  assert.equal(s.armaPersonagemTeste.lasers.length, 0);
  assert.equal(dispararLaserPersonagemTeste(s), false);
});

test("espada trava a direção do golpe, acompanha o recuo e espelha efeito e corpo à esquerda", () => {
  const s = cenaEspada(), alvo = inimigo(-32, 18);
  s.inimigos = [alvo];
  s.player.body.velocity = { x: 100, y: 0 };
  atacar(s);
  const golpe = s.armaPersonagemTeste.golpeEspada;
  const angulo = golpe.angulo;
  alvo.hitboxDano.x = 20; alvo.x = 30;
  s.player.x = 10;
  const t = gEspada.preparo + 3 * gEspada.msPorQuadro;
  avancarAte(s, t);
  assert.equal(s.player.flipX, true);
  assert.equal(golpe.efeito.flipX, true);
  assert.equal(golpe.angulo, angulo);
  const pose = s.armaPersonagemTeste.pose;
  near(golpe.efeito.x, pose.mao.x);
  near(s.armaPersonagemTeste.sprite.rotation,
    angulo - calcularFaseEspada(ESPADA_PERSONAGEM_TESTE, t).angulo + ESPADA_PERSONAGEM_TESTE.anguloArte);
  assert.deepEqual(s.player.body.velocity, { x: 100, y: 0 });
});

test("mirar na vertical mantém a mesma mão durante toda a animação", () => {
  for (const y of [-60, 60]) {
    const s = cenaEspada();
    s.inimigos = [inimigo(0, y)];
    atacar(s);
    const estado = s.armaPersonagemTeste, golpe = estado.golpeEspada;
    assert.equal(golpe.esquerda, false);
    for (const t of [90, 140, 240, 390, 540]) {
      avancarAte(s, t);
      assert.equal(s.player.flipX, false);
      near(estado.pose.mao.x, s.player.x + PERSONAGEM_TESTE.encaixeArmas.espada.maoX);
      assert.equal(golpe.efeito.flipX, false);
    }
  }
});

test("não empilha golpes ou troca de arma no meio do efeito e respeita recuperação", () => {
  const s = cenaEspada();
  assert.equal(atacar(s), true);
  assert.equal(atacar(s), false);
  assert.equal(trocarArmaPersonagemTeste(s), false);
  avancarAte(s, duracaoGolpe);
  assert.equal(atacar(s), false);
  avancarAte(s, ESPADA_PERSONAGEM_TESTE.intervaloDisparos);
  assert.equal(atacar(s), true);
});

test("menu, morte e respawn removem o efeito e cancelam o dano pendente", () => {
  for (const bloqueio of ["generatorMenuOpen", "morteEmAndamento"]) {
    const s = cenaEspada(), alvo = inimigo(32, 18);
    s.inimigos = [alvo];
    atacar(s);
    const efeito = s.armaPersonagemTeste.golpeEspada.efeito;
    s[bloqueio] = true;
    avancar(s, 200);
    assert.equal(s.armaPersonagemTeste.golpeEspada, null);
    assert.equal(efeito.active, false);
    assert.equal(alvo.vida, 100);
  }
  const s = cenaEspada();
  atacar(s);
  const efeito = s.armaPersonagemTeste.golpeEspada.efeito;
  criarArmaPersonagemTeste(s);
  assert.equal(efeito.active, false);
  assert.equal(s.armaPersonagemTeste.golpeEspada, null);
  assert.equal(s.events.listenerCount("postupdate"), 1);
});

function cenaNovaPersonagem() {
  const s = cena();
  s.personagemSelecionada = PERSONAGEM_TESTE_2.id;
  criarArmaPersonagemTeste(s);
  return s;
}

test("nova personagem usa oito frames de idle e dezesseis de caminhada em todas as direções", () => {
  const animacoes = [];
  const s = { personagemSelecionada: PERSONAGEM_TESTE_2.id,
    anims: { create: a => animacoes.push(a),
      generateFrameNumbers: (textura, intervalo) => ({ textura, ...intervalo }) } };
  criarAnimacoesPersonagemTeste(s);
  for (const direcao of ["up", "down", "left", "right"]) {
    const idle = animacoes.find(a => a.key === "idle-" + direcao);
    const walk = animacoes.find(a => a.key === "walk-" + direcao);
    assert.deepEqual(idle.frames, { textura: PERSONAGEM_TESTE_2.textura, start: 0, end: 7 });
    assert.deepEqual(walk.frames, { textura: PERSONAGEM_TESTE_2.walk.textura, start: 0, end: 15 });
    assert.equal(walk.frameRate, 12);
  }
});

test("nova personagem alinha os pés e mantém a colisão do mesmo tamanho ao espelhar", () => {
  const s = cenaNovaPersonagem(), p = s.player;
  p.setDisplayOrigin = (x, y) => Object.assign(p, { displayOriginX: x, displayOriginY: y });
  p.body.setSize = (width, height) => Object.assign(p.body, { width, height });
  p.body.setOffset = (x, y) => { p.body.offset = { x, y }; };
  configurarVisualPersonagemTeste(s);
  configurarHitboxPersonagemTeste(s);
  near((PERSONAGEM_TESTE_2.peY - p.displayOriginY) * p.scaleY, 26);
  near(p.body.width * p.scaleX, 30); near(p.body.height * p.scaleY, 15);
  for (const x of [-100, 100]) {
    p.body.velocity = { x, y: 0 };
    atualizarAnimacaoCaminhada(s, x < 0 ? "left" : "right");
    atualizarArmaPersonagemTeste(s, 16);
    assert.equal(p.flipX, x < 0);
    near(p.body.width * p.scaleX, 30);
  }
});

test("nova personagem alterna as quatro armas do PDF e restaura a seleção própria", () => {
  const s = cenaNovaPersonagem();
  s.game = { registry: new Map([["personagem-teste-arma-equipada", "rifle-teste"]]) };
  criarArmaPersonagemTeste(s);
  assert.equal(s.armaPersonagemTeste.config, ESPADA_PERSONAGEM_TESTE);
  for (const arma of [FLORETE_PERSONAGEM_TESTE, config, ARMA_DOURADA_TESTE, ESPADA_PERSONAGEM_TESTE]) {
    assert.equal(trocarArmaPersonagemTeste(s), true);
    assert.equal(s.armaPersonagemTeste.config, arma);
  }
  assert.equal(dispararLaserPersonagemTeste(s), false);
  criarArmaPersonagemTeste(s);
  assert.equal(s.armaPersonagemTeste.config, ESPADA_PERSONAGEM_TESTE);
});

test("botão padrão alterna Slash 3, 2, 1 e reinicia a sequência após pausa", () => {
  const s = cenaNovaPersonagem();
  for (const id of ["slash-3", "slash-2", "slash-1", "slash-3"]) {
    assert.equal(atacar(s), true);
    const golpe = s.armaPersonagemTeste.golpeEspada, g = golpe.config;
    assert.equal(g.id, id);
    avancarAte(s, s.time.now + g.preparo + g.quadros * g.msPorQuadro + g.recuperacao);
    assert.equal(s.armaPersonagemTeste.golpeEspada, null);
  }
  avancarAte(s, s.time.now + PERSONAGEM_TESTE_2.combo.janela + 1);
  atacar(s);
  assert.equal(s.armaPersonagemTeste.golpeEspada.config.id, "slash-3");
});

test("combo aceita um próximo toque no final, preserva todos os frames e emenda sem saltar a lâmina", () => {
  for (const lado of [-1, 1]) {
    const s = cenaNovaPersonagem(), vistos = [];
    s.armaPersonagemTeste.direcao = { x: lado, y: 0 };
    atacar(s);
    for (const g of ESPADA_PERSONAGEM_TESTE.sequencia) {
      const golpe = s.armaPersonagemTeste.golpeEspada;
      assert.equal(golpe.config, g);
      const inicio = s.time.now;
      assert.equal(atacar(s), false, "toque muito cedo não prepara ataque invisível");
      for (let i = 0; i < g.quadros; i++) {
        avancarAte(s, inicio + g.preparo + i * g.msPorQuadro);
        vistos.push(golpe.efeito.texture.key);
        if (i === g.quadros - 2) {
          assert.equal(atacar(s), true, "guarda um toque próximo do fim");
          assert.equal(atacar(s), false, "não acumula vários ataques");
        }
      }
      const anguloFinal = golpe.angulo + g.angulos.at(-1) * Math.PI / 180 * lado;
      avancarAte(s, inicio + g.preparo + g.quadros * g.msPorQuadro);
      assert.notEqual(s.armaPersonagemTeste.golpeEspada, golpe);
      assert.equal(golpe.efeito.active, false);
      near(Math.sin(s.armaPersonagemTeste.pose.angulo - anguloFinal), 0);
      near(Math.cos(s.armaPersonagemTeste.pose.angulo - anguloFinal), 1);
      assert.equal(s.player.flipX, lado < 0);
    }
    assert.deepEqual(vistos, ESPADA_PERSONAGEM_TESTE.sequencia.flatMap(g =>
      Array.from({ length: g.quadros }, (_, i) => g.prefixoTextura + i)));
    assert.equal(s.armaPersonagemTeste.golpeEspada.config.id, "slash-3");
  }
});

test("um único toque não dispara o combo inteiro e cancelamento descarta o toque preparado", () => {
  const s = cenaNovaPersonagem();
  atacar(s);
  avancarAte(s, duracaoGolpe);
  assert.equal(s.armaPersonagemTeste.golpeEspada, null);
  avancarAte(s, 700);
  atacar(s);
  const g = s.armaPersonagemTeste.golpeEspada.config;
  avancarAte(s, 700 + g.preparo + (g.quadros - 2) * g.msPorQuadro);
  assert.equal(atacar(s), true);
  s.generatorMenuOpen = true;
  avancar(s, s.time.now + 16);
  assert.equal(s.armaPersonagemTeste.golpeEspada, null);
  assert.equal(s.armaPersonagemTeste.comboPendente, false);
  s.generatorMenuOpen = false;
  atacar(s);
  assert.equal(s.armaPersonagemTeste.golpeEspada.config.id, "slash-3");
});

test("combo com atualização lenta preserva os frames e não salta para repouso entre ataques", () => {
  for (const intervalo of [1000 / 30, 600]) {
    const s = cenaNovaPersonagem();
    atacar(s);
    for (const g of ESPADA_PERSONAGEM_TESTE.sequencia) {
      const atual = s.armaPersonagemTeste.golpeEspada, vistos = [];
      for (let i = 0; i < 40 && s.armaPersonagemTeste.golpeEspada === atual; i++) {
        avancar(s, s.time.now + intervalo);
        if (s.armaPersonagemTeste.golpeEspada !== atual) break;
        const quadro = calcularFaseEspada(ESPADA_PERSONAGEM_TESTE, atual.tempo, g).quadro;
        if (quadro >= 0 && vistos.at(-1) !== quadro) vistos.push(quadro);
        if (quadro === g.quadros - 2) atacar(s);
      }
      assert.deepEqual(vistos, Array.from({ length: g.quadros }, (_, i) => i));
      const fim = atual.angulo + g.angulos.at(-1) * Math.PI / 180;
      near(Math.sin(s.armaPersonagemTeste.pose.angulo - fim), 0);
      near(Math.cos(s.armaPersonagemTeste.pose.angulo - fim), 1);
    }
  }
});

function cenaFlorete() {
  const s = cenaNovaPersonagem();
  trocarArmaPersonagemTeste(s);
  return s;
}

test("florete dá uma estocada manual, com preparo, extensão e retorno suaves", () => {
  const s = cenaFlorete(), c = FLORETE_PERSONAGEM_TESTE;
  assert.equal(s.armaPersonagemTeste.config, c);
  assert.equal(atacar(s), true);
  assert.equal(atacar(s), false);
  assert.equal(trocarArmaPersonagemTeste(s), false);
  const golpe = s.armaPersonagemTeste.estocada;
  avancarAte(s, c.estocada.preparo);
  near(calcularFaseFlorete(c, golpe.tempo).extensao, -c.estocada.recuo);
  avancarAte(s, c.estocada.preparo + c.estocada.avancar);
  near(calcularFaseFlorete(c, golpe.tempo).extensao, c.estocada.extensao);
  assert.ok(golpe.efeito.depth > s.armaPersonagemTeste.sprite.depth);
  assert.ok(golpe.efeito.linhas.every(l => Math.max(...l.map(Math.abs)) <= 26));
  avancarAte(s, 350);
  assert.equal(s.armaPersonagemTeste.estocada, null);
  assert.equal(golpe.efeito.active, false);
  assert.equal(s.armaPersonagemTeste.lasers.length, 0);
  assert.equal(atacar(s), true);
});

test("florete causa dano uma vez na direção da ponta, sem atingir lados ou costas", () => {
  const s = cenaFlorete(), frente = inimigo(55, 14), lateral = inimigo(55, 40), costas = inimigo(-32, 14);
  s.inimigos = [frente, lateral, costas];
  s.armaPersonagemTeste.alvo = frente;
  atacar(s);
  avancarAte(s, FLORETE_PERSONAGEM_TESTE.estocada.preparo - 1);
  assert.equal(frente.vida, 100);
  avancarAte(s, 140);
  assert.equal(frente.vida, 72);
  assert.equal(lateral.vida, 100);
  assert.equal(costas.vida, 100);
  avancarAte(s, 350);
  assert.equal(frente.vida, 72);
});

test("parede barra a estocada e o boss usa o sistema de dano existente", () => {
  const s = cenaFlorete(), alvo = inimigo(55, 14);
  s.inimigos = [alvo];
  s.collisionGroup = { getChildren: () => [{ active: true,
    body: { x: 40, y: -100, width: 3, height: 200 } }] };
  atacar(s); avancarAte(s, 350);
  assert.equal(alvo.vida, 100);
  const boss = cenaFlorete();
  boss.bossFinal = inimigo(48, 14, { sprite: objeto() });
  atacar(boss); avancarAte(boss, 350);
  assert.equal(boss.bossFinal.vida, 72);
});

test("estocada espelha e preserva a direção ao recuar ou cruzar o inimigo", () => {
  const s = cenaFlorete(), alvo = inimigo(-55, 14);
  s.inimigos = [alvo];
  s.player.body.velocity = { x: 100, y: 0 };
  atacar(s);
  alvo.x = 72; alvo.hitboxDano.x = 62;
  avancarAte(s, 120);
  const w = s.armaPersonagemTeste;
  assert.equal(s.player.flipX, true);
  assert.equal(w.estocada.esquerda, true);
  assert.ok(w.pose.cano.x < w.pose.mao.x);
  assert.ok(w.pose.mao.x < s.player.x - FLORETE_PERSONAGEM_TESTE.maoX);
  assert.deepEqual(s.player.body.velocity, { x: 100, y: 0 });
});

test("impulso do florete soma um passo curto à física e respeita bloqueio e knockback", () => {
  const s = cenaFlorete();
  atacar(s);
  assert.equal(obterImpulsoFlorete(s), null);
  avancarAte(s, 112);
  atualizarMovimento(s);
  assert.ok(s.player.body.velocity.x > 40 && s.player.body.velocity.x <= 55);
  near(s.player.body.velocity.y, 0);
  const velocidadeSemEntrada = s.player.body.velocity.x;
  s.teclasWASD = { esquerda: { isDown: true } };
  atualizarMovimento(s);
  near(s.player.body.velocity.x, velocidadeSemEntrada - 80);
  s.player.combatKnockbackUntil = s.time.now + 200;
  s.player.body.velocity = { x: -230, y: -50 };
  atualizarMovimento(s);
  assert.deepEqual(s.player.body.velocity, { x: -230, y: -50 });
  s.movimentoBloqueado = true;
  atualizarMovimento(s);
  assert.deepEqual(s.player.body.velocity, { x: 0, y: 0 });
  assert.equal(obterImpulsoFlorete(s), null);
});

test("primeiras estocadas dão um passo mínimo e limitam impulsos em FPS baixo", () => {
  const s = cenaFlorete();
  atacar(s);
  for (let t = 10; t <= 350; t += 10) {
    s.time.now = t;
    atualizarMovimento(s);
    s.player.x += s.player.body.velocity.x * 0.01;
    s.player.y += s.player.body.velocity.y * 0.01;
    atualizarArmaPersonagemTeste(s, 10);
  }
  assert.ok(s.player.x > 2 && s.player.x < 4, s.player.x);
  near(s.player.y, 0);
  const lento = cenaFlorete();
  atacar(lento); avancarAte(lento, 112);
  lento.game = { loop: { delta: 250 } };
  assert.ok(obterImpulsoFlorete(lento).x * 0.25 <= 4);
});

test("travamento não pula preparo nem aplica dano antes de exibir a estocada", () => {
  const s = cenaFlorete(), alvo = inimigo(55, 14);
  s.inimigos = [alvo];
  atacar(s);
  avancar(s, 600);
  assert.equal(alvo.vida, 100);
  assert.equal(s.armaPersonagemTeste.estocada.tempo, 40);
  for (let i = 0; i < 10; i++) avancar(s, s.time.now + 600);
  assert.equal(alvo.vida, 72);
  assert.equal(s.armaPersonagemTeste.estocada, null);
});

test("menu, morte, respawn e shutdown removem rastro e impulso do florete", () => {
  for (const bloqueio of ["generatorMenuOpen", "morteEmAndamento", "movimentoBloqueado"]) {
    const s = cenaFlorete();
    atacar(s); avancarAte(s, 110);
    const efeito = s.armaPersonagemTeste.estocada.efeito;
    s[bloqueio] = true;
    avancar(s, 120);
    assert.equal(s.armaPersonagemTeste.estocada, null);
    assert.equal(efeito.active, false);
    assert.equal(obterImpulsoFlorete(s), null);
  }
  for (const recriar of [true, false]) {
    const s = cenaFlorete();
    atacar(s);
    const efeito = s.armaPersonagemTeste.estocada.efeito;
    if (recriar) criarArmaPersonagemTeste(s); else s.events.emit("shutdown");
    assert.equal(efeito.active, false);
    assert.equal(obterImpulsoFlorete(s), null);
  }
});

function concluirEstocada(s, mover = false) {
  while (s.armaPersonagemTeste.estocada) {
    s.time.now += 10;
    if (mover) {
      atualizarMovimento(s);
      s.player.x += s.player.body.velocity.x * 0.01;
      s.player.y += s.player.body.velocity.y * 0.01;
    }
    atualizarArmaPersonagemTeste(s, 10);
  }
  avancarAte(s, Math.max(s.time.now, s.armaPersonagemTeste.proximoDisparo));
}

test("florete dá dash somente no terceiro ataque aceito e reinicia o ciclo", () => {
  const s = cenaFlorete(), distancias = [];
  for (const numero of [1, 2, 3, 1, 2, 3]) {
    assert.equal(atacar(s), true);
    const golpe = s.armaPersonagemTeste.estocada;
    assert.equal(golpe.numero, numero);
    assert.equal(golpe.dash, numero === 3);
    assert.equal(atacar(s), false);
    assert.equal(s.armaPersonagemTeste.estocadasConsecutivas, numero);
    const x = s.player.x;
    concluirEstocada(s, true);
    distancias.push(s.player.x - x);
  }
  for (const i of [0, 1, 3, 4]) assert.ok(distancias[i] > 2 && distancias[i] < 4, distancias);
  for (const i of [2, 5]) assert.ok(distancias[i] > 33 && distancias[i] < 40, distancias);
});

test("dash do terceiro golpe acontece durante a estocada e prevalece sobre andar de costas", () => {
  const s = cenaFlorete();
  for (let i = 0; i < 2; i++) { atacar(s); concluirEstocada(s); }
  atacar(s);
  const inicio = s.time.now, g = FLORETE_PERSONAGEM_TESTE.estocada;
  assert.equal(obterImpulsoFlorete(s), null);
  s.teclasWASD = { esquerda: { isDown: true } };
  avancarAte(s, inicio + g.preparo + g.avancarDash / 2);
  atualizarMovimento(s);
  assert.ok(s.player.body.velocity.x > 350);
  near(s.player.body.velocity.y, 0);
  assert.ok(s.armaPersonagemTeste.estocada.efeito.visible);
  s.game = { loop: { delta: 250 } };
  assert.ok(obterImpulsoFlorete(s).x * 0.25 <= 12);
  avancarAte(s, inicio + g.preparo + g.avancarDash);
  assert.equal(obterImpulsoFlorete(s), null);
  atualizarMovimento(s);
  assert.ok(s.player.body.velocity.x < 0); // Devolve o controle na recuperação.
});

test("pausa, troca de arma e interrupção reiniciam a contagem do dash do florete", () => {
  for (const interrupcao of ["pausa", "troca", "menu"]) {
    const s = cenaFlorete();
    for (let i = 0; i < 2; i++) { atacar(s); concluirEstocada(s); }
    if (interrupcao === "pausa") {
      avancarAte(s, s.time.now + FLORETE_PERSONAGEM_TESTE.estocada.janelaCombo + 1);
    } else if (interrupcao === "troca") {
      trocarArmaPersonagemTeste(s); trocarArmaPersonagemTeste(s);
    } else {
      atacar(s);
      assert.equal(s.armaPersonagemTeste.estocada.dash, true);
      s.generatorMenuOpen = true;
      avancar(s, s.time.now + 10);
      s.generatorMenuOpen = false;
      avancarAte(s, s.armaPersonagemTeste.proximoDisparo);
    }
    assert.equal(atacar(s), true);
    assert.equal(s.armaPersonagemTeste.estocada.numero, 1);
    assert.equal(s.armaPersonagemTeste.estocada.dash, false);
  }
});

test("saldo insuficiente bloqueia o tiro sem consumir recurso ou cadência", () => {
  const s = cena(); s.estamina = 2;
  assert.equal(atacar(s), false);
  assert.equal(s.estamina, 2); assert.equal(s.armaPersonagemTeste.lasers.length, 0);
  assert.equal(s.armaPersonagemTeste.proximoDisparo, 0);
  s.estamina = 3; assert.equal(atacar(s), true); assert.equal(s.estamina, 0);
  s.time.now += config.intervaloDisparos;
  assert.equal(atacar(s), false); assert.equal(s.estamina, 0);
});

test("todas as armas corpo a corpo cobram um por golpe e recusam saldo zero", () => {
  for (const criar of [cenaEspada, cenaFlorete, () => {
    const s = cenaFlorete(); trocarArmaPersonagemTeste(s); trocarArmaPersonagemTeste(s); return s;
  }]) {
    const s = criar(); s.estamina = 0;
    assert.equal(atacar(s), false);
    assert.equal(s.armaPersonagemTeste.golpeEspada, null);
    assert.equal(s.armaPersonagemTeste.estocada, null);
    s.estamina = 1; assert.equal(atacar(s), true); assert.equal(s.estamina, 0);
    assert.equal(atacar(s), false); assert.equal(s.estamina, 0);
  }
});

test("combo só cobra quando começa a próxima etapa e encerra se o saldo acabar", () => {
  for (const saldo of [1, 2]) {
    const s = cenaNovaPersonagem(); s.estamina = saldo;
    assert.equal(atacar(s), true); assert.equal(s.estamina, saldo - 1);
    const atual = s.armaPersonagemTeste.golpeEspada, g = atual.config;
    avancarAte(s, g.preparo + (g.quadros - 2) * g.msPorQuadro);
    assert.equal(atacar(s), true);
    assert.equal(s.estamina, saldo - 1, "Fila não é um golpe executado.");
    avancarAte(s, g.preparo + g.quadros * g.msPorQuadro);
    assert.equal(s.estamina, 0);
    assert.equal(Boolean(s.armaPersonagemTeste.golpeEspada), saldo === 2);
    assert.equal(s.armaPersonagemTeste.comboPendente, false);
  }
});
