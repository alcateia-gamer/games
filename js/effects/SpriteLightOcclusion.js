/** Recorta apenas os pixels opacos do sprite, respeitando quadro, origem e espelhamento. */
export function ocultarBrilhoAtrasSprite(context, sprite, x = sprite.x, y = sprite.y, intensidade = 1) {
  const frame = sprite.frame;
  if (!frame?.source?.image) return;
  context.save();
  const escalaX = (sprite.scaleX ?? 1) * (sprite.flipX ? -1 : 1);
  const escalaY = (sprite.scaleY ?? 1) * (sprite.flipY ? -1 : 1);
  const rotacao = sprite.rotation ?? 0;
  const cr = Math.cos(rotacao), sr = Math.sin(rotacao);
  context.transform(cr * escalaX, sr * escalaX, -sr * escalaY, cr * escalaY, x, y);
  const largura = frame.realWidth ?? sprite.width ?? frame.cutWidth;
  const altura = frame.realHeight ?? sprite.height ?? frame.cutHeight;
  const origemX = sprite.displayOriginX ?? largura / 2;
  const origemY = sprite.displayOriginY ?? altura / 2;
  const ox = sprite.flipX ? largura - origemX : origemX;
  const oy = sprite.flipY ? altura - origemY : origemY;
  context.globalCompositeOperation = "destination-out";
  context.globalAlpha = (sprite.alpha ?? 1) * intensidade;
  context.imageSmoothingEnabled = false;
  context.drawImage(frame.source.image, frame.cutX, frame.cutY, frame.cutWidth, frame.cutHeight,
    (frame.x ?? 0) - ox, (frame.y ?? 0) - oy, frame.cutWidth, frame.cutHeight);
  context.restore();
}
