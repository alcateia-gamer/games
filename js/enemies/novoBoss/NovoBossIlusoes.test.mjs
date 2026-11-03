import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import test from "node:test";
import { novoBossConfig, areaCorpoNovoBoss } from "./NovoBossConfig.js";
import { prepararIlusoesNovoBoss } from "./NovoBossIlusoes.js";
import { sincronizarCorpoNovoBoss } from "./NovoBossTeleporte.js";

function preparar(extra = {}) {
  const objetos = [];
  const blocos = [];
  function visual(x = 0, y = 0) {
    const objeto = { x, y, active: true, visible: true, alpha: 1, depth: 16.5, destruidos: 0,
      setOrigin() { return this; }, setScale() { return this; },
      setName(name) { this.name = name; return this; },
      setDepth(depth) { this.depth = depth; return this; },
      setPosition(x, y) { this.x = x; this.y = y; return this; },
      setVisible(visible) { this.visible = visible; return this; },
      setAlpha(alpha) { this.alpha = alpha; return this; },
      play(animacao) { this.animacao = animacao; return this; },
      clear() { return this; }, lineStyle() { return this; },
      strokeCircle() { return this; }, lineBetween() { return this; },
      destroy() { this.destruidos++; this.active = false; },
    };
    objetos.push(objeto);
    return objeto;
  }
  const scene = { player: { active: true, x: -1093, y: -5520 }, vida: 100,
    events: new EventEmitter(), collisionGroup: { getChildren: () => blocos },
    add: { sprite: visual, circle: visual, graphics: visual }, inimigos: [{ vida: 40 }],
  };
  const config = { ...novoBossConfig, ...extra,
    ilusoes: { ativo: true, duracaoMs: 10000, ...extra.ilusoes } };
  const sprite = visual(-1080, -5810);
  const encontro = { config, sprite, vida: 1000, vidaMaxima: 1000,
    jogadorNaArena: true, obstaculosTeleporte: [], rng: () => 0,
    hitboxDano: { ...areaCorpoNovoBoss(config) },
  };
  Object.defineProperties(encontro, {
    x: { get: () => sprite.x }, y: { get: () => sprite.y },
  });
  const sistema = encontro.sistemaIlusoes = prepararIlusoesNovoBoss(scene, encontro);
  return { scene, encontro, sistema, objetos, blocos };
}

test("quatro aparições mantêm a entidade original e sorteiam todos os slots", () => {
  for (let indice = 0; indice < 4; indice++) {
    const { encontro, sistema } = preparar();
    // Fora dos quatro slots, todos continuam disponíveis para o sorteio.
    sincronizarCorpoNovoBoss(encontro, { x: -1100, y: -5810 });
    const sprite = encontro.sprite;
    encontro.rng = () => (indice + 0.1) / 4;
    assert.equal(sistema.iniciarQuatro(), true);
    assert.equal(encontro.sprite, sprite);
    assert.equal(encontro.vida, 1000);
    assert.equal(sistema.alvos.length, 3);
    const ponto = encontro.config.teleporte.pontos[indice];
    assert.deepEqual([sprite.x, sprite.y], [ponto.x, ponto.y]);
    assert.equal(sistema.snapshot().pontoVerdadeiro, ponto.id);
    const locais = new Set([[sprite.x, sprite.y].join(), ...sistema.alvos.map(alvo => [alvo.x, alvo.y].join())]);
    assert.equal(locais.size, 4);
    assert.equal(sistema.iniciarQuatro(), false, "não duplica uma execução ativa");
  }
});

