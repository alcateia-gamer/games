import { MULTIPLICADOR_ALCANCE_FABRICA } from "./FactoryLighting.js";
import { ocultarLanternaAtrasCamada } from "./FlashlightTileOcclusion.js";

const CAMPOS_CAMADA = ["x", "y", "scaleX", "scaleY", "rotation", "alpha", "visible"];
const CAMPOS_TILE = ["index", "pixelX", "pixelY", "rotation", "flipX", "flipY", "alpha", "visible"];

function comparar(anterior, atual, campos) {
  let alterado = false;
  for (const campo of campos) {
    if (anterior[campo] !== atual[campo]) { anterior[campo] = atual[campo]; alterado = true; }
  }
  return alterado;
}

/** As paredes ocultam a faixa e o brilho das arandelas Cima, preservando a luz na área livre da sala. */
export default class BossEmitterOcclusion {
  constructor(scene, luzes) {
    this.scene = scene;
    this.camadas = [];
    this.anteriores = new WeakMap();
    this.tilesAnteriores = new WeakMap();
    this.revisao = 0;
    const paraCima = luzes.filter(luz => luz.direcao === "Cima");
    this.canvas = null;
    if (!paraCima.length) return;
    this.canvas = document.createElement("canvas");
    this.canvas.width = this.canvas.height = Math.ceil(Math.max(...paraCima.map(luz =>
      luz.raio * MULTIPLICADOR_ALCANCE_FABRICA))) * 2;
    this.context = this.canvas.getContext("2d");
  }

  atualizar(camera) {
    if (!this.canvas) return false;
    const camadas = [...new Set([
      ...(this.scene.camadasMapaParte2 ?? []).filter(layer => /^(Borda|Parede)/.test(layer.layer?.name)),
      this.scene.camadaParedeAcimaPerso, this.scene.camadaParedeAbaixoPerso,
    ].filter(Boolean))];
    let alterado = camadas.length !== this.camadas.length || camadas.some((layer, i) => layer !== this.camadas[i]);
    this.camadas = camadas;
    for (const layer of camadas) {
      let anterior = this.anteriores.get(layer);
      if (!anterior) { anterior = { tiles: [] }; this.anteriores.set(layer, anterior); alterado = true; }
      if (comparar(anterior, layer, CAMPOS_CAMADA)) alterado = true;
      const tiles = layer.visible === false || layer.alpha === 0 ? [] : layer.cull(camera);
      if (tiles.length !== anterior.tiles.length) alterado = true;
      for (let i = 0; i < tiles.length; i++) {
        const tile = tiles[i];
        if (anterior.tiles[i] !== tile) alterado = true;
        anterior.tiles[i] = tile;
        let dados = this.tilesAnteriores.get(tile);
        if (!dados) { dados = {}; this.tilesAnteriores.set(tile, dados); alterado = true; }
        if (comparar(dados, tile, CAMPOS_TILE)) alterado = true;
        const tileset = layer.gidMap[tile.index];
        const frame = tileset?.getAnimatedTileId(tile.index, layer.timeElapsed);
        if (dados.tileset !== tileset || dados.frame !== frame) alterado = true;
        dados.tileset = tileset;
        dados.frame = frame;
      }
      anterior.tiles.length = tiles.length;
    }
    if (alterado) this.revisao++;
    return alterado;
  }

  desenhar(context, perfil, fonte, estatuas) {
    if (!this.canvas || fonte.luz.direcao !== "Cima" || !this.camadas.length) return false;
    const { luz, angulo } = fonte;
    const c = this.context, tamanho = this.canvas.width, centro = tamanho / 2;
    const raio = luz.raio * MULTIPLICADOR_ALCANCE_FABRICA;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.globalAlpha = 1;
    c.globalCompositeOperation = "source-over";
    c.clearRect(0, 0, tamanho, tamanho);
    c.setTransform(1, 0, 0, 1, centro - luz.x, centro - luz.y);
    if (!estatuas.desenhar(c, perfil, fonte)) {
      c.save();
      const cos = Math.cos(angulo), sin = Math.sin(angulo);
      c.transform(cos, sin, -sin, cos, luz.x, luz.y);
      c.imageSmoothingEnabled = true;
      c.drawImage(perfil, -raio, -raio, raio * 2, raio * 2);
      c.restore();
    }
    for (const layer of this.camadas) ocultarLanternaAtrasCamada(c, layer, this.scene.cameras.main);
    context.drawImage(this.canvas, luz.x - centro, luz.y - centro, tamanho, tamanho);
    return true;
  }

  destroy() {
    if (this.canvas) this.canvas.width = this.canvas.height = 0;
    this.camadas.length = 0;
    this.anteriores = new WeakMap();
    this.tilesAnteriores = new WeakMap();
    this.scene = null;
  }
}
