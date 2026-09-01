function criarLevel1Map(scene) {
  // =====================================================
  // MAPA
  // =====================================================

  const map = scene.make.tilemap({
    key: "mapa",
  });

  // =====================================================
  // TILESETS
  // =====================================================

  const cityShopping = map.addTilesetImage(
    "Tileset_SciFi_CityShopping_Rasak",
    "cityShopping",
  );

  const street = map.addTilesetImage("Tileset_SciFi_Street_Rasak", "street");

  const garbage = map.addTilesetImage("Tileset_SciFi_Garbage_Rasak", "garbage");

  const a5Street = map.addTilesetImage("A5_Street_Rasak", "a5Street");

  const slums = map.addTilesetImage("Tileset_SciFi_Slums_Rasak", "slums");

  const a4Outside = map.addTilesetImage("A4_SciFi_Outside_Rasak", "a4Outside");

  const a3Outside = map.addTilesetImage("A3_SciFi_Outside_Rasak", "a3Outside");

  const buildingExtras = map.addTilesetImage(
    "Tileset_SciFi_BuildingExtras",
    "buildingExtras",
  );

  const torre = map.addTilesetImage("TorreTileset", "torre");

  const tilesets = [
    cityShopping,
    street,
    garbage,
    a5Street,
    slums,
    a4Outside,
    a3Outside,
    buildingExtras,
    torre,
  ].filter(Boolean);

  // =====================================================
  // CAMADAS
  // =====================================================

  const TILE = 48;

  const camadaChao = map.createLayer("Chão", tilesets, -48 * TILE, -48 * TILE);

  const camadaPredios = map.createLayer(
    "Prédios",
    tilesets,
    -16 * TILE,
    -32 * TILE,
  );

  const camadaJanelas = map.createLayer(
    "Janela dos Prédios",
    tilesets,
    -16 * TILE,
    -32 * TILE,
  );

  const camadaParedes = map.createLayer(
    "Paredes",
    tilesets,
    -48 * TILE,
    -16 * TILE,
  );

  const camadaObjetos2 = map.createLayer(
    "Objetos 2",
    tilesets,
    -48 * TILE,
    -32 * TILE,
  );

  const camadaObjetos = map.createLayer(
    "Objetos",
    tilesets,
    -48 * TILE,
    -32 * TILE,
  );

  const camadaCerca = map.createLayer(
    "Cercas",
    tilesets,
    -48 * TILE,
    -16 * TILE,
  );

  const camadaCercaTorre = map.createLayer("CercaTorre", tilesets, 0, 0);

  const camadaMuroDelegacia = map.createLayer(
    "Muro delegacia",
    tilesets,
    -16 * TILE,
    0,
  );

  const camadaPostes = map.createLayer(
    "Postes",
    tilesets,
    -32 * TILE,
    -48 * TILE,
  );

  // =====================================================
  // PROFUNDIDADE
  // =====================================================

  camadaChao.setDepth(0);
  camadaCercaTorre.setDepth(2);
  camadaPredios.setDepth(3);
  camadaMuroDelegacia.setDepth(4);
  camadaJanelas.setDepth(5);
  camadaParedes.setDepth(6);
  camadaObjetos2.setDepth(7);
  camadaObjetos.setDepth(8);
  camadaCerca.setDepth(9);
  camadaPostes.setDepth(10);

  return map;
}

export default criarLevel1Map;
