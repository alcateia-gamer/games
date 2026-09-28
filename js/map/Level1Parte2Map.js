function pontoDentroPoligono(x, y, pontos) {
  let dentro = false;

  for (let indice = 0, anterior = pontos.length - 1; indice < pontos.length; anterior = indice++) {
    const pontoAtual = pontos[indice];
    const pontoAnterior = pontos[anterior];
    const cruzaLinha =
      pontoAtual.y > y !== pontoAnterior.y > y &&
      x <
        ((pontoAnterior.x - pontoAtual.x) * (y - pontoAtual.y)) /
          (pontoAnterior.y - pontoAtual.y) +
          pontoAtual.x;

    if (cruzaLinha) {
      dentro = !dentro;
    }
  }

  return dentro;
}

function adicionarCorposPoligono(grupo, objeto) {
  const pontos = objeto.polygon.map((ponto) => ({
    x: Number(objeto.x) + Number(ponto.x),
    y: Number(objeto.y) + Number(ponto.y),
  }));
  const menorX = Math.floor(Math.min(...pontos.map((ponto) => ponto.x)));
  const maiorX = Math.ceil(Math.max(...pontos.map((ponto) => ponto.x)));
  const menorY = Math.floor(Math.min(...pontos.map((ponto) => ponto.y)));
  const maiorY = Math.ceil(Math.max(...pontos.map((ponto) => ponto.y)));
  const tamanhoCelula = 8;

  for (let y = menorY; y < maiorY; y += tamanhoCelula) {
    for (let x = menorX; x < maiorX; x += tamanhoCelula) {
      const centroX = x + tamanhoCelula / 2;
      const centroY = y + tamanhoCelula / 2;

      if (!pontoDentroPoligono(centroX, centroY, pontos)) {
        continue;
      }

      const corpo = grupo.create(centroX, centroY);
      corpo.setSize(
        Math.min(tamanhoCelula, maiorX - x),
        Math.min(tamanhoCelula, maiorY - y),
      );
      corpo.setVisible(false);
    }
  }
}

function calcularDepthObjeto(profundidadeCamada, y) {
  return profundidadeCamada - Number(y || 0) / 100000;
}

function atualizarDepthObjetosProducaoEArmazem(scene) {
  if (!Array.isArray(scene.objetosMapaParte2)) {
    return;
  }

  scene.objetosMapaParte2.forEach((visual) => {
    if (
      !visual?.active ||
      !["ObjetosProdução", "ObjetosArmazem"].includes(
        visual.getData("objectLayerName"),
      )
    ) {
      return;
    }

    visual.setDepth(
      calcularDepthObjeto(
        visual.getData("depthBase"),
        visual.getData("worldY"),
      ),
    );
  });
}

function atualizarDepthGarras(scene) {
  const player = scene.player;
  if (!player?.active || !Array.isArray(scene.objetosMapaParte2)) {
    return;
  }

  const playerY = player.body?.bottom ?? player.getBounds().bottom;
  const playerDepth = player.depth;

  scene.objetosMapaParte2.forEach((visual) => {
    if (
      !visual?.active ||
      visual.getData("objectLayerName") !== "Garras"
    ) {
      return;
    }

    const garraY = visual.getData("worldY");
    const personagemAcima = playerY > garraY;
    visual.setDepth(playerDepth + (personagemAcima ? -0.01 : 0.01));
  });
}

