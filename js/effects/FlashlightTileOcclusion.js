import { camadaEhPisoFabrica } from "../map/TrocaCamada.js";

// O culling da oclusão não altera a lista que o Phaser usa para desenhar a cena.
const cameraRecorte = { worldView: {} };
const tilesRecorte = [];

function cullFachada(layer, camera, regiao, margem) {
  const view = camera.worldView;
  if (!view || !Number.isFinite(margem) || layer.rotation || layer.scaleX <= 0 || layer.scaleY <= 0 ||
      layer.skipCull || layer.scrollFactorX !== 1 || layer.scrollFactorY !== 1 ||
      layer.cullCallback !== globalThis.Phaser?.Tilemaps?.Components?.CullTiles || !layer.cullCallback) {
    return layer.cull(camera);
  }
  const limite = cameraRecorte.worldView;
  margem *= Math.max(layer.scaleX, layer.scaleY);
  limite.x = Math.max(view.x, regiao.left - margem);
  limite.y = Math.max(view.y, regiao.top - margem);
  limite.right = Math.min(view.right, regiao.right + margem);
  limite.bottom = Math.min(view.bottom, regiao.bottom + margem);
  if (limite.x >= limite.right || limite.y >= limite.bottom) return tilesRecorte;
  return layer.cullCallback(layer.layer, cameraRecorte, tilesRecorte, layer._renderOrder);
}

/** A hitbox dentro ou acima do gatilho vê a fachada à frente da luz. */
export function obterRegiaoFrenteLanterna(scene, actor) {
  const regiao = scene.regiaoTrocaCamada;
  if (!regiao || !actor) return null;
  const body = actor.body ?? actor.coopBody;
  const x = body?.width ? body.x : actor.x;
  const y = body?.height ? body.y : actor.y;
  return x + (body?.width ?? 0) > regiao.left && x < regiao.right && y < regiao.bottom
    ? regiao : null;
}

/** Usa o desenho inteiro dos tiles que cruzam a área, evitando emendas na fachada. */
function tileCruzaLimites(a, b, c, d, x, y, ct, st, w, h, left, top, right, bottom) {
  const halfW = (Math.abs(a*ct + c*st) * w + Math.abs(-a*st + c*ct) * h) / 2;
  const halfH = (Math.abs(b*ct + d*st) * w + Math.abs(-b*st + d*ct) * h) / 2;
  return x + halfW > left && x - halfW < right && y + halfH > top && y - halfH < bottom;
}

/** Retira do carimbo da lanterna os pixels da camada que deve aparecer sobre ela. */
export function ocultarLanternaAtrasCamada(context, layer, camera, regiao = null, tiles = null, margem = null) {
  if (!layer || layer.visible === false || layer.alpha === 0) return;
  tiles ??= regiao ? cullFachada(layer, camera, regiao, margem ?? NaN) : layer.cull(camera);
  if (!tiles.length) return;
  context.save();
  const rotacao = layer.rotation ?? 0;
  const cos = Math.cos(rotacao), sin = Math.sin(rotacao);
  const sx = layer.scaleX ?? 1, sy = layer.scaleY ?? 1;
  const a = cos * sx, b = sin * sx, c = -sin * sy, d = cos * sy;
  const tx = layer.x ?? 0, ty = layer.y ?? 0;
  context.transform(a, b, c, d, tx, ty);
  context.globalCompositeOperation = "destination-out";
  context.imageSmoothingEnabled = false;
  // A câmera pode enxergar milhares de tiles; só os que cruzam o carimbo afetam a lanterna.
  // Usa a transformação exata já aplicada, sem reduzir resolução ou quantizar a posição.
  const matriz = context.getTransform?.();
  const canvas = context.canvas;
  for (const tile of tiles) {
    const tileset = layer.gidMap[tile.index];
    if (!tileset || tile.visible === false || tile.alpha === 0) continue;
    const w = tileset.tileWidth, h = tileset.tileHeight;
    if (!(w > 0 && h > 0)) continue;
    const angulo = tile.rotation ?? 0;
    const ct = angulo ? Math.cos(angulo) : 1, st = angulo ? Math.sin(angulo) : 0;
    const fx = tile.flipX ? -1 : 1, fy = tile.flipY ? -1 : 1;
    const cx = tile.pixelX + w / 2 - tileset.tileOffset.x;
    const cy = tile.pixelY + h / 2 - tileset.tileOffset.y;
    if (regiao && !tileCruzaLimites(a, b, c, d, a * cx + c * cy + tx, b * cx + d * cy + ty,
      ct, st, w, h, regiao.left, regiao.top, regiao.right, regiao.bottom)) continue;
    if (matriz && canvas) {
      const x = matriz.a * cx + matriz.c * cy + matriz.e;
      const y = matriz.b * cx + matriz.d * cy + matriz.f;
      const rx = (Math.abs(matriz.a * ct + matriz.c * st) * w + Math.abs(-matriz.a * st + matriz.c * ct) * h) / 2;
      const ry = (Math.abs(matriz.b * ct + matriz.d * st) * w + Math.abs(-matriz.b * st + matriz.d * ct) * h) / 2;
      // Um pixel de margem preserva a rasterização nas bordas, inclusive com rotação.
      if (x + rx < -1 || y + ry < -1 || x - rx > canvas.width + 1 || y - ry > canvas.height + 1) continue;
    }
    const indice = tileset.getAnimatedTileId(tile.index, layer.timeElapsed);
    const origem = indice == null ? null : tileset.getTileTextureCoordinates(indice);
    if (!origem) continue;
    context.save();
    context.transform(ct * fx, st * fx, -st * fy, ct * fy, cx, cy);
    context.globalAlpha = (layer.alpha ?? 1) * (tile.alpha ?? 1);
    context.drawImage(tileset.image.getSourceImage(), origem.x, origem.y, w, h, -w / 2, -h / 2, w, h);
    context.restore();
  }
  context.restore();
  if (tiles === tilesRecorte) tilesRecorte.length = 0;
}

export function ocultarLanternaAtrasSala(context, scene, camera, regiao) {
  if (!regiao) return;
  // Inclui quinas rotacionadas e deslocamentos de tiles maiores que a grade.
  let margem = NaN;
  if (scene.map?.tilesets?.length) {
    margem = 0;
    for (const { tileWidth, tileHeight, tileOffset } of scene.map.tilesets) {
      margem = Math.max(margem, Math.hypot(tileWidth, tileHeight) +
        Math.max(Math.abs(tileOffset.x), Math.abs(tileOffset.y)));
    }
  }
  for (const layer of scene.camadasMapaParte2 ?? []) {
    // ParedeAcimaPerso já oculta a luz em todo o mapa; pisos revelam o interior da sala.
    if (layer === scene.camadaParedeAcimaPerso || camadaEhPisoFabrica(layer.layer?.name)) continue;
    ocultarLanternaAtrasCamada(context, layer, camera, regiao, null, margem);
  }
}
