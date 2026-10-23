/** Mira e entrada do arco. Um único ponteiro controla tanto o joystick quanto o mouse. */
import { atacar, soltarAtaque, cancelarAtaqueAria, atualizarDirecaoAtaqueAria } from "../player/Player.js";
import { ARIA_ATTACK_CONFIG, direcaoVisualAria, tempoEntradaAria } from "./AriaAttackConfig.js";
import { posicionarBotaoFixo } from "./FixedActionButton.js";
import { obstaculosFlecha, tempoImpactoFlecha } from "../player/ArrowCollision.js";
import { iniciarSomTensaoAria, pararSomTensaoAria, tocarSomSoltarFlechaAria } from "../sounds/SOUNDS_PERSONAGENS.js/sounds_Aria.js";

const ehToque = pointer => pointer.wasTouch || pointer.isTouch ||
  pointer.pointerType === "touch" || pointer.event?.pointerType === "touch";
const foiCancelado = pointer => pointer.wasCanceled || /cancel/i.test(pointer.event?.type ?? "");

export class AriaAttackJoystick {
  constructor(scene, aoTrocarPersonagem) {
    this.scene = scene;
    this.config = scene.ariaAttackConfig = { ...ARIA_ATTACK_CONFIG, ...scene.ariaAttackConfig };
    this.pointer = null;
    this.deslocamento = { x: 0, y: 0 };
    const config = this.config;
    this.base = scene.add.circle(0, 0, config.joystickRadius, 0xe867a7, 0.75)
      .setStrokeStyle(4, 0x333333).setScrollFactor(0).setDepth(100)
      .setInteractive(new Phaser.Geom.Circle(config.joystickRadius, config.joystickRadius,
        config.interactionRadius), Phaser.Geom.Circle.Contains);
    this.thumb = scene.add.circle(0, 0, config.thumbRadius, 0xffb3d7, 0.9)
      .setStrokeStyle(3, 0x593048).setScrollFactor(0).setDepth(102);
    this.anel = scene.add.graphics().setScrollFactor(0).setDepth(101);
    this.linha = scene.add.graphics().setDepth(90);
    scene.botaoAtaque = this.base; // O dash usa esta referência para confirmar que o HUD existe.
    scene.iconeAtaque = null;
    scene.ariaAttackJoystick = this;
    this.registros = [];
    this.ouvir = (emissor, evento, callback) => {
      emissor.on(evento, callback);
      this.registros.push([emissor, evento, callback]);
    };
    this.pressionar = pointer => this.iniciar(pointer, true);
    this.mouse = (pointer, objetos) => {
      if (!ehToque(pointer) && pointer.leftButtonDown() && !objetos?.length) this.iniciar(pointer, false);
    };
    this.mover = pointer => {
      if (pointer.id === this.pointer?.id && this.usandoJoystick) this.atualizarMira(pointer);
    };
    this.soltar = pointer => {
      if (pointer.id !== this.pointer?.id) return;
      if (foiCancelado(pointer) || this.bloqueado()) return this.cancelar();
      if (this.usandoJoystick) this.atualizarMira(pointer);
      // Limpa a captura antes do disparo: pointerup repetido não pode emitir outra flecha.
      this.limparCaptura();
      pararSomTensaoAria(scene);
      if (soltarAtaque(scene, tempoEntradaAria(scene, pointer))) tocarSomSoltarFlechaAria(scene);
      this.desenhar();
    };
    this.cancelar = () => {
      this.limparCaptura();
      cancelarAtaqueAria(scene);
      this.desenhar();
    };
    this.verificar = () => {
      if (scene.personagemSelecionada !== "aria-kade") {
        this.destroy();
        aoTrocarPersonagem?.();
        return;
      }
      if (this.pointer && (!this.pointer.isDown || this.bloqueado() || !scene.ariaAtaqueCarregando)) {
        this.cancelar();
      }
    };
    this.renderizar = () => { this.layout(); this.desenhar(); };
    this.destruir = () => this.destroy();
    this.ouvir(this.base, "pointerdown", this.pressionar);
    this.ouvir(scene.input, "pointerdown", this.mouse);
    this.ouvir(scene.input, "pointermove", this.mover);
    this.ouvir(scene.input, "pointerup", this.soltar);
    this.ouvir(scene.input, "pointerupoutside", this.soltar);
    this.ouvir(scene.events, "preupdate", this.verificar);
    this.ouvir(scene.events, "prerender", this.renderizar);
    this.ouvir(scene.events, "pause", this.cancelar);
    this.ouvir(scene.events, "sleep", this.cancelar);
    this.ouvir(scene.events, "shutdown", this.destruir);
    this.ouvir(scene.events, "destroy", this.destruir);
    this.ouvir(scene.game.events, "blur", this.cancelar);
    this.ouvir(scene.game.events, "hidden", this.cancelar);
    this.ouvir(scene.scale, "resize", this.cancelar);
    // Escuta antes do Phaser transformar touchcancel em um pointerup comum.
    this.canvas = scene.game.canvas;
    this.canvas?.addEventListener("touchcancel", this.cancelar, true);
    this.canvas?.addEventListener("pointercancel", this.cancelar, true);
    this.layout();
  }

