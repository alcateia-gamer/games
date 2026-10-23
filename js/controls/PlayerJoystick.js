/**
 * @file Joystick fixo: lê o toque em pixels lógicos do canvas, sem depender do mundo
 * ou do acompanhamento da câmera. O zoom afeta somente a apresentação.
 */

const RAIO = 50;
const ZONA_MORTA = 10;
const ZONA_SOLTURA = 7;

class PlayerJoystick {
  constructor(scene) {
    this.scene = scene;
    this.pointer = null;
    this.forceX = 0;
    this.forceY = 0;
    this.ativo = false;
    this.direcao = { x: 0, y: 0 };
    this.layoutAnterior = {};
    scene.joystickPointerId = null;

    this.base = scene.add.circle(0, 0, RAIO, 0xcccccc, 0.7)
      .setScrollFactor(0).setDepth(100).setInteractive(
        new Phaser.Geom.Circle(RAIO, RAIO, RAIO), Phaser.Geom.Circle.Contains,
      );
    this.thumb = scene.add.circle(0, 0, 25, 0x666666, 0.9)
      .setScrollFactor(0).setDepth(101);

    this.pressionar = (pointer) => {
      // Um toque precisa começar na base; arrastar o dedo do ataque até ela não captura.
      if (this.pointer || !pointer.isDown || this.bloqueado()) return;
      if (!pointer.wasTouch && !pointer.leftButtonDown()) return;
      this.pointer = pointer;
      scene.joystickPointerId = pointer.id;
      this.mover(pointer);
    };
    this.mover = (pointer) => {
      if (pointer !== this.pointer) return;
      if (!pointer.isDown || this.bloqueado()) {
        this.reset();
        return;
      }

      const camera = scene.cameras.main;
      const x = pointer.x - camera.x - 100;
      const y = pointer.y - camera.y - (camera.height - 100);
      const distancia = Math.hypot(x, y);
      if (!Number.isFinite(distancia)) {
        this.reset();
        return;
      }

      // O primeiro deslocamento, mesmo dentro da zona morta, solicita um passo.
      if (distancia > 0 && this.forceX === 0 && this.forceY === 0) scene.solicitarPasso?.();

      // Histerese evita alternar entre andar e parar com pequenas variações no centro.
      this.ativo = distancia > (this.ativo ? ZONA_SOLTURA : ZONA_MORTA);
      this.direcao.x = this.ativo ? x / distancia : 0;
      this.direcao.y = this.ativo ? y / distancia : 0;
      const limite = distancia > RAIO ? RAIO / distancia : 1;
      this.forceX = x * limite;
      this.forceY = y * limite;
      this.atualizarThumb();
    };
    this.soltar = (pointer) => {
      if (pointer === this.pointer) this.reset();
    };
    this.cancelar = () => this.reset();
    this.verificar = () => {
      // Também cobre uma soltura que não chegou ao listener da cena.
      if (this.pointer && (!this.pointer.isDown || this.bloqueado())) this.reset();
    };
    this.destruir = () => this.destroy();

    this.base.on("pointerdown", this.pressionar);
    scene.input.on("pointermove", this.mover);
    scene.input.on("pointerup", this.soltar);
    // O Phaser encaminha touchcancel como pointerup ou pointerupoutside.
    scene.input.on("pointerupoutside", this.soltar);
    scene.events.on("preupdate", this.verificar);
    scene.events.on("pause", this.cancelar);
    scene.events.on("sleep", this.cancelar);
    scene.events.once("shutdown", this.destruir);
    scene.game.events.on("blur", this.cancelar);
    scene.game.events.on("hidden", this.cancelar);
    scene.scale.on("resize", this.cancelar);
    this.layout(scene.cameras.main);
  }

  bloqueado() {
    return this.scene.movimentoBloqueado || this.scene.generatorMenuOpen ||
      this.scene.morteEmAndamento || this.scene.input.enabled === false;
  }

  obterDirecao(destino) {
    this.verificar();
    destino.x = this.direcao.x;
    destino.y = this.direcao.y;
  }

  reset() {
    this.pointer = null;
    this.scene.joystickPointerId = null;
    this.ativo = false;
    this.forceX = this.forceY = 0;
    this.direcao.x = this.direcao.y = 0;
    this.atualizarThumb();
  }

  layout(camera) {
    const zoomX = camera.zoomX || camera.zoom || 1;
    const zoomY = camera.zoomY || camera.zoom || 1;
    const { width, height, originX, originY } = camera;
    const anterior = this.layoutAnterior;
    if (anterior.width === width && anterior.height === height &&
        anterior.originX === originX && anterior.originY === originY &&
        anterior.zoomX === zoomX && anterior.zoomY === zoomY) return;

    if (anterior.width !== width || anterior.height !== height) this.reset();
    Object.assign(anterior, { width, height, originX, originY, zoomX, zoomY });
    this.base.setPosition(
      width * originX + (100 - width * originX) / zoomX,
      height * originY + (height - 100 - height * originY) / zoomY,
    ).setScale(1 / zoomX, 1 / zoomY);
    this.thumb.setScale(1 / zoomX, 1 / zoomY);
    this.atualizarThumb();
  }

  atualizarThumb() {
    const { zoomX = 1, zoomY = 1 } = this.layoutAnterior;
    this.thumb.setPosition(
      this.base.x + this.forceX / zoomX,
      this.base.y + this.forceY / zoomY,
    );
  }

  destroy() {
    const scene = this.scene;
    if (!scene) return;
    this.reset();
    this.base.off("pointerdown", this.pressionar);
    scene.input.off("pointermove", this.mover);
    scene.input.off("pointerup", this.soltar);
    scene.input.off("pointerupoutside", this.soltar);
    scene.events.off("preupdate", this.verificar);
    scene.events.off("pause", this.cancelar);
    scene.events.off("sleep", this.cancelar);
    scene.events.off("shutdown", this.destruir);
    scene.game.events.off("blur", this.cancelar);
    scene.game.events.off("hidden", this.cancelar);
    scene.scale.off("resize", this.cancelar);
    this.base.destroy();
    this.thumb.destroy();
    this.scene = null;
  }
}

/** Recriar os controles também encerra o toque e os listeners do joystick anterior. */
function criarJoystick(scene) {
  scene.joystick?.destroy();
  scene.joystick = new PlayerJoystick(scene);
}

export { criarJoystick };
