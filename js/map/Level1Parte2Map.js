function criarLevel1Parte2Map(scene) {
  const map = scene.make.tilemap({
    key: "mapaParte2",
  });

  const registrosTilesets = [
    ["A1_Modern_Inside_Factory_Rasak", "factoryInsideA1"],
    ["A2_Industrial_Rasak", "industrialA2"],
    ["A4_Modern_Industrial_Rasak", "industrialA4"],
    ["A5_SciFi_Industrial_Rasak", "industrialA5"],
    ["Tileset_Modern_Industrial_1_Rasak", "industrial1"],
    ["Tileset_Modern_Industrial_2_Rasak", "ModernIndustrial2"],
    ["Tileset_Modern_Industrial_3_Rasak", "industrial3"],
    ["Tileset_ModernSciFi_Entertaining_District_Rasak", "entertainingDistrict"],
    ["A3_SciFi_Outside_Rasak", "a3Outside"],
    ["A4_SciFi_Outside_Rasak", "a4Outside"],
    ["A5_SciFi_Outside_Rasak", "A5_SciFi_Outside_Rasak"],
    ["Tileset_SciFi_BuildingExtras", "buildingExtras"],
    ["A4_SciFi_Inside_Rasak", "insideA4"],
    ["A5_SciFi_Inside_Rasak", "insideA5"],
    ["A2_Scifi_Outside_Rasak", "a2Outside"],
    ["A3_SciFi_Inside_Rasak", "insideA3"],
    ["parede-borda(3)", "wallBorders"],
    ["Tileset_SciFi_Arpartment_1_Rasak", "apartment1"],
    ["Tileset_SciFi_Arpartment_2_Rasak", "apartment2"],
    ["Tileset_SciFi_CityShopping_Rasak", "cityShopping"],
    ["Tileset_SciFi_Slums_Rasak", "slums"],
    ["Tileset_SciFi_Garbage_Rasak", "garbage"],
    ["A4_SciFi_Inside_Rasak", "insideA4"],
    ["!Security Door", "securityDoor"],
    ["!Industrial Gate", "industrialGate"],
    ["!$Controlls", "industrialControls"],
    ["!Industrial mashines", "industrialMachines"],
    ["Supercomputer", "supercomputer"],
    ["Tileset_Modern_Industrial_3_Rasak", "industrial3"],
  ];

  const tilesets = registrosTilesets
    .map(([nome, chaveImagem]) => {
      const tileset = map.addTilesetImage(nome, chaveImagem);

      if (!tileset) {
        console.error(
          `Tileset da parte 2 não registrado: ${nome} (imagem: ${chaveImagem})`,
        );
      }

      return tileset;
    })
    .filter(Boolean);

  const camadasMapa = [
    ["chão", 1],
    ["detalhes do chão", 2],
    ["Sujeira", 3],
    ["ObjetoAbaixoParede", 4],
    ["ParedeAcimaPerso", 10],
    ["ParedeAbaixoPerso", 6],
    ["Objetos2", 7],
    ["Portas", 8],
    ["Objetos1", 9],
    ["BordaAlta", 11],
    ["BordaCurvas", 12],
    ["objetos 2", 9],
    ["objetos 3", 10],
  ];

  camadasMapa.forEach(([nome, profundidade]) => {
    const camada = map.createLayer(nome, tilesets);

    if (!camada) {
      console.error(`Camada de tiles não criada no mapa parte 2: "${nome}"`);
      return;
    }

    camada.setDepth(profundidade);

    if (nome === "ParedeAbaixoPerso") {
      scene.camadaParedeAbaixoPerso = camada;
    }

    if (nome === "ParedeAcimaPerso") {
      scene.camadaParedeAcimaPerso = camada;
    }
  });

  const collisionLayer = map.getObjectLayer("collision");

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

  return map;
}

export default criarLevel1Parte2Map;