test("verdadeira sai de cada slot, sorteia os outros três e deixa uma cópia no lugar", () => {
  for (let origem = 0; origem < 4; origem++) {
    for (const ajuste of [0, 0.5]) {
      const destinos = new Set();
      for (let sorteio = 0; sorteio < 3; sorteio++) {
        const { encontro, sistema } = preparar();
        const pontos = encontro.config.teleporte.pontos;
        const pontoAnterior = pontos[origem];
        sincronizarCorpoNovoBoss(encontro, { x: pontoAnterior.x + ajuste, y: pontoAnterior.y });
        const spriteOriginal = encontro.sprite;
        const hitboxOriginal = encontro.hitboxDano;
        encontro.rng = () => (sorteio + 0.1) / 3;
        assert.equal(sistema.iniciarQuatro(), true);
        const destino = sistema.snapshot().pontoVerdadeiro;
        destinos.add(destino);
        assert.notEqual(destino, pontoAnterior.id);
        assert.equal(encontro.sprite, spriteOriginal);
        assert.equal(encontro.hitboxDano, hitboxOriginal);
        assert.deepEqual(encontro.hitboxDano, areaCorpoNovoBoss(encontro.config, encontro.sprite));
        assert.equal(encontro.vida, 1000);
        assert.equal(sistema.alvos.length, 3);
        assert.ok(sistema.alvos.some(alvo => alvo.x === pontoAnterior.x && alvo.y === pontoAnterior.y));
        assert.equal(new Set([`${encontro.x},${encontro.y}`,
          ...sistema.alvos.map(alvo => `${alvo.x},${alvo.y}`)]).size, 4);
      }
      assert.equal(destinos.size, 3, "todos os outros slots podem ser a verdadeira");
    }
  }
});

test("execuções sucessivas com o mesmo sorteio nunca conservam a posição verdadeira", () => {
  const { scene, encontro, sistema } = preparar();
  let inicios = 0;
  scene.events.on("novo-boss:ilusoes-iniciadas", () => inicios++);
  for (let i = 0; i < 20; i++) {
    const anterior = { x: encontro.x, y: encontro.y };
    assert.equal(sistema.iniciarQuatro(), true);
    assert.notDeepEqual({ x: encontro.x, y: encontro.y }, anterior);
    const falsos = [...sistema.alvos];
    sistema.encerrarQuatro();
    assert.ok(falsos.every(alvo => alvo.sprite.destruidos === 1));
    assert.equal(encontro.sprite.destruidos, 0);
  }
  assert.equal(inicios, 20);
});

test("sem outro slot seguro não cria aparições nem altera a posição ou vida", () => {
  const { scene, encontro, sistema, objetos } = preparar();
  sincronizarCorpoNovoBoss(encontro, encontro.config.teleporte.pontos[1]);
  // O jogador ocupa os outros três destinos; só a posição atual está livre.
  scene.player.body = { x: -1120, y: -6070, width: 410, height: 410 };
  const antes = { x: encontro.x, y: encontro.y, hitbox: { ...encontro.hitboxDano }, objetos: objetos.length };
  let eventos = 0;
  scene.events.on("novo-boss:ilusoes-iniciadas", () => eventos++);
  assert.equal(sistema.iniciarQuatro(), false);
  assert.equal(sistema.ativo, false);
  assert.equal(sistema.alvos.length, 0);
  assert.equal(objetos.length, antes.objetos);
  assert.deepEqual({ x: encontro.x, y: encontro.y }, { x: antes.x, y: antes.y });
  assert.deepEqual(encontro.hitboxDano, antes.hitbox);
  assert.equal(encontro.vida, 1000);
  assert.equal(eventos, 0);
});

test("falso pode ocupar ponto do jogador; a verdadeira escolhe outro destino", () => {
  const { scene, encontro, sistema } = preparar();
  scene.player.x = -1080;
  scene.player.y = -5810;
  assert.equal(sistema.iniciarQuatro(), true);
  assert.notDeepEqual([encontro.x, encontro.y], [-1080, -5810]);
  assert.ok(sistema.alvos.some(alvo => alvo.x === -1080 && alvo.y === -5810));
});

