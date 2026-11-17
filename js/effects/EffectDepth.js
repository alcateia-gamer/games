/** Efeitos volumétricos e luzes ficam acima das torres, sem mudar seus pés/colisões. */
export function depthAcimaTorres(scene, base) {
  let depth = base;
  for (const torre of scene?.novoBoss?.geradores ?? []) {
    const visual = torre.torre && torre.visual;
    if (visual?.active && visual.visible !== false && Number.isFinite(visual.depth)) {
      // Margem maior que a quantização de 0,001 do protocolo cooperativo.
      depth = Math.max(depth, visual.depth + .01);
    }
  }
  return depth;
}
