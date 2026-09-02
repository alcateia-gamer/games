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

    vehiclesSpeederCivil5,
    speederCivil2,
    transporterPrivate,
    transporterAmbulance,
    transporterPoliceSwat,
  ].filter(Boolean);

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

  // Teto dos prédios
  const camadaTetoPredios = map.createLayer("TetoPredio", tilesets);

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

  // =====================================================
  // CAMADAS - SOMBRAS
  // =====================================================

  const camadaSombra3 = map.createLayer("Sombra3", tilesets);

  const camadaSombra2 = map.createLayer("Sombra2", tilesets);

  const camadaSombra = map.createLayer("Sombra", tilesets);

  const camadaSombraGeral = map.createLayer("SombraGeral", tilesets);

  // =====================================================
  // ORDEM DAS CAMADAS
  // =====================================================
  //
  // Quanto maior o depth,
  // mais na frente a camada aparece.
  //
  // =====================================================

  // Chão
  camadaChao?.setDepth(0);

  // Rua
  camadaFaixasRua?.setDepth(1);
  camadaCancelas?.setDepth(2);

  // Veículos
  camadaVehicles?.setDepth(3);

  // Construções
  camadaCercaTorre?.setDepth(4);
  camadaTetoPredios?.setDepth(5);
  camadaPredios?.setDepth(6);
  camadaFrenteVaranda?.setDepth(7);
  camadaDetalhesPredios?.setDepth(8);

  // Objetos
  camadaParedes?.setDepth(9);
  camadaObjetos2?.setDepth(10);
  camadaObjetos?.setDepth(11);
  camadaPostes?.setDepth(13);
  camadaCercas?.setDepth(14);

  // Sombras
  camadaSombra3?.setDepth(15);
  camadaSombra2?.setDepth(16);
  camadaSombra?.setDepth(17);
  camadaSombraGeral?.setDepth(19);

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
