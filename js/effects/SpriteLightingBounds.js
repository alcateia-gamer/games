/** Usa o mesmo recorte de SpriteLightOcclusion; só exclui sprites totalmente fora do canvas. */
export function spriteIntersectsLightingCanvas(sprite, matrix, width, height) {
  const frame = sprite.frame;
  if (!frame?.source?.image) return true;
  const fullWidth = frame.realWidth ?? sprite.width ?? frame.cutWidth;
  const fullHeight = frame.realHeight ?? sprite.height ?? frame.cutHeight;
  const originX = sprite.displayOriginX ?? fullWidth / 2;
  const originY = sprite.displayOriginY ?? fullHeight / 2;
  const ox = sprite.flipX ? fullWidth - originX : originX;
  const oy = sprite.flipY ? fullHeight - originY : originY;
  const sx = (sprite.scaleX ?? 1) * (sprite.flipX ? -1 : 1);
  const sy = (sprite.scaleY ?? 1) * (sprite.flipY ? -1 : 1);
  const cr = Math.cos(sprite.rotation ?? 0), sr = Math.sin(sprite.rotation ?? 0);
  const a = matrix.a * cr * sx + matrix.c * sr * sx;
  const b = matrix.b * cr * sx + matrix.d * sr * sx;
  const c = -matrix.a * sr * sy + matrix.c * cr * sy;
  const d = -matrix.b * sr * sy + matrix.d * cr * sy;
  const cx = (frame.x ?? 0) - ox + frame.cutWidth / 2;
  const cy = (frame.y ?? 0) - oy + frame.cutHeight / 2;
  const x = a * cx + c * cy + matrix.a * sprite.x + matrix.c * sprite.y + matrix.e;
  const y = b * cx + d * cy + matrix.b * sprite.x + matrix.d * sprite.y + matrix.f;
  const rx = (Math.abs(a) * frame.cutWidth + Math.abs(c) * frame.cutHeight) / 2;
  const ry = (Math.abs(b) * frame.cutWidth + Math.abs(d) * frame.cutHeight) / 2;
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(rx) || !Number.isFinite(ry)) return true;
  // Mantém também valores não finitos e casos junto à borda; só exclui separação comprovada.
  return !(x + rx < -2 || y + ry < -2 || x - rx > width + 2 || y - ry > height + 2);
}
