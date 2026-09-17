const DEPTHS = {
  worldBase: 12.5,
  worldScale: 0.0003,
  alwaysAboveWorld: 18,
  overlayAboveWorld: 20,
};

function depthFromWorldY(y) {
  return DEPTHS.worldBase + Number(y) * DEPTHS.worldScale;
}

function obterTilesetDoGid(map, gid) {
  return [...map.tilesets]
    .reverse()
    .find((tileset) => Number(gid) >= Number(tileset.firstgid));
}

function criarBaseVisual(scene, map, object, textureKeyByTilesetName) {
  const rawGid = Number(object.gid ?? 0) >>> 0;
  const gid = rawGid & 0x1fffffff;

  if (scene.DEBUG_DEPTH_SORTING) {
    console.log("PostesObjetos objeto:", {
      gid: object.gid,
      x: object.x,
      y: object.y,
      width: object.width,
      height: object.height,
      visible: object.visible,
    });
  }

  if (!gid) {
    console.warn(`PostesObjetos: objeto ${object.id} não possui GID.`);
    return null;
  }

  const tileset = obterTilesetDoGid(map, gid);

  if (!tileset) {
    console.warn(`PostesObjetos: GID ${gid} não pôde ser associado a um tileset.`);
    return null;
  }

  const textureKey = textureKeyByTilesetName.get(tileset.name);

  if (!textureKey) {
    console.warn(
      `PostesObjetos: nenhum texture key foi encontrado para o tileset "${tileset.name}" (GID ${gid}).`,
    );
    return null;
  }

  const texture = scene.textures.get(textureKey);

  if (!texture || !texture.source?.[0]?.width) {
    console.warn(
      `PostesObjetos: texture key "${textureKey}" não foi encontrada para o GID ${gid}.`,
    );
    return null;
  }

  const tileWidth = Number(tileset.tileWidth || map.tileWidth);
  const tileHeight = Number(tileset.tileHeight || map.tileHeight);
  const margin = Number(tileset.tileMargin || 0);
  const spacing = Number(tileset.tileSpacing || 0);
  const textureWidth = texture.source[0].width;
  const columns = Number(
    tileset.columns ||
      Math.floor((textureWidth - margin * 2 + spacing) / (tileWidth + spacing)),
  );

  if (!columns) {
    console.warn(
      `PostesObjetos: não foi possível calcular as colunas do tileset "${tileset.name}".`,
    );
    return null;
  }

  const tileIndex = gid - Number(tileset.firstgid);
  const sourceX = margin + (tileIndex % columns) * (tileWidth + spacing);
  const sourceY = margin + Math.floor(tileIndex / columns) * (tileHeight + spacing);
  const width = Number(object.width || tileWidth);
  const height = Number(object.height || tileHeight);
  const frameName = `postes-objetos-${tileset.name}-${tileIndex}`;

  if (!texture.frames[frameName]) {
    texture.add(
      frameName,
      0,
      sourceX,
      sourceY,
      tileWidth,
      tileHeight,
    );
  }

  // Tile Objects usam x como a borda esquerda e y como a borda inferior.
  const base = scene.add
    .image(Number(object.x) + width / 2, Number(object.y), textureKey, frameName)
    .setOrigin(0.5, 1)
    .setScale(width / tileWidth, height / tileHeight)
    .setDepth(depthFromWorldY(object.y));

  base.setFlipX(Boolean(object.flippedHorizontal));
  base.setFlipY(Boolean(object.flippedVertical));
  base.setVisible(object.visible !== false);
  base.setAlpha(Number.isFinite(object.opacity) ? object.opacity : 1);

  if (Number.isFinite(object.rotation)) {
    base.setAngle(object.rotation);
  }

  if (object.flippedAntiDiagonal) {
    base.setAngle(base.angle + 90);
  }

  base.setData("worldY", Number(object.y));
  base.setData("tiledObjectId", object.id);

  if (scene.DEBUG_DEPTH_SORTING) {
    console.log({
      rawGid,
      cleanGid: gid,
      tileset: tileset.name,
      firstgid: tileset.firstgid,
      localFrame: tileIndex,
      textureKey,
    });
  }

  return base;
}

