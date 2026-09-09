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
    ["bordasparede", "wallBorders"],
    ["parede-borda", "wallBorder"],
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

  map.layers.forEach((layerData, index) => {
    const camada = map.createLayer(layerData.name, tilesets);

    camada?.setDepth(index + 1);

    if (layerData.name === "parede-baixo 1") {
      scene.camadaParedeBaixo1 = camada;
    }

    if (layerData.name === "parede-baixo 2") {
      scene.camadaParedeBaixo2 = camada;
    }

    if (layerData.name === "parede-cima 1") {
      scene.camadaParedeCima1 = camada;
    }

    if (layerData.name === "parede-cima 2") {
      scene.camadaParedeCima2 = camada;
    }
  });

  scene.camadaParedeCima2?.setDepth(6);
  scene.camadaParedeCima1?.setDepth(7);
  scene.camadaParedeBaixo2?.setDepth(13);
  scene.camadaParedeBaixo1?.setDepth(14);

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