test("paredes e geradores bloqueiam o início inteiro sem reposicionamento parcial", () => {
  for (const tipo of ["parede", "gerador"]) {
    const { encontro, sistema, blocos, objetos } = preparar();
    const ponto = encontro.config.teleporte.pontos[2];
    const body = { ...areaCorpoNovoBoss(encontro.config, ponto), enable: true };
    if (tipo === "parede") blocos.push({ body });
    else encontro.obstaculosTeleporte.push({ body });
    const quantidadeAntes = objetos.length;
    assert.equal(sistema.iniciarQuatro(), false);
    assert.equal(sistema.ativo, false);
    assert.equal(sistema.alvos.length, 0);
    assert.equal(objetos.length, quantidadeAntes);
    assert.deepEqual([encontro.x, encontro.y], [-1080, -5810]);
  }
});

test("acertar um falso dispersa uma vez sem consumir vida ou janela real", () => {
  const { scene, encontro, sistema } = preparar();
  encontro.estado = "vulneravel";
  let dispersoes = 0;
  scene.events.on("novo-boss:ilusao-dissipada", () => dispersoes++);
  sistema.iniciarQuatro();
  const falso = sistema.alvos[0];
  for (const dano of [0, -1, NaN, Infinity]) assert.equal(falso.receberDano(dano), false);
  assert.equal(falso.receberDano(25, { x: 0, y: 0, width: 10, height: 10 }), false);
  assert.equal(falso.receberDano(25, falso.hitboxDano), true);
  assert.equal(falso.receberDano(25), false);
  assert.equal(falso.sprite.destruidos, 1);
  assert.equal(falso.body.enable, false);
  assert.equal(falso.morto, true);
  assert.equal(falso.vida, 0);
  assert.equal(dispersoes, 1);
  assert.equal(encontro.vida, 1000);
  assert.equal(encontro.estado, "vulneravel");
  assert.deepEqual(scene.inimigos, [{ vida: 40 }]);
});

test("hitboxes virtuais possuem o contrato geométrico das armas antigas", () => {
  const { sistema } = preparar();
  sistema.iniciarQuatro();
  const alvo = sistema.alvos[0];
  const b = alvo.hitboxDano;
  assert.equal(b.left, b.x);
  assert.equal(b.right, b.x + b.width);
  assert.equal(b.top, b.y);
  assert.equal(b.bottom, b.y + b.height);
  assert.equal(b.centerX, b.x + b.width / 2);
  assert.equal(b.centerY, b.y + b.height / 2);
  assert.equal(alvo.body, b);
  assert.equal(alvo.active, true);
});

test("núcleo verdadeiro pulsa, segue a entidade e persiste depois das quatro aparições", () => {
  const { encontro, sistema } = preparar();
  sistema.atualizar(0);
  const core = sistema.core;
  assert.ok(core?.visible);
  assert.equal(core.depth, 54);
  const alphaAntes = core.alpha;
  sistema.atualizar(180);
  assert.notEqual(core.alpha, alphaAntes);
  sistema.iniciarQuatro();
  const falsos = [...sistema.alvos];
  sistema.encerrarQuatro();
  assert.equal(sistema.core, core);
  assert.equal(core.active, true);
  assert.ok(falsos.every(alvo => alvo.sprite.destruidos === 1));
  sincronizarCorpoNovoBoss(encontro, encontro.config.teleporte.pontos[3]);
  sistema.atualizar(0);
  assert.equal(core.x, encontro.x + (150 - 144) * encontro.config.visual.escala);
  assert.equal(core.y, encontro.y + (120 - 144) * encontro.config.visual.escala);
  encontro.teleporte = {};
  sistema.atualizar(0);
  assert.equal(core.visible, false);
});

test("duração de 10s e cancelamento liberam só os falsos, sem objetos órfãos", () => {
  const { sistema, encontro } = preparar();
  sistema.iniciarQuatro();
  const alvos = [...sistema.alvos];
  for (const delta of [NaN, -1, Infinity]) sistema.atualizar(delta);
  assert.equal(sistema.snapshot().tempo, 0);
  sistema.atualizar(9999);
  assert.equal(sistema.ativo, true);
  sistema.atualizar(1);
  assert.equal(sistema.ativo, false);
  assert.equal(sistema.alvos.length, 0);
  assert.ok(alvos.every(alvo => alvo.sprite.destruidos === 1));
  assert.equal(encontro.sprite.destruidos, 0);
  assert.equal(encontro.vida, 1000);
  sistema.cancelar();
  sistema.destruir();
  sistema.destruir();
  assert.equal(sistema.core, null);
  assert.ok(alvos.every(alvo => alvo.sprite.destruidos === 1));
  assert.equal(sistema.iniciarQuatro(), false);
});