function criarBasesPostes(scene, map, textureKeyByTilesetName) {
  const objectLayer = map.getObjectLayer("PostesObjetos");

  if (!objectLayer) {
    console.warn('Object Layer "PostesObjetos" não existe no mapa.');
    scene.poleBaseObjects = [];
    return;
  }

  if (scene.DEBUG_DEPTH_SORTING) {
    console.log("PostesObjetos:", objectLayer);
    console.log("Quantidade:", objectLayer.objects?.length ?? 0);
  }

  scene.poleBaseObjects = objectLayer.objects
    .map((object) =>
      criarBaseVisual(scene, map, object, textureKeyByTilesetName),
    )
    .filter(Boolean);
}

function criarLevel1Map(scene) {
  // =====================================================
  // MAPA
  // =====================================================

  const map = scene.make.tilemap({
    key: "mapa",
  });

  // =====================================================
  // TILESETS - CIDADE
  // =====================================================

  // City Shopping
  const cityShopping = map.addTilesetImage(
    "Tileset_SciFi_CityShopping_Rasak",
    "cityShopping",
  );

  // Rua
  const street = map.addTilesetImage("Tileset_SciFi_Street_Rasak", "street");

  // Rua duplicada
  const street2 = map.addTilesetImage(
    "Tileset_SciFi_Street_Rasak_DUP",
    "street2",
  );

  // Lixo
  const garbage = map.addTilesetImage("Tileset_SciFi_Garbage_Rasak", "garbage");

  // Rua A5
  const a5Street = map.addTilesetImage("A5_Street_Rasak", "a5Street");

  // Slums
  const slums = map.addTilesetImage("Tileset_SciFi_Slums_Rasak", "slums");

  // Transporte público
  const publicTransportation = map.addTilesetImage(
    "Tileset_SciFi_PublicTransportation_Slums_Rasak.png",
    "publicTransportation",
  );

  // Exterior A4
  const a4Outside = map.addTilesetImage("A4_SciFi_Outside_Rasak", "a4Outside");

  // Exterior A3
  const a3Outside = map.addTilesetImage("A3_SciFi_Outside_Rasak", "a3Outside");

  // Exterior A5
  const a5Outside = map.addTilesetImage(
    "A5_SciFi_Outside_Rasak",
    "A5_SciFi_Outside_Rasak",
  );

  // Extras dos prédios
  const buildingExtras = map.addTilesetImage(
    "Tileset_SciFi_BuildingExtras",
    "buildingExtras",
  );

  // Torre
  const torre = map.addTilesetImage("TorreTileset", "torre");

  // =====================================================
  // TILESETS - INTERIOR
  // =====================================================

  // Apartamento
  const apartment2 = map.addTilesetImage(
    "Tileset_SciFi_Arpartment_2_Rasak",
    "apartment2",
  );

  // =====================================================
  // TILESETS - INDUSTRIAL
  // =====================================================

  // Industrial
  const modernIndustrial2 = map.addTilesetImage(
    "Tileset_Modern_Industrial_2_Rasak",
    "ModernIndustrial2",
  );

  // Interior da fábrica
  const modernInsideFactoryA1 = map.addTilesetImage(
    "A1_Modern_Inside_Factory_Rasak",
    "ModernInsideFactoryA1",
  );

  // Bordas das paredes
  const wallBorder = map.addTilesetImage("parede-borda", "wallBorder");

  // Porta da loja
  const shopDoor = map.addTilesetImage("!ShopDoor", "shopDoor");

  // =====================================================
  // TILESETS - VEÍCULOS
  // =====================================================

  // Speeder civil 5
  const vehiclesSpeederCivil5 = map.addTilesetImage(
    "Speeder_civil5",
    "VehiclesSpeederCivil5",
  );

  // Speeder civil 2
  const speederCivil2 = map.addTilesetImage("Speeder_civil2", "Speeder_civil2");

  // Transporte privado
  const transporterPrivate = map.addTilesetImage(
    "Transporter_Private",
    "Transporter_Private",
  );

  // Ambulância
  const transporterAmbulance = map.addTilesetImage(
    "Transporter_Ambulance",
    "Transporter_Ambulance",
  );

  // SWAT
  const transporterPoliceSwat = map.addTilesetImage(
    "Transporter_PoliceSwat",
    "Transporter_PoliceSwat",
  );

  // =====================================================
  // LISTA DE TODOS OS TILESETS
  // =====================================================

  const tilesets = [
    cityShopping,
    street,
    street2,
    garbage,
    a5Street,
    slums,
    publicTransportation,
    a4Outside,
    a3Outside,
    a5Outside,
    buildingExtras,
    torre,

    apartment2,

    modernIndustrial2,
    modernInsideFactoryA1,
    wallBorder,
    shopDoor,

    vehiclesSpeederCivil5,
    speederCivil2,
    transporterPrivate,
    transporterAmbulance,
    transporterPoliceSwat,
  ].filter(Boolean);

  const textureKeyByTilesetName = new Map([
    ["Tileset_SciFi_CityShopping_Rasak", "cityShopping"],
    ["Tileset_SciFi_Street_Rasak_DUP", "street"],
    ["Tileset_SciFi_Garbage_Rasak", "garbage"],
    ["A5_Street_Rasak", "a5Street"],
    ["Tileset_SciFi_Slums_Rasak", "slums"],
    ["Tileset_SciFi_PublicTransportation_Slums_Rasak.png", "publicTransportation"],
    ["A4_SciFi_Outside_Rasak", "a4Outside"],
    ["A3_SciFi_Outside_Rasak", "a3Outside"],
    ["A5_SciFi_Outside_Rasak", "A5_SciFi_Outside_Rasak"],
    ["Tileset_SciFi_BuildingExtras", "buildingExtras"],
    ["TorreTileset", "torre"],
    ["Tileset_SciFi_Arpartment_2_Rasak", "apartment2"],
    ["Tileset_Modern_Industrial_2_Rasak", "ModernIndustrial2"],
    ["A1_Modern_Inside_Factory_Rasak", "ModernInsideFactoryA1"],
    ["parede-borda", "wallBorder"],
    ["!ShopDoor", "shopDoor"],
    ["Speeder_civil5", "VehiclesSpeederCivil5"],
    ["Speeder_civil2", "Speeder_civil2"],
    ["Transporter_Private", "Transporter_Private"],
    ["Transporter_Ambulance", "Transporter_Ambulance"],
    ["Transporter_PoliceSwat", "Transporter_PoliceSwat"],
  ]);

  // =====================================================
  // CAMADAS - CHÃO
  // =====================================================

  // Chão principal
  const camadaChao = map.createLayer("Chão", tilesets);

  // Faixas da rua
  const camadaFaixasRua = map.createLayer("FaixasRua", tilesets);

  // Cancelas
  const camadaCancelas = map.createLayer("Cancelas", tilesets);

  // =====================================================
  // CAMADAS - VEÍCULOS
  // =====================================================

  const camadaVehicles = map.createLayer("Vehicles", tilesets);

  // =====================================================
  // CAMADAS - CONSTRUÇÕES
  // =====================================================

  // Cerca da torre
  const camadaCercaTorre = map.createLayer("CercaTorre", tilesets);

  const camadaCercaCimaTorre = map.createLayer("CercaCimaTorre", tilesets);

  // Objetos da Torre
  const camadaContainerTorre = map.createLayer("ContainerTorre", tilesets);

  // Teto dos prédios
  const camadaTetoPredios = map.createLayer("TetoPredio", tilesets);

  const camadaAntenaTorre = map.createLayer("AntenaTorre", tilesets);

  // Prédios
  const camadaPredios = map.createLayer("Prédios", tilesets);

  // Frente das varandas
  const camadaFrenteVaranda = map.createLayer("FrenteVaranda", tilesets);

  // Detalhes dos prédios
  const camadaDetalhesPredios = map.createLayer("DetalhesPredios", tilesets);

  // =====================================================
  // CAMADAS - OBJETOS
  // =====================================================

  // Paredes
  const camadaParedes = map.createLayer("Paredes", tilesets);

  // Objetos secundários
  const camadaObjetos2 = map.createLayer("Objetos 2", tilesets);

  // Objetos
  const camadaObjetos = map.createLayer("Objetos", tilesets);

  // Postes
  const camadaPostes = map.createLayer("Postes", tilesets);

  // Cercas
  const camadaCercas = map.createLayer("Cercas", tilesets);

  // Cerca do spawn separada no próprio mapa
  const camadaCercaSpawn = map.createLayer("CercaSpawn", tilesets);

  // Cercas da fábrica
  const camadaCercaFabrica2 = map.createLayer("CercaFabrica2", tilesets);

  const camadaCercaFabrica = map.createLayer("CercaFabrica", tilesets);

  // =====================================================
  // CAMADAS - SOMBRAS
  // =====================================================

  const camadaSombra3 = map.createLayer("Sombra3", tilesets);

  const camadaSombra2 = map.createLayer("Sombra2", tilesets);

  const camadaSombra = map.createLayer("Sombra", tilesets);

  const camadaSombraGeral = map.createLayer("SombraGeral", tilesets);

  const camadaObjAcimaPerso = map.createLayer("ObjAcimaPerso", tilesets);

  // =====================================================
  // ORDEM DAS CAMADAS
  // =====================================================
  //
  // Quanto maior o depth,
  // mais na frente a camada aparece.
  //
  // =====================================================

  camadaChao?.setDepth(1);

  // Rua
  camadaFaixasRua?.setDepth(2);
  camadaCancelas?.setDepth(3);

  // Veículos
  camadaVehicles?.setDepth(4);

  // Construções
  camadaCercaTorre?.setDepth(5);
  camadaTetoPredios?.setDepth(6);
  camadaPredios?.setDepth(7);
  camadaFrenteVaranda?.setDepth(8);
  camadaDetalhesPredios?.setDepth(9);
  camadaParedes?.setDepth(10);
  camadaObjetos2?.setDepth(11);
  camadaCercaCimaTorre?.setDepth(14);
  camadaAntenaTorre?.setDepth(15);
  camadaContainerTorre?.setDepth(16);
  camadaObjetos?.setDepth(11);
  // A parte alta dos postes é uma TilemapLayer única e sempre cobre o mundo dinâmico.
  camadaPostes?.setDepth(DEPTHS.alwaysAboveWorld);
  camadaCercas?.setDepth(19);
  camadaObjAcimaPerso?.setDepth(DEPTHS.overlayAboveWorld);
  // Fica acima dos objetos, mas abaixo dos personagens dinâmicos.
  camadaCercaFabrica2?.setDepth(11.5);
  camadaCercaFabrica?.setDepth(13);
  camadaSombra3?.setDepth(21);
  camadaSombra2?.setDepth(22);
  camadaSombra?.setDepth(23);
  camadaSombraGeral?.setDepth(24);

  // Restaura as opacidades originais definidas no mapa Tiled.
  camadaSombra3?.setAlpha(1);
  camadaSombra2?.setAlpha(1);
  camadaSombra?.setAlpha(1);
  camadaSombraGeral?.setAlpha(0.7);

  scene.camadaCercas = camadaCercas;
  scene.camadaCercaSpawn = camadaCercaSpawn;
  scene.camadaCercaFabrica = camadaCercaFabrica;
  scene.depths = DEPTHS;
  scene.calcularDepthMundo = depthFromWorldY;
  camadaCercaSpawn?.setDepth(14);

  criarBasesPostes(scene, map, textureKeyByTilesetName);

  // =====================================================
  // DEBUG
  // =====================================================

  console.log("===== TILESETS =====");

  console.log("cityShopping:", cityShopping);
  console.log("street:", street);
  console.log("street2:", street2);
  console.log("garbage:", garbage);
  console.log("a5Street:", a5Street);
  console.log("slums:", slums);

  console.log("publicTransportation:", publicTransportation);

  console.log("apartment2:", apartment2);

  console.log("modernIndustrial2:", modernIndustrial2);

  console.log("modernInsideFactoryA1:", modernInsideFactoryA1);

  console.log("vehiclesSpeederCivil5:", vehiclesSpeederCivil5);

  // =====================================================
  // COLISÃO
  // =====================================================

  const collisionLayer = map.getObjectLayer("Collision");

  if (collisionLayer) {
    scene.collisionGroup = scene.physics.add.staticGroup();
    collisionLayer.objects.forEach((obj) => {
      const collision = scene.collisionGroup.create(
        obj.x + obj.width / 2,
        obj.y + obj.height / 2,
      );

      collision.setSize(obj.width, obj.height);
      collision.setVisible(false);

    });
  }

  // =====================================================
  // RETORNA O MAPA
  // =====================================================

  return map;
}

export default criarLevel1Map;
