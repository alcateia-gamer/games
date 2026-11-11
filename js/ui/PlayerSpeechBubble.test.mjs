import test from "node:test";
import assert from "node:assert/strict";
import { criarFalaFlutuante } from "./PlayerSpeechBubble.js";

function fixture() {
  const timers = [];
  const visual = () => ({ visible: false, width: 0, height: 0,
    setText(value) { this.text = value; this.width = value.length * 7 + 12;
      this.height = value.split("\n").length * 16 + 8; return this; },
    setFixedSize(width, height) {
      this.width = width || (this.text ?? "").length * 7 + 12;
      this.height = height || (this.text ?? "").split("\n").length * 16 + 8;
      return this;
    },
    setOrigin() { return this; }, setDepth() { return this; }, setName() { return this; },
    setVisible(value) { this.visible = value; return this; },
    setPosition(x, y) { Object.assign(this, { x, y }); return this; },
    fillStyle() { return this; }, fillTriangle() { return this; },
    clear() { return this; }, fillRoundedRect() { return this; },
    lineStyle() { return this; }, strokeRoundedRect() { return this; },
    destroy() { this.destroyed = true; },
  });
  const scene = { personagemSelecionada: "kai-mercer", player: { active: true, x: 100, y: 100 },
    add: { text: visual, graphics: visual },
    time: { now: 0, delayedCall(delay, callback) {
      const timer = { due: this.now + delay, callback, removed: false,
        remove() { this.removed = true; } };
      timers.push(timer); return timer;
    } } };
  const fala = criarFalaFlutuante(scene);
  const avancar = ms => {
    scene.time.now += ms;
    fala.atualizar();
    for (const timer of timers) {
      if (!timer.removed && scene.time.now >= timer.due) { timer.removed = true; timer.callback(); }
    }
  };
  return { scene, fala, avancar };
}

test("revela uma letra por vez e a caixa cresce junto com a fala", () => {
  const { fala, avancar } = fixture();
  fala.mostrar("Olá!\nTudo bem?");
  assert.equal(fala.texto.text, "O");
  const inicial = { width: fala.texto.width, height: fala.texto.height };
  avancar(30);
  assert.equal(fala.texto.text, "Ol");
  assert.ok(fala.texto.width > inicial.width);
  avancar(120);
  assert.equal(fala.texto.text, "Olá!\nT");
  assert.ok(fala.texto.height > inicial.height);
  avancar(1000);
  assert.equal(fala.texto.text, "Olá!\nTudo bem?");
  assert.equal(fala.texto.visible, true);
  avancar(3199);
  assert.equal(fala.texto.visible, true, "há tempo de leitura após a última letra");
  avancar(1);
  assert.equal(fala.texto.visible, false);
});

test("uma nova fala reinicia o tamanho e não recebe o timer da fala anterior", () => {
  const { fala, avancar } = fixture();
  fala.mostrar("Uma frase comprida para testar.");
  avancar(1000);
  const larguraAnterior = fala.texto.width;
  fala.mostrar("Oi");
  assert.equal(fala.texto.text, "O");
  assert.ok(fala.texto.width < larguraAnterior);
  avancar(30);
  assert.equal(fala.texto.text, "Oi");
  avancar(3170);
  assert.equal(fala.texto.visible, true, "o timer antigo foi cancelado");
  avancar(30);
  assert.equal(fala.texto.visible, false);
});

test("acentos combinados e emoji aparecem inteiros; ocultar e destruir interrompem a digitação", () => {
  const { scene, fala, avancar } = fixture();
  fala.mostrar("a\u0301👩‍🚀!");
  assert.equal(fala.texto.text, "a\u0301");
  avancar(30);
  assert.equal(fala.texto.text, "a\u0301👩‍🚀");
  fala.ocultar();
  avancar(1000);
  assert.equal(fala.texto.visible, false);
  assert.equal(fala.texto.text, "a\u0301👩‍🚀");
  fala.mostrar("Texto novo");
  scene.devItemMenuOpen = true;
  avancar(30);
  assert.equal(fala.texto.visible, false);
  fala.destroy(); fala.destroy(); avancar(1000);
  assert.equal(fala.texto.destroyed, true);
});

test("a fala acompanha a cabeça durante a digitação e mantém a alternância das frases", () => {
  const { scene, fala, avancar } = fixture();
  const frases = ["Primeira", "Segunda"];
  fala.mostrar(frases);
  scene.player.x += 20;
  scene.player.y -= 15;
  avancar(500);
  assert.equal(fala.texto.text, "Primeira");
  assert.equal(fala.texto.x, scene.player.x + 16);
  assert.ok(fala.texto.y < scene.player.y);
  fala.mostrar(frases);
  assert.equal(fala.texto.text, "S");
  avancar(500);
  assert.equal(fala.texto.text, "Segunda");
  fala.destroy();
});

test("estado remoto conserva digitação, acompanha o falante e não reinicia a cada pacote", () => {
  const origem = fixture(), destino = fixture();
  const replica = criarFalaFlutuante(destino.scene, "aliado", { replica: true });
  origem.fala.mostrar("Olá, operador!"); origem.avancar(180);
  const state = origem.fala.snapshot();
  replica.aplicarEstadoRede(state);
  assert.equal(replica.texto.text, origem.fala.texto.text);
  destino.scene.time.now += 180;
  destino.scene.player.x += 32;
  replica.aplicarEstadoRede(state); replica.atualizar();
  assert.ok(replica.texto.text.length > origem.fala.texto.text.length);
  assert.equal(replica.texto.x, destino.scene.player.x + 16);
  assert.equal(destino.scene.coopSpeechBubbles.has("aliado"), false, "réplica não retransmite a fala");
  replica.aplicarEstadoRede(null);
  assert.equal(replica.texto.visible, false);
  origem.fala.destroy();
  assert.equal(origem.scene.coopSpeechBubbles.size, 0);
  replica.destroy();
});