test("saída, morte, suspensão e multiplayer cancelam aparições e escondem o núcleo", () => {
  for (const alterar of [
    (_scene, encontro) => { encontro.jogadorNaArena = false; },
    (scene) => { scene.morteEmAndamento = true; },
    (_scene, encontro) => { encontro.morto = true; },
    (_scene, encontro) => { encontro.suspenso = true; },
    (scene) => { scene.multiplayer = true; },
  ]) {
    const { scene, encontro, sistema } = preparar();
    sistema.iniciarQuatro();
    const core = sistema.core;
    const falsos = [...sistema.alvos];
    alterar(scene, encontro);
    sistema.atualizar(100);
    assert.equal(sistema.ativo, false);
    assert.equal(core.visible, false);
    assert.ok(falsos.every(alvo => !alvo.active && alvo.sprite.destruidos === 1));
  }
});

test("aparências imitam ataques novos somente com efeitos holográficos", () => {
  const { scene, encontro, sistema, objetos } = preparar();
  encontro.projeteisBoss = [];
  sistema.iniciarQuatro();
  for (const tipo of ["pulsoRepulsao", "chuvaRaios", "lasersEspiral", "tentaculos"]) {
    encontro.ataqueAtual = { tipo };
    sistema.atualizar(60);
    assert.ok(sistema.alvos.every(alvo => alvo.snapshot().imitacao));
    assert.equal(scene.vida, 100);
    assert.equal(scene.restricaoControleNovoBoss, undefined);
    assert.deepEqual(encontro.projeteisBoss, []);
    sistema.atualizar(700);
    assert.ok(sistema.alvos.every(alvo => alvo.snapshot().imitacao === null));
  }
  sistema.destruir();
  assert.ok(objetos.slice(1).every(objeto => objeto.destruidos === 1));
});

test("pose das aparições acompanha todo o ataque e encerra junto com a verdadeira", () => {
  const { scene, encontro, sistema } = preparar();
  scene.textures = { exists: () => true };
  scene.anims = { exists: () => true };
  sistema.iniciarQuatro();
  encontro.estado = "atacando";
  encontro.ataqueAtual = { tipo: "tentaculos" };
  for (const delta of [0, 100, 500, 3000]) {
    sistema.atualizar(delta);
    assert.ok(sistema.alvos.every(alvo => alvo.sprite.animacao === "novo-boss-ataque-anim"));
  }
  assert.ok(sistema.alvos.every(alvo => alvo.snapshot().imitacao === null),
    "o efeito holográfico breve não limita a duração da pose");
  encontro.ataqueAtual = null;
  encontro.estado = "vulneravel";
  sistema.atualizar(0);
  assert.ok(sistema.alvos.every(alvo => alvo.sprite.animacao === "novo-boss-idle-anim"));
});

test("configuração desativada e clones ativos impedem quatro aparições", () => {
  const desativada = preparar({ ilusoes: { ativo: false } });
  assert.equal(desativada.sistema.iniciarQuatro(), false);
  desativada.sistema.atualizar(100);
  assert.equal(desativada.sistema.core, null);
  const { encontro, sistema } = preparar();
  encontro.sistemaClones = { ativo: true };
  assert.equal(sistema.iniciarQuatro(), false);
});

test("núcleo da verdadeira não denuncia as ondas de clones móveis", () => {
  const { encontro, sistema } = preparar();
  sistema.atualizar(0);
  assert.equal(sistema.core.visible, true);
  encontro.sistemaClones = { ativo: true };
  sistema.atualizar(16);
  assert.equal(sistema.core.visible, false);
  encontro.sistemaClones.ativo = false;
  sistema.atualizar(16);
  assert.equal(sistema.core.visible, true);
});