const PROFUNDIDADES_OBJETOS_PARTE2 = {
  ObjetosRobos: 4,
  ObjetosProdução: 10,
  NeonArma: 17,
  ObjetosCozinha: 18,
  ObjetosArmazem: 19,
  Garras: 16.25,
  SuporteTrilho: 20,
  ObjetosBoss: 21,
  EstátuaRobos: 27,
};

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
    ["parede-borda", "wallBorders"],
    ["Tileset_SciFi_Arpartment_1_Rasak", "apartment1"],
    ["Tileset_SciFi_Arpartment_2_Rasak", "apartment2"],
    ["Tileset_SciFi_CityShopping_Rasak", "cityShopping"],
    ["Tileset_SciFi_Slums_Rasak", "slums"],
    ["Tileset_SciFi_Garbage_Rasak", "garbage"],
    [
      "Tileset_SciFi_PublicTransportation_Slums_Rasak.png",
      "publicTransportation",
    ],
    ["A4_SciFi_Inside_Rasak", "insideA4"],
    ["!Security Door", "securityDoor"],
    ["!Industrial Gate", "industrialGate"],
    ["!$Controlls", "industrialControls"],
    ["!Industrial mashines", "industrialMachines"],
    ["!Switch_Rasak", "industrialSwitch"],
    ["Supercomputer", "supercomputer"],
    ["$ElectricGenerator", "electricGenerator"],
    ["!$Generator_char", "generatorCharacter"],
    ["$Satalite", "satellite"],
    ["!Ventilation System", "ventilationSystem"],
    ["!$ShieldGenerator", "shieldGenerator"],
    ["!Chem-Tank", "chemTank"],
    ["!$Shield_Door_char", "shieldDoorCharacter"],
    ["RoboPB", "roboPB"],
    ["!$Neontubes1", "neonTubes1"],
    ["!$Neontubes2", "neonTubes2"],
    ["!Industrials_Lights1", "industrialLights1"],
    ["EnergiaBoss", "energiaBoss"],
    ["RoboV", "roboV"],
    ["!$ModernFloorLights", "modernFloorLights"],
    ["!ShopDoor", "shopDoor"],
  ];

  const tilesets = registrosTilesets
    .map(([nome, chaveImagem]) => {
      const tileset = map.addTilesetImage(nome, chaveImagem);

      if (!tileset) {
        console.error(
          `Tileset da parte 2 não registrado: ${nome} (imagem: ${chaveImagem})`,
        );
      } else if (scene.DEBUG_MAP) {
        console.log(`[Parte 2] Tileset carregado: ${nome} -> ${chaveImagem}`);
      }

      return tileset;
    })
    .filter(Boolean);

  const camadaChao = map.createLayer("chão", tilesets);
  const camadaDetalhesChao = map.createLayer("detalhes do chão", tilesets);
  const camadaListrasChao = map.createLayer("ListrasChão", tilesets);
  const camadaSujeira = map.createLayer("Sujeira", tilesets);
  const camadaObjetoAbaixoParede = map.createLayer(
    "ObjetoAbaixoParede",
    tilesets,
  );
  const camadaFiosCarregando = map.createLayer("Fios Carregando", tilesets);
  const camadaParedeAbaixoPerso = map.createLayer(
    "ParedeAbaixoPerso",
    tilesets,
  );
  const camadaParedeAcimaPerso = map.createLayer(
    "ParedeAcimaPerso",
    tilesets,
  );
  const camadaEncanamentos = map.createLayer("Encanamentos", tilesets);
  const camadaBancadaArmas = map.createLayer("BancadaArmas", tilesets);
  const camadaObjetos2 = map.createLayer("Objetos2", tilesets);
  const camadaPortas = map.createLayer("Portas", tilesets);
  const camadaObjetos1 = map.createLayer("Objetos1", tilesets);
  const camadaObjetosAcimaPers = map.createLayer(
    "ObjetosAcimaPers",
    tilesets,
  );
  const camadaTrilhoBracos = map.createLayer("TrilhoBraços", tilesets);
  const camadaChaoProducao = map.createLayer("ChãoProdução", tilesets);
  const camadaBracosRoboticos = map.createLayer("BraçosRoboticos", tilesets);
  const camadaBordaAlta = map.createLayer("BordaAlta", tilesets);
  const camadaBordaCurvas = map.createLayer("BordaCurvas", tilesets);

  // A profundidade 16.5 fica reservada ao personagem.
  camadaChao?.setDepth(1);
  camadaDetalhesChao?.setDepth(2);
  camadaListrasChao?.setDepth(3);
  camadaSujeira?.setDepth(5);
  camadaObjetoAbaixoParede?.setDepth(6);
  camadaFiosCarregando?.setDepth(7);
  camadaParedeAbaixoPerso?.setDepth(8);
  camadaParedeAcimaPerso?.setDepth(26);
  camadaEncanamentos?.setDepth(11);
  camadaBancadaArmas?.setDepth(12);
  camadaObjetos2?.setDepth(14);
  camadaPortas?.setDepth(13);
  camadaObjetos1?.setDepth(16);
  camadaObjetosAcimaPers?.setDepth(17);
  camadaTrilhoBracos?.setDepth(23);
  camadaChaoProducao?.setDepth(24);
  camadaBracosRoboticos?.setDepth(25);
  camadaBordaAlta?.setDepth(27);
  camadaBordaCurvas?.setDepth(29);

  const camadasTiles = [
    camadaChao,
    camadaDetalhesChao,
    camadaListrasChao,
    camadaSujeira,
    camadaObjetoAbaixoParede,
    camadaFiosCarregando,
    camadaParedeAbaixoPerso,
    camadaParedeAcimaPerso,
    camadaEncanamentos,
    camadaBancadaArmas,
    camadaObjetos2,
    camadaPortas,
    camadaObjetos1,
    camadaObjetosAcimaPers,
    camadaTrilhoBracos,
    camadaChaoProducao,
    camadaBracosRoboticos,
    camadaBordaAlta,
    camadaBordaCurvas,
  ].filter(Boolean);
  const ordemCamadasTiled = map.data?.layers || map.layers;

  if (scene.DEBUG_MAP) {
    console.log(
      `[Parte 2] Tilesets: ${tilesets.length}/${registrosTilesets.length}; ` +
        `camadas tile: ${camadasTiles.length}`,
    );
  }

  scene.camadaParedeAbaixoPerso = camadaParedeAbaixoPerso;
  scene.camadaParedeAcimaPerso = camadaParedeAcimaPerso;

  const textureKeyByTilesetName = new Map(
    registrosTilesets.map(([nome, chaveImagem]) => [nome, chaveImagem]),
  );

  scene.objetosMapaParte2 = [];
  const camadasObjetos =
    map.objects ||
    (map.data?.layers || [])
      .filter((layerData) => layerData.type === "objectgroup")
      .map((layerData) => map.getObjectLayer(layerData.name))
      .filter(Boolean);

  camadasObjetos
    .filter((layerData) => layerData.name !== "collision")
    .forEach((layerData, index) => {
      const indiceTiled = ordemCamadasTiled.findIndex(
        (item) => item.name === layerData.name,
      );
      const profundidadeBase = indiceTiled >= 0 ? indiceTiled + 1 : 1 + index;
      const profundidadeTiled =
        scene.profundidadesObjetosParte2?.[layerData.name] ??
        PROFUNDIDADES_OBJETOS_PARTE2[layerData.name] ??
        (profundidadeBase >= 9 ? profundidadeBase + 1 : profundidadeBase);

      layerData.objects.forEach((object) => {
        if (!object.gid) {
          return;
        }

        const rawGid = Number(object.gid) >>> 0;
        const gid = rawGid & 0x1fffffff;
        const tileset = [...map.tilesets]
          .reverse()
          .find((item) => gid >= Number(item.firstgid));
        const textureKey = textureKeyByTilesetName.get(tileset?.name);

        if (!tileset || !textureKey || !scene.textures.exists(textureKey)) {
          console.warn(
            `Objeto do mapa parte 2 ignorado: GID ${gid} sem tileset/imagem carregada.`,
          );
          return;
        }

        const texture = scene.textures.get(textureKey);
        const tileWidth = Number(tileset.tilewidth || map.tileWidth);
        const tileHeight = Number(tileset.tileheight || map.tileHeight);
        const columns = Number(
          tileset.columns || Math.floor(texture.source[0].width / tileWidth),
        );
        const tileIndex = gid - Number(tileset.firstgid);
        const frameName = `mapa-parte2-${textureKey}-${tileIndex}`;

        if (!texture.frames[frameName]) {
          texture.add(
            frameName,
            0,
            (tileIndex % columns) * tileWidth,
            Math.floor(tileIndex / columns) * tileHeight,
            tileWidth,
            tileHeight,
          );
        }

        const width = Number(object.width || tileWidth);
        const height = Number(object.height || tileHeight);
        const profundidade = calcularDepthObjeto(
          profundidadeTiled + 0.25,
          object.y,
        );
        const visual = scene.add
          .image(
            Number(object.x) + width / 2,
            Number(object.y),
            textureKey,
            frameName,
          )
          .setOrigin(0.5, 1)
          .setScale(width / tileWidth, height / tileHeight)
          .setDepth(profundidade);

        visual.setRotation(Phaser.Math.DegToRad(Number(object.rotation || 0)));
        visual.setFlipX(Boolean(object.flippedHorizontal));
        visual.setFlipY(Boolean(object.flippedVertical));
        visual.setAlpha(Number.isFinite(object.opacity) ? object.opacity : 1);
        visual.setData("worldY", Number(object.y || 0));
        visual.setData("objectLayerName", layerData.name);
        visual.setData("depthBase", profundidadeTiled + 0.25);
        scene.objetosMapaParte2.push(visual);
      });
    });

  const collisionLayer = map.getObjectLayer("collision");

  if (collisionLayer) {
    scene.collisionGroup = scene.physics.add.staticGroup();

    collisionLayer.objects.forEach((obj) => {
      if (obj.polygon?.length >= 3) {
        adicionarCorposPoligono(scene.collisionGroup, obj);
        return;
      }

      const collision = scene.collisionGroup.create(
        obj.x + obj.width / 2,
        obj.y + obj.height / 2,
      );

      collision.setSize(obj.width, obj.height);
      collision.setVisible(false);
    });
  }

  scene.camadasMapaParte2 = camadasTiles.map(
    ({ name }) => map.getLayer(name)?.tilemapLayer,
  );

  return map;
}

export default criarLevel1Parte2Map;
export { atualizarDepthGarras, atualizarDepthObjetosProducaoEArmazem };
