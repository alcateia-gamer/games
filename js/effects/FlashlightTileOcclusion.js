import { camadaEhPisoFabrica } from "../map/TrocaCamada.js";

/** A hitbox dentro ou acima do gatilho vê a fachada à frente da luz. */
export function obterRegiaoFrenteLanterna(scene, actor) {
  const regiao = scene.regiaoTrocaCamada;
  if (!regiao || !actor) return null;
  const body = actor.body;
  const x = body?.width ? body.x : actor.x;
  const y = body?.height ? body.y : actor.y;
  return x + (body?.width ?? 0) > regiao.left && x < regiao.right && y < regiao.bottom
    ? regiao : null;
}

/** Usa o desenho inteiro dos tiles que cruzam a área, evitando emendas na fachada. */
function tileNaRegiao(layer, tile, tileset, regiao) {
  const r = layer.rotation ?? 0, t = tile.rotation ?? 0;
  const a = Math.cos(r) * (layer.scaleX ?? 1), b = Math.sin(r) * (layer.scaleX ?? 1);
  const c = -Math.sin(r) * (layer.scaleY ?? 1), d = Math.cos(r) * (layer.scaleY ?? 1);
  const w = tileset.tileWidth, h = tileset.tileHeight;
  const cx = tile.pixelX + w / 2 - tileset.tileOffset.x;
  const cy = tile.pixelY + h / 2 - tileset.tileOffset.y;
  const x = (layer.x ?? 0) + a * cx + c * cy;
  const y = (layer.y ?? 0) + b * cx + d * cy;
  const ct = Math.cos(t), st = Math.sin(t);
  const halfW = (Math.abs(a*ct + c*st) * w + Math.abs(-a*st + c*ct) * h) / 2;
  const halfH = (Math.abs(b*ct + d*st) * w + Math.abs(-b*st + d*ct) * h) / 2;
  return x + halfW > regiao.left && x - halfW < regiao.right &&
    y + halfH > regiao.top && y - halfH < regiao.bottom;
}

/** Retira do carimbo da lanterna os pixels da camada que deve aparecer sobre ela. */
export function ocultarLanternaAtrasCamada(context, layer, camera, regiao = null, tiles = null) {
  if (!layer || layer.visible === false || layer.alpha === 0) return;
  context.save();
  const rotacao = layer.rotation ?? 0;
  const cos = Math.cos(rotacao), sin = Math.sin(rotacao);
  const sx = layer.scaleX ?? 1, sy = layer.scaleY ?? 1;
  context.transform(cos * sx, sin * sx, -sin * sy, cos * sy, layer.x ?? 0, layer.y ?? 0);
  context.globalCompositeOperation = "destination-out";
  context.imageSmoothingEnabled = false;
  for (const tile of tiles ?? layer.cull(camera)) {
    const tileset = layer.gidMap[tile.index];
    if (!tileset || tile.visible === false || tile.alpha === 0) continue;
    if (regiao && !tileNaRegiao(layer, tile, tileset, regiao)) continue;
    const indice = tileset.getAnimatedTileId(tile.index, layer.timeElapsed);
    const origem = indice == null ? null : tileset.getTileTextureCoordinates(indice);
    if (!origem) continue;
    const w = tileset.tileWidth, h = tileset.tileHeight;
    if (!(w > 0 && h > 0)) continue;
    const angulo = tile.rotation ?? 0;
    const ct = Math.cos(angulo), st = Math.sin(angulo);
    const fx = tile.flipX ? -1 : 1, fy = tile.flipY ? -1 : 1;
    context.save();
    context.transform(ct * fx, st * fx, -st * fy, ct * fy,
      tile.pixelX + w / 2 - tileset.tileOffset.x,
      tile.pixelY + h / 2 - tileset.tileOffset.y);
    context.globalAlpha = (layer.alpha ?? 1) * (tile.alpha ?? 1);
    context.drawImage(tileset.image.getSourceImage(), origem.x, origem.y, w, h,
      -w / 2, -h / 2, w, h);
    context.restore();
  }
  context.restore();
}

export function ocultarLanternaAtrasSala(context, scene, camera, regiao) {
  if (!regiao) return;
  for (const layer of scene.camadasMapaParte2 ?? []) {
    // ParedeAcimaPerso já oculta a luz em todo o mapa; pisos revelam o interior da sala.
    if (layer === scene.camadaParedeAcimaPerso || camadaEhPisoFabrica(layer.layer?.name)) continue;
    ocultarLanternaAtrasCamada(context, layer, camera, regiao);
  }
}
