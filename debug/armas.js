/** Laboratório isolado; nunca é carregado pelas cenas normais. */
import * as P from "../js/player/PersonagemTeste.js";
import { criarArmaPersonagemTeste,
  atacarComArmaPersonagemTeste, dispararLaserPersonagemTeste } from "../js/player/ArmaPersonagemTeste.js";
import { cancelarGolpeEspada } from "../js/player/EspadaPersonagemTeste.js";
import { cancelarEstocada } from "../js/player/FloretePersonagemTeste.js";

const $ = id => document.getElementById(id);
const armas = [...new Set([P.PERSONAGEM_TESTE.arma, P.ESPADA_PERSONAGEM_TESTE,
  P.FLORETE_PERSONAGEM_TESTE, P.ARMA_DOURADA_TESTE].filter(Boolean))];
for (const p of P.PERSONAGENS_TESTE) $("personagem").add(new Option(p.id, p.id));
for (const a of armas) $("arma").add(new Option(a.id, a.id));
$("personagem").value = "personagem-teste-2";

class Laboratorio extends Phaser.Scene {
  constructor() { super("Armas"); }
  preload() { this.load.setPath("../assets/"); P.carregarPersonagemTeste(this); }
  create() {
    this.personagemSelecionada = $("personagem").value;
    this.vida = 100; this.direcaoAtual = "right";
    this.player = this.physics.add.sprite(500, 310, P.PERSONAGEM_TESTE_2.textura, 0).setDepth(10);
    this.player.body.moves = false;
    this.add.grid(500, 310, 1200, 800, 16, 16, 0x263346, 1, 0x36475d, 0.45).setDepth(-10);
    this.cameras.main.setZoom(4).centerOn(500, 310);
    this.inimigos = [];
    for (const nome of ["personagem", "arma", "animacao"]) $(nome).onchange = () => this.configurar();
    $("quadro").oninput = () => { $("animar").checked = false; this.aplicarQuadro(); };
    $("atacar").onclick = () => this.atacar();
    $("cancelar").onclick = () => this.cancelar();
    this.configurar();
    window.__armasScene = this;
  }
  configurar() {
    this.limparArmaPersonagemTeste?.();
    this.personagemSelecionada = $("personagem").value;
    const personagem = P.obterPersonagemTeste(this);
    for (const d of ["up", "down", "left", "right"]) {
      for (const tipo of ["idle", "walk"]) this.anims.remove(`${tipo}-${d}`);
    }
    P.criarAnimacoesPersonagemTeste(this);
    P.configurarVisualPersonagemTeste(this);
    this.player.setPosition(500, 310);
    this.aplicarQuadro();
    criarArmaPersonagemTeste(this);
    const a = armas.find(a => a.id === $("arma").value);
    const t = this.textures.get(a.textura), r = a.recorte;
    if (!t.has("arma")) t.add("arma", 0, r.x, r.y, r.largura, r.altura);
    this.armaPersonagemTeste.config = a;
    this.armaPersonagemTeste.armaAtras = false;
    this.armaPersonagemTeste.sprite.setTexture(a.textura, "arma");
    this.personagem = personagem;
  }
  aplicarQuadro() {
    const p = P.obterPersonagemTeste(this), tipo = $("animacao").value;
    const folha = tipo === "walk" ? p.walk ?? p : p;
    $("quadro").max = folha.totalFrames - 1;
    const quadro = Math.min(+$("quadro").value, folha.totalFrames - 1);
    this.player.anims.stop();
    this.player.setTexture(folha.textura, quadro);
  }
  cancelar() {
    const e = this.armaPersonagemTeste;
    cancelarGolpeEspada(e); cancelarEstocada(e);
    e.comboPendente = false; e.proximoDisparo = 0;
    for (const l of e.lasers) l.sprite.destroy();
    e.lasers = [];
  }
  atacar() {
    const e = this.armaPersonagemTeste;
    return e.config.tipo ? atacarComArmaPersonagemTeste(this) : dispararLaserPersonagemTeste(this);
  }
  update(_t, delta) {
    if (!this.armaPersonagemTeste) return;
    if ($("animar").checked) {
      const p = P.obterPersonagemTeste(this);
      const f = $("animacao").value === "walk" ? p.walk ?? p : p;
      $("quadro").value = Math.floor(this.time.now * f.fps / 1000) % f.totalFrames;
    }
    this.aplicarQuadro();
    let angulo = +$("angulo").value * Math.PI / 180;
    const passos = +$("rotacao").value;
    if (passos) angulo = Math.round(angulo / (2 * Math.PI / passos)) * 2 * Math.PI / passos;
    const e = this.armaPersonagemTeste;
    e.direcao = { x: Math.cos(angulo), y: Math.sin(angulo) };
    this.player.body.setVelocity(0, 0);
    this.debugEncaixeArmas = $("debug").checked;
    // A arma é atualizada pelo POST_UPDATE real instalado pelo módulo.
    const p = e.pose;
    $("dados").textContent = `Quadro: ${this.player.frame.name} | ${$("animacao").value} | ${e.config.id}\n` +
      `Mão/grip: (${p.mao.x.toFixed(2)}, ${p.mao.y.toFixed(2)}) | cano/ponta: (${p.cano.x.toFixed(2)}, ${p.cano.y.toFixed(2)})\n` +
      `Camada: ${e.sprite.depth < this.player.depth ? "atrás" : "frente"} | socket medido: ${Boolean(p.socketMedido)}`;
  }
}

window.__armasGame = new Phaser.Game({ type: Phaser.WEBGL, parent: "jogo", width: 1000, height: 600,
  backgroundColor: "#263346", render: { antialias: false, antialiasGL: false, roundPixels: false },
  physics: { default: "arcade", arcade: { gravity: { y: 0 } } }, scene: Laboratorio });
