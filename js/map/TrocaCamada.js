/** A região troca a profundidade de cada ator; as camadas do mapa permanecem estáveis. */
const FLOORS = new Set(["chão", "detalhes do chão", "ListrasChão", "Sujeira", "ChãoProdução"]);

export function configurarTrocaCamada(scene) {
  const area = scene.map.getObjectLayer("trocadecamada")?.objects?.find(object =>
    object.name === "trocadecamada01" && object.width > 0 && object.height > 0);
  scene.regiaoTrocaCamada = null;
  scene.profundidadeRegiaoTroca = null;
  if (!area) return;
  scene.regiaoTrocaCamada = { left: area.x, top: area.y,
    right: area.x + area.width, bottom: area.y + area.height };
  const layers = scene.camadasMapaParte2 ?? [];
  // Considera os pisos que realmente existem na passagem e sob o sprite, incluindo suas margens.
  const floors = layers.filter(layer => FLOORS.has(layer.layer?.name) &&
    layer.getTilesWithinWorldXY(area.x - 128, area.y - 128, area.width + 256, area.height + 256,
      { isNotEmpty: true }).some(tile => tile.index >= 0));
  const overlays = layers.filter(layer => !FLOORS.has(layer.layer?.name));
  const floorDepth = Math.max(0, ...floors.map(layer => layer.depth));
  const overlayDepth = Math.min(...overlays.map(layer => layer.depth));
  scene.profundidadeRegiaoTroca = (floorDepth + overlayDepth) / 2;
}

export function atorNaRegiaoTroca(scene, actor) {
  const region = scene.regiaoTrocaCamada;
  if (!region || !actor) return false;
  const body = actor.body;
  const x = body?.width ? body.x : actor.x;
  const y = body?.height ? body.y : actor.y;
  return x + (body?.width ?? 0) > region.left && x < region.right &&
    y + (body?.height ?? 0) > region.top && y < region.bottom;
}
