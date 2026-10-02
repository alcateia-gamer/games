import {
  calcularDepthObjeto,
  PROFUNDIDADES_OBJETOS_PARTE2,
  depthFromWorldY,
} from "./ProfundidadeMapa.js";

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
    console.warn(
      `PostesObjetos: GID ${gid} não pôde ser associado a um tileset.`,
    );
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
  const sourceY =
    margin + Math.floor(tileIndex / columns) * (tileHeight + spacing);
  const width = Number(object.width || tileWidth);
  const height = Number(object.height || tileHeight);
  const frameName = `postes-objetos-${tileset.name}-${tileIndex}`;

  if (!texture.frames[frameName]) {
    texture.add(frameName, 0, sourceX, sourceY, tileWidth, tileHeight);
  }

  // Tile Objects usam x como a borda esquerda e y como a borda inferior.
  const base = scene.add
    .image(
      Number(object.x) + width / 2,
      Number(object.y),
      textureKey,
      frameName,
    )
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

function criarObjetosCidade(scene, map, textureKeyByTilesetName) {
  const camadaNeon = map.getObjectLayer("Neon");
  scene.neonObjects = camadaNeon
    ? camadaNeon.objects
        .map((object) =>
          criarBaseVisual(scene, map, object, textureKeyByTilesetName),
        )
        .filter(Boolean)
    : [];

  criarBasesPostes(scene, map, textureKeyByTilesetName);
}

function criarObjetosFabrica(scene, map, textureKeyByTilesetName) {
  scene.objetosMapaParte2 = [];
  const ordemCamadasTiled = map.data?.layers || map.layers;
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

  return scene.objetosMapaParte2;
}

export { criarObjetosCidade, criarObjetosFabrica };