  bloqueado() {
    const scene = this.scene;
    return scene.personagemSelecionada !== "aria-kade" || !scene.player?.active ||
      scene.vida <= 0 || scene.morteEmAndamento || scene.movimentoBloqueado ||
      scene.generatorMenuOpen || scene.input.enabled === false ||
      scene.physics?.world?.isPaused || scene.sys?.isPaused?.() || scene.sys?.isSleeping?.();
  }

  iniciar(pointer, usandoJoystick) {
    if (this.pointer || !pointer.isDown || this.bloqueado()) return;
    if (!ehToque(pointer) && !pointer.leftButtonDown()) return;
    if (pointer.id === this.scene.joystickPointerId) return;
    if (!atacar(this.scene)) return;
    this.scene.ariaCargaInicio = tempoEntradaAria(this.scene, pointer);
    this.pointer = pointer;
    this.scene.pointerAtaque = pointer.id;
    this.usandoJoystick = usandoJoystick;
    if (usandoJoystick) this.atualizarMira(pointer);
    iniciarSomTensaoAria(this.scene);
    this.desenhar();
  }

  atualizarMira(pointer) {
    const { scene, config } = this;
    const camera = scene.cameras.main;
    const dx = pointer.x - camera.x - config.centerX;
    const dy = pointer.y - camera.y - config.centerY;
    const distancia = Math.hypot(dx, dy);
    if (!Number.isFinite(distancia)) return;
    const escala = distancia > config.maxThumbDistance ? config.maxThumbDistance / distancia : 1;
    this.deslocamento = { x: dx * escala, y: dy * escala };
    if (distancia > config.deadZone) {
      scene.ariaMira = { x: dx / distancia, y: dy / distancia };
      atualizarDirecaoAtaqueAria(scene, direcaoVisualAria(scene.ariaMira, scene.direcaoAtaque, config));
    }
    this.layout();
  }

  limparCaptura() {
    this.pointer = null;
    this.scene.pointerAtaque = null;
    this.deslocamento = { x: 0, y: 0 };
  }

  layout() {
    const camera = this.scene.cameras.main, config = this.config;
    posicionarBotaoFixo(camera, this.base, config.centerX, config.centerY);
    posicionarBotaoFixo(camera, this.anel, config.centerX, config.centerY);
    posicionarBotaoFixo(camera, this.thumb, config.centerX + this.deslocamento.x,
      config.centerY + this.deslocamento.y);
    this.thumb.setAlpha(this.pointer ? 1 : 0.8);
  }

  desenhar() {
    this.anel.clear();
    this.linha.clear();
    if (!this.pointer || !this.scene.ariaAtaqueCarregando) return;
    const { scene, config } = this;
    const tempo = Math.max(0, scene.time.now - scene.ariaCargaInicio);
    const carga = Math.min(1, tempo / config.maxChargeTime);
    const cor = carga >= 1 ? 0xffd0ed : carga >= 0.5 ? 0xff4fae : 0xf5a3cd;
    const alpha = carga >= 1 ? 0.8 + Math.sin(tempo / 110) * 0.2 : 0.85;
    this.anel.lineStyle(carga >= 0.5 ? 4 : 3, cor, alpha);
    this.anel.beginPath();
    this.anel.arc(0, 0, config.joystickRadius - 3, -Math.PI / 2, -Math.PI / 2 + carga * Math.PI * 2);
    this.anel.strokePath();

    const direcao = scene.ariaMira;
    if (!direcao) return;
    // Abaixo do HUD, em coordenadas de mundo; termina no primeiro obstáculo.
    const inicio = { x: scene.player.x, y: scene.player.y - 4 };
    const fim = { x: inicio.x + direcao.x * config.aimLineLength,
      y: inicio.y + direcao.y * config.aimLineLength };
    let limite = 1;
    for (const corpo of obstaculosFlecha(scene, inicio, fim, 0)) {
      const t = tempoImpactoFlecha(inicio, fim, direcao, corpo, 0, 0);
      if (t !== null) limite = Math.min(limite, t);
    }
    this.linha.lineStyle(1, 0xff9dce, 0.4);
    this.linha.beginPath();
    this.linha.moveTo(inicio.x, inicio.y);
    this.linha.lineTo(inicio.x + (fim.x - inicio.x) * limite, inicio.y + (fim.y - inicio.y) * limite);
    this.linha.strokePath();
  }

  destroy() {
    if (!this.scene) return;
    const scene = this.scene;
    this.cancelar();
    for (const [emissor, evento, callback] of this.registros) emissor.off(evento, callback);
    this.canvas?.removeEventListener("touchcancel", this.cancelar, true);
    this.canvas?.removeEventListener("pointercancel", this.cancelar, true);
    for (const objeto of [this.base, this.thumb, this.anel, this.linha]) objeto.destroy();
    if (scene.botaoAtaque === this.base) scene.botaoAtaque = null;
    if (scene.ariaAttackJoystick === this) scene.ariaAttackJoystick = null;
    if (scene.limparControlesAtaqueFixos === this.destruir) scene.limparControlesAtaqueFixos = null;
    this.scene = null;
  }
}
