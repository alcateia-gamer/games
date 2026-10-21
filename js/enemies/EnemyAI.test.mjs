/**
 * @file Exercita percepção, memória, cooperação e recuo usando a IA, navegação e lasers reais.
 * O Phaser simulado registra comandos; não reproduz a física ou a renderização do jogo.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { atualizarIAInimigo, notificarGrupo } from "./EnemyAI.js";

class Rectangle {
  constructor(x, y, width, height) {
    Object.assign(this, { x, y, width, height });
  }
  get left() { return this.x; }
  get right() { return this.x + this.width; }
  get top() { return this.y; }
  get bottom() { return this.y + this.height; }
  get centerX() { return this.x + this.width / 2; }
  get centerY() { return this.y + this.height / 2; }
  static Contains(rect, x, y) {
    return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
  }
}

function segmentoCruzaRetangulo(line, rect) {
  let entrada = 0;
  let saida = 1;
  for (const [inicio, fim, min, max] of [
    [line.x1, line.x2, rect.left, rect.right],
    [line.y1, line.y2, rect.top, rect.bottom],
  ]) {
    const delta = fim - inicio;
    if (Math.abs(delta) < 1e-10) {
      if (inicio < min || inicio > max) return false;
      continue;
    }
    const a = (min - inicio) / delta;
    const b = (max - inicio) / delta;
    entrada = Math.max(entrada, Math.min(a, b));
    saida = Math.min(saida, Math.max(a, b));
    if (entrada > saida) return false;
  }
  return true;
}

globalThis.Phaser = {
  Math: {
    Distance: { Between: (x, y, a, b) => Math.hypot(a - x, b - y) },
    Angle: { Between: (x, y, a, b) => Math.atan2(b - y, a - x) },
    Clamp: (value, min, max) => Math.min(max, Math.max(min, value)),
  },
  Geom: {
    Rectangle,
    Line: class {
      constructor(x1, y1, x2, y2) { Object.assign(this, { x1, y1, x2, y2 }); }
    },
    Intersects: {
      LineToRectangle: segmentoCruzaRetangulo,
      RectangleToRectangle: (a, b) => a.left < b.right && a.right > b.left &&
        a.top < b.bottom && a.bottom > b.top,
    },
  },
};

function criarRobo(overrides = {}) {
  const robo = {
    x: 0, y: 0, active: true, tipoRobo: "disparo", direcaoAtual: "right",
    velocidade: 100, distanciaAtaque: 330, vida: 100, vidaMaxima: 100,
    ultimoTiro: -Infinity, tempoEntreTiros: 250, velocidadeLaser: 250,
    estado: "idle", alerta: false,
    body: {
      enable: true, x: -12, y: -12, width: 24, height: 24,
      velocity: { x: 0, y: 0 },
      blocked: { up: false, down: false, left: false, right: false },
      touching: { up: false, down: false, left: false, right: false },
    },
    anims: {
      isPlaying: false, inReverse: false,
      play(key, ignoreIfPlaying = false) {
        if (ignoreIfPlaying && this.isPlaying && this.currentAnim?.key === key) return this;
        this.isPlaying = true;
        this.inReverse = false;
        this.currentAnim = { key };
        return this;
      },
      playReverse(key, ignoreIfPlaying = false) {
        if (ignoreIfPlaying && this.isPlaying && this.currentAnim?.key === key) return this;
        this.isPlaying = true;
        this.inReverse = true;
        this.currentAnim = { key };
        return this;
      },
      stop() { this.isPlaying = false; },
    },
    setVelocity(x, y) { Object.assign(this.body.velocity, { x, y }); return this; },
    setFrame(name) { this.frame = { name }; return this; },
    setTexture(key) { this.texture = { key }; return this; },
  };
  Object.assign(robo, overrides);
  posicionar(robo, robo.x, robo.y);
  return robo;
}

function posicionar(robo, x, y) {
  Object.assign(robo, { x, y });
  Object.assign(robo.body, { x: x - robo.body.width / 2, y: y - robo.body.height / 2 });
}

function criarCena({ player = { x: 300, y: 0 }, robos = [criarRobo()], paredes = [] } = {}) {
  const lasers = [];
  const scene = {
    player: { active: true, ...player }, inimigos: robos,
    collisionGroup: { getChildren: () => paredes },
    time: { now: 1000, delayedCall() {} },
    lasersInimigo: { add(laser) { lasers.push(laser); }, getChildren: () => lasers },
    sound: { play() {} },
    add: {
      circle(x, y) {
        return {
          x, y, active: true,
          body: { velocity: { x: 0, y: 0 }, setAllowGravity() {} },
          setDepth() {}, setStrokeStyle() {}, destroy() { this.active = false; },
        };
      },
    },
    physics: {
      add: { existing() {} },
      moveTo(robo, x, y, speed) {
        const d = Math.hypot(x - robo.x, y - robo.y);
        robo.ultimoMovimento = { x, y };
        robo.setVelocity(d ? (x - robo.x) / d * speed : 0,
          d ? (y - robo.y) / d * speed : 0);
      },
      velocityFromRotation(angle, speed, velocity) {
        Object.assign(velocity, { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed });
      },
    },
  };
  return scene;
}

const parede = (x, y, width, height) => ({ body: { enable: true, x, y, width, height } });
const parado = robo => Math.hypot(robo.body.velocity.x, robo.body.velocity.y) < 1e-8;
function atualizar(scene, robo = scene.inimigos[0], agora = scene.time.now) {
  scene.time.now = agora;
  atualizarIAInimigo(scene, agora, robo);
}

test("visão mantém semicírculo frontal e alcança 760 pixels por padrão", () => {
  for (const [player, esperado] of [
    [{ x: 700, y: 0 }, true],
    [{ x: 760, y: 0 }, true],
    [{ x: 761, y: 0 }, false],
    [{ x: 0, y: 700 }, true],
    [{ x: -10, y: 0 }, false],
  ]) {
    const scene = criarCena({ player });
    atualizar(scene);
    assert.equal(scene.inimigos[0].alerta, esperado, JSON.stringify(player));
  }
});

test("paredes bloqueiam a visão mesmo com jogador bem próximo", () => {
  const scene = criarCena({ player: { x: 50, y: 0 }, paredes: [parede(20, -40, 10, 80)] });
  atualizar(scene);
  assert.equal(scene.inimigos[0].alerta, false);
  assert.equal(scene.lasersInimigo.getChildren().length, 0);
});

test("alcance de detecção configurado no robô continua sendo respeitado", () => {
  const robo = criarRobo({ distanciaDeteccao: 250 });
  const scene = criarCena({ robos: [robo], player: { x: 260, y: 0 } });
  atualizar(scene);
  assert.equal(robo.alerta, false);
});

test("avistar jogador alerta aliados próximos sem cascata nem coordenadas ocultas", () => {
  const origem = criarRobo();
  const proximo = criarRobo({ x: 350, direcaoAtual: "left" });
  const distante = criarRobo({ x: 430 });
  const eloDistante = criarRobo({ x: 700 });
  const morto = criarRobo({ x: 50, morto: true });
  const remoto = criarRobo({ x: 60, remoteOnly: true });
  const inativo = criarRobo({ x: 70, active: false });
  const semFisica = criarRobo({ x: 80 });
  semFisica.body.enable = false;
  const scene = criarCena({
    player: { x: 500, y: 0 },
    robos: [origem, proximo, distante, eloDistante, morto, remoto, inativo, semFisica],
    paredes: [parede(400, 50, 20, 500)],
  });
  atualizar(scene, origem);
  assert.equal(proximo.alerta, true);
  for (const robo of [distante, eloDistante, morto, remoto, inativo, semFisica]) {
    assert.equal(robo.alerta, false);
  }

  Object.assign(scene.player, { x: 500, y: 300 });
  atualizar(scene, proximo, 1300);
  assert.ok(proximo.body.velocity.x > 0);
  assert.equal(proximo.body.velocity.y, 0, "aliado investiga o local informado, sem seguir alvo oculto");
  assert.equal(eloDistante.alerta, false, "investigação de aliado não retransmite o alerta");
  assert.equal(scene.lasersInimigo.getChildren().length, 0);
});

test("alerta por dano alcança 420 pixels e indica a origem quando não há alvo conhecido", () => {
  const origem = criarRobo({ x: 200 });
  const proximo = criarRobo({ x: 600, direcaoAtual: "right" });
  const distante = criarRobo({ x: 630 });
  const scene = criarCena({ player: { x: -1200, y: 0 }, robos: [origem, proximo, distante] });
  notificarGrupo(scene, origem);
  assert.equal(proximo.alerta, true);
  assert.equal(distante.alerta, false);
  atualizar(scene, proximo, 1300);
  assert.deepEqual(proximo.ultimoMovimento, { x: 200, y: 0 });
  assert.equal(scene.lasersInimigo.getChildren().length, 0);
});

test("robôs mortos, remotos ou inativos não emitem alerta", () => {
  for (const overrides of [{ morto: true }, { remoteOnly: true }, { active: false }]) {
    const origem = criarRobo(overrides);
    const aliado = criarRobo({ x: 100 });
    const scene = criarCena({ robos: [origem, aliado] });
    notificarGrupo(scene, origem, "visao");
    notificarGrupo(scene, origem, "dano");
    assert.equal(aliado.alerta, false, JSON.stringify(overrides));
  }
});

test("dano compartilha o último ponto visto sem revelar a posição atual atrás de parede", () => {
  const origem = criarRobo();
  const scene = criarCena({ robos: [origem], paredes: [parede(120, 80, 40, 400)] });
  atualizar(scene, origem);
  Object.assign(scene.player, { x: 300, y: 300 });
  atualizar(scene, origem, 1300);
  const aliado = criarRobo({ x: -100 });
  scene.inimigos.push(aliado);
  scene.time.now = 3000;
  notificarGrupo(scene, origem, "dano");
  atualizar(scene, aliado);
  assert.deepEqual(aliado.ultimoMovimento, { x: 300, y: 0 });
});

test("alerta de dano descarta a pista expirada e indica o local atual do robô atingido", () => {
  const origem = criarRobo();
  const scene = criarCena({ robos: [origem], paredes: [parede(-100, 80, 900, 40)] });
  atualizar(scene, origem);
  Object.assign(scene.player, { x: 300, y: 300 });
  posicionar(origem, 100, 0);
  const aliado = criarRobo({ x: -100 });
  scene.inimigos.push(aliado);

  // A última visão ocorreu em 1000; o rádio não deve reviver a pista após nove segundos.
  scene.time.now = 10001;
  notificarGrupo(scene, origem, "dano");
  atualizar(scene, aliado);
  assert.deepEqual(aliado.ultimoMovimento, { x: 100, y: 0 });
  assert.equal(scene.lasersInimigo.getChildren().length, 1);
});

test("novo dano após encerrar a busca faz origem e aliado investigar o local atual", () => {
  const origem = criarRobo();
  const scene = criarCena({
    robos: [origem], player: { x: 400, y: 0 }, paredes: [parede(-100, 80, 900, 40)],
  });
  atualizar(scene, origem);
  assert.equal(origem.iaEstado, "combate");

  Object.assign(scene.player, { x: 400, y: 400 });
  posicionar(origem, 200, 0);
  atualizar(scene, origem, 2000);
  atualizar(scene, origem, 10001);
  assert.equal(origem.iaEstado, "investigar");
  posicionar(origem, 400, 0);
  atualizar(scene, origem, 10300);
  atualizar(scene, origem, 13901);
  assert.equal(origem.iaEstado, "retorno");
  atualizar(scene, origem, 13920);
  posicionar(origem, 0, 0);
  atualizar(scene, origem, 14000);
  assert.equal(origem.iaEstado, "patrulha");

  // O novo ataque ocorre em outro ponto, sem nenhum contato visual novo com o jogador.
  posicionar(origem, 100, 0);
  const aliado = criarRobo({ x: -100 });
  scene.inimigos.push(aliado);
  origem.foiFerido = true;
  origem.vida = 90;
  scene.time.now = 15000;
  notificarGrupo(scene, origem, "dano");
  atualizar(scene, origem);
  atualizar(scene, aliado);
  assert.equal(origem.iaEstado, "investigar");
  assert.ok(parado(origem), "o atingido examina o local atual, sem voltar à pista antiga");
  assert.deepEqual(aliado.ultimoMovimento, { x: 100, y: 0 });
});

test("receber dano sem visão inicia busca local sem rastrear jogador escondido", () => {
  const robo = criarRobo({ foiFerido: true, vida: 90 });
  const scene = criarCena({
    robos: [robo], player: { x: 300, y: 300 }, paredes: [parede(120, 80, 40, 400)],
  });
  atualizar(scene);
  assert.equal(robo.alerta, true);
  assert.ok(parado(robo), "sem pista visual, examina o local em que foi atingido");
  assert.equal(scene.lasersInimigo.getChildren().length, 0);
});

test("atirador anda de costas olhando e disparando para o jogador", () => {
  const scene = criarCena({ player: { x: 150, y: 0 } });
  const robo = scene.inimigos[0];
  atualizar(scene);
  assert.ok(robo.body.velocity.x < 0);
  assert.equal(robo.direcaoAtual, "right");
  assert.match(robo.anims.currentAnim.key, /right$/);
  assert.equal(robo.anims.inReverse, true);
  assert.equal(scene.lasersInimigo.getChildren().length, 1);

  posicionar(robo, -30, 0);
  atualizar(scene, robo, 1300);
  assert.ok(robo.body.velocity.x < 0);
  assert.equal(robo.direcaoAtual, "right");
  assert.equal(robo.iaEstado, "combate");
  assert.equal(scene.lasersInimigo.getChildren().length, 2);
});

test("recuo preserva mira nas quatro direções", () => {
  for (const [direcaoAtual, player, eixo, sinal] of [
    ["right", { x: 150, y: 0 }, "x", -1],
    ["left", { x: -150, y: 0 }, "x", 1],
    ["up", { x: 0, y: -150 }, "y", 1],
    ["down", { x: 0, y: 150 }, "y", -1],
  ]) {
    const robo = criarRobo({ direcaoAtual });
    const scene = criarCena({ robos: [robo], player });
    atualizar(scene);
    assert.ok(robo.body.velocity[eixo] * sinal > 0, direcaoAtual);
    assert.equal(robo.direcaoAtual, direcaoAtual);
    assert.match(robo.anims.currentAnim.key, new RegExp(`${direcaoAtual}$`));
    assert.equal(robo.anims.inReverse, true);
  }
});

test("animação troca entre andar para frente e de costas mesmo mantendo o mesmo clip", () => {
  const scene = criarCena({ player: { x: 400, y: 0 } });
  const robo = scene.inimigos[0];
  atualizar(scene);
  const animacao = robo.anims.currentAnim.key;
  assert.ok(robo.body.velocity.x > 0);
  assert.equal(robo.anims.inReverse, false);

  scene.player.x = 150;
  atualizar(scene, robo, 1100);
  assert.equal(robo.anims.currentAnim.key, animacao);
  assert.equal(robo.anims.inReverse, true);
  assert.ok(robo.body.velocity.x < 0);

  scene.player.x = 500;
  atualizar(scene, robo, 1200);
  assert.equal(robo.anims.currentAnim.key, animacao);
  assert.equal(robo.anims.inReverse, false);
  assert.ok(robo.body.velocity.x > 0);
});

test("recuo continua até distância segura e evita alternar na faixa intermediária", () => {
  const scene = criarCena({ player: { x: 150, y: 0 } });
  const robo = scene.inimigos[0];
  atualizar(scene);
  posicionar(robo, -70, 0);
  atualizar(scene, robo, 1300);
  assert.ok(robo.body.velocity.x < 0, "ainda recua a 220 pixels");

  posicionar(robo, -120, 0);
  atualizar(scene, robo, 1600);
  assert.ok(parado(robo), "para após alcançar 270 pixels");
  scene.player.x = 120;
  atualizar(scene, robo, 1900);
  assert.ok(parado(robo), "não reinicia recuo a 240 pixels");
  scene.player.x = 50;
  atualizar(scene, robo, 2200);
  assert.ok(robo.body.velocity.x < 0, "reinicia recuo quando jogador chega perto novamente");
});

test("atirador escolhe saída lateral quando há parede atrás sem virar as costas", () => {
  const scene = criarCena({
    player: { x: 150, y: 0 }, paredes: [parede(-42, -45, 18, 90)],
  });
  const robo = scene.inimigos[0];
  atualizar(scene);
  assert.ok(Math.abs(robo.body.velocity.y) > 0, "há deslocamento lateral para escapar da parede");
  assert.equal(robo.direcaoAtual, "right");
  assert.equal(scene.lasersInimigo.getChildren().length, 1);
});

test("alcance de tiro menor também tem uma distância de recuo utilizável", () => {
  const robo = criarRobo({ x: -60, distanciaAtaque: 180 });
  const scene = criarCena({ robos: [robo], player: { x: 0, y: 0 } });
  for (let i = 0; i < 80; i++) {
    atualizar(scene, robo, 1000 + i * 100);
    posicionar(robo, robo.x + robo.body.velocity.x * 0.1, robo.y + robo.body.velocity.y * 0.1);
  }
  assert.ok(parado(robo), "alcança uma posição estável dentro do alcance configurado");
  assert.ok(Math.hypot(robo.x, robo.y) >= 100);
  assert.ok(Math.hypot(robo.x, robo.y) <= 180);
  assert.ok(scene.lasersInimigo.getChildren().length > 2);
});

test("alvo continuamente visível mantém combate além de 16 segundos", () => {
  const scene = criarCena();
  atualizar(scene);
  atualizar(scene, scene.inimigos[0], 18000);
  assert.equal(scene.inimigos[0].iaEstado, "combate");
  assert.equal(scene.inimigos[0].alerta, true);
  assert.equal(scene.lasersInimigo.getChildren().length, 2);
});

test("falta de avanço por 450 ms faz o robô desviar do aliado que bloqueia o movimento direto", () => {
  const robo = criarRobo({ tipoRobo: "serra", distanciaAtaque: 68 });
  const bloqueador = criarRobo({ x: 60 });
  const scene = criarCena({ robos: [robo, bloqueador], player: { x: 400, y: 0 } });
  atualizar(scene, robo);
  assert.ok(robo.body.velocity.x > 0);
  assert.equal(robo.body.velocity.y, 0);
  atualizar(scene, robo, 1016);

  // O corpo recebeu comandos de caminhada, mas a colisão impediu a posição de avançar.
  atualizar(scene, robo, 1465);
  assert.equal(robo.body.velocity.y, 0);
  atualizar(scene, robo, 1466);
  assert.ok(!parado(robo));
  assert.ok(Math.abs(robo.body.velocity.y) > 0, "a rota de recuperação sai da fila de robôs");
  assert.equal(robo.iaEstado, "combate");
});

test("robô retornando volta ao combate ao terminar a pausa e entrar no alcance de sua origem", () => {
  const scene = criarCena();
  const robo = scene.inimigos[0];
  atualizar(scene);
  posicionar(robo, 1250, 0);
  scene.player.x = 1550;
  atualizar(scene, robo, 1100);
  assert.equal(robo.iaEstado, "retorno");
  const tiros = scene.lasersInimigo.getChildren().length;

  posicionar(robo, 1000, 0);
  scene.player.x = 700;
  atualizar(scene, robo, 5599);
  assert.equal(robo.iaEstado, "retorno", "a pausa de 4500 ms ainda impede reengajamento");
  assert.equal(robo.alerta, false);

  posicionar(robo, 1101, 0);
  scene.player.x = 801;
  atualizar(scene, robo, 5601);
  assert.equal(robo.iaEstado, "retorno", "fora de 1100 pixels continua voltando");
  posicionar(robo, 1100, 0);
  scene.player.x = 800;
  atualizar(scene, robo, 5801);
  assert.equal(robo.iaEstado, "combate");
  assert.equal(robo.alerta, true);
  assert.ok(scene.lasersInimigo.getChildren().length > tiros);
});

test("perder visão preserva posição conhecida por nove segundos sem rastrear através da parede", () => {
  const scene = criarCena({ paredes: [parede(120, 80, 40, 400)] });
  const robo = scene.inimigos[0];
  atualizar(scene);
  const tiros = scene.lasersInimigo.getChildren().length;
  Object.assign(scene.player, { x: 300, y: 300 });
  atualizar(scene, robo, 1500);
  assert.deepEqual(robo.ultimoMovimento, { x: 300, y: 0 });
  assert.equal(robo.body.velocity.y, 0);
  assert.equal(scene.lasersInimigo.getChildren().length, tiros);
  atualizar(scene, robo, 9999);
  assert.equal(robo.iaEstado, "combate");
  atualizar(scene, robo, 10001);
  assert.equal(robo.iaEstado, "investigar");
  assert.deepEqual(robo.ultimoMovimento, { x: 300, y: 0 });
});

test("tempo de busca começa na chegada e permite terminar o deslocamento", () => {
  const origem = criarRobo({ x: 400 });
  const investigador = criarRobo({ direcaoAtual: "right" });
  const scene = criarCena({ player: { x: -1200, y: 0 }, robos: [origem, investigador] });
  notificarGrupo(scene, origem);
  atualizar(scene, investigador, 5000);
  assert.equal(investigador.iaEstado, "investigar");
  assert.ok(investigador.body.velocity.x > 0);

  posicionar(investigador, 400, 0);
  atualizar(scene, investigador, 6000);
  atualizar(scene, investigador, 9500);
  assert.equal(investigador.iaEstado, "investigar");
  assert.ok(parado(investigador));
  atualizar(scene, investigador, 9700);
  assert.equal(investigador.alerta, false);
});

test("ao expirar a memória termina de seguir a pista e só varre a área depois da chegada", () => {
  const robo = criarRobo({ tipoRobo: "serra", distanciaAtaque: 68 });
  const scene = criarCena({
    robos: [robo], player: { x: 500, y: 0 }, paredes: [parede(-100, 80, 900, 40)],
  });
  atualizar(scene);
  Object.assign(scene.player, { x: 500, y: 400 });
  posicionar(robo, 100, 0);
  atualizar(scene, robo, 6000);
  assert.ok(robo.body.velocity.x > 0);

  posicionar(robo, 200, 0);
  atualizar(scene, robo, 10010);
  assert.equal(robo.iaEstado, "investigar");
  assert.ok(robo.body.velocity.x > 0);
  posicionar(robo, 450, 0);
  atualizar(scene, robo, 13700);
  assert.equal(robo.iaEstado, "investigar");
  assert.ok(robo.body.velocity.x > 0, "não interrompe o deslocamento ao passar 3600 ms");
  assert.equal(robo.direcaoAtual, "right");

  posicionar(robo, 500, 0);
  atualizar(scene, robo, 14000);
  assert.ok(parado(robo));
  const direcaoNaChegada = robo.direcaoAtual;
  atualizar(scene, robo, 14700);
  assert.ok(parado(robo));
  assert.notEqual(robo.direcaoAtual, direcaoNaChegada, "busca outras saídas após chegar à pista");
  atualizar(scene, robo, 17601);
  assert.equal(robo.alerta, false);
});

test("investigação que não alcança o destino tem limite de duração", () => {
  const origem = criarRobo({ x: 400 });
  const investigador = criarRobo();
  const scene = criarCena({ player: { x: -1200, y: 0 }, robos: [origem, investigador] });
  notificarGrupo(scene, origem);
  atualizar(scene, investigador, 13010);
  atualizar(scene, investigador, 16620);
  assert.equal(investigador.alerta, false);
  assert.notEqual(investigador.iaEstado, "investigar");
});
