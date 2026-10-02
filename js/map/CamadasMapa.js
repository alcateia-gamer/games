function criarCamadasCidade(map, tilesets, depths) {
  const camadaChao = map.createLayer("Chão", tilesets);
  const camadaFaixasRua = map.createLayer("FaixasRua", tilesets);
  const camadaCancelas = map.createLayer("Cancelas", tilesets);
  const camadaVehicles = map.createLayer("Vehicles", tilesets);
  const camadaCercaTorre = map.createLayer("CercaTorre", tilesets);
  const camadaCercaCimaTorre = map.createLayer("CercaCimaTorre", tilesets);
  const camadaContainerTorre = map.createLayer("ContainerTorre", tilesets);
  const camadaTetoPredios = map.createLayer("TetoPredio", tilesets);
  const camadaAntenaTorre = map.createLayer("AntenaTorre", tilesets);
  const camadaPredios = map.createLayer("Prédios", tilesets);
  const camadaFrenteVaranda = map.createLayer("FrenteVaranda", tilesets);
  const camadaDetalhesPredios = map.createLayer("DetalhesPredios", tilesets);
  const camadaParedes = map.createLayer("Paredes", tilesets);
  const camadaObjetos2 = map.createLayer("Objetos 2", tilesets);
  const camadaObjetos = map.createLayer("Objetos", tilesets);
  const camadaBorda = map.createLayer("Borda", tilesets);
  const camadaBordaCurva = map.createLayer("BordaCurva", tilesets);
  const camadaPostes = map.createLayer("Postes", tilesets);
  const camadaCercas = map.createLayer("Cercas", tilesets);
  const camadaCercaSpawn = map.createLayer("CercaSpawn", tilesets);
  const camadaCercaFabrica2 = map.createLayer("CercaFabrica2", tilesets);
  const camadaCercaFabrica = map.createLayer("CercaFabrica", tilesets);
  const camadaSombra3 = map.createLayer("Sombra3", tilesets);
  const camadaSombra2 = map.createLayer("Sombra2", tilesets);
  const camadaSombra = map.createLayer("Sombra", tilesets);
  const camadaSombraGeral = map.createLayer("SombraGeral", tilesets);
  const camadaObjAcimaPerso = map.createLayer("ObjAcimaPerso", tilesets);

  camadaChao?.setDepth(1);
  camadaFaixasRua?.setDepth(2);
  camadaCancelas?.setDepth(3);
  camadaVehicles?.setDepth(4);
  camadaCercaTorre?.setDepth(5);
  camadaTetoPredios?.setDepth(6);
  camadaPredios?.setDepth(7);
  camadaFrenteVaranda?.setDepth(8);
  camadaDetalhesPredios?.setDepth(9);
  camadaParedes?.setDepth(10);
  camadaBorda?.setDepth(19);
  camadaBordaCurva?.setDepth(19);
  camadaObjetos2?.setDepth(11);
  camadaCercaCimaTorre?.setDepth(14);
  camadaAntenaTorre?.setDepth(15);
  camadaContainerTorre?.setDepth(16);
  camadaObjetos?.setDepth(11);
  camadaPostes?.setDepth(depths.alwaysAboveWorld);
  camadaCercas?.setDepth(19);
  camadaObjAcimaPerso?.setDepth(depths.overlayAboveWorld);
  camadaCercaFabrica2?.setDepth(11.5);
  camadaCercaFabrica?.setDepth(13);
  camadaSombra3?.setDepth(21);
  camadaSombra2?.setDepth(22);
  camadaSombra?.setDepth(23);
  camadaSombraGeral?.setDepth(24);

  camadaSombra3?.setAlpha(1);
  camadaSombra2?.setAlpha(1);
  camadaSombra?.setAlpha(1);
  camadaSombraGeral?.setAlpha(0.7);

  camadaCercaSpawn?.setDepth(14);

  return {
    camadaCercas,
    camadaCercaSpawn,
    camadaCercaFabrica,
  };
}

function criarCamadasFabrica(map, tilesets, scene, registrosTilesets) {
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
  const camadaParedeAcimaPerso = map.createLayer("ParedeAcimaPerso", tilesets);
  const camadaEncanamentos = map.createLayer("Encanamentos", tilesets);
  const camadaBancadaArmas = map.createLayer("BancadaArmas", tilesets);
  const camadaObjetos2 = map.createLayer("Objetos2", tilesets);
  const camadaPortas = map.createLayer("Portas", tilesets);
  const camadaObjetos1 = map.createLayer("Objetos1", tilesets);
  const camadaObjetosAcimaPers = map.createLayer("ObjetosAcimaPers", tilesets);
  const camadaTrilhoBracos = map.createLayer("TrilhoBraços", tilesets);
  const camadaChaoProducao = map.createLayer("ChãoProdução", tilesets);
  const camadaBracosRoboticos = map.createLayer("BraçosRoboticos", tilesets);
  const camadaBordaAlta = map.createLayer("BordaAlta", tilesets);
  const camadaBordaCurvas = map.createLayer("BordaCurvas", tilesets);

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

  if (scene.DEBUG_MAP) {
    console.log(
      `[Parte 2] Tilesets: ${tilesets.length}/${registrosTilesets.length}; ` +
        `camadas tile: ${camadasTiles.length}`,
    );
  }

  return {
    camadasTiles,
    camadaParedeAbaixoPerso,
    camadaParedeAcimaPerso,
  };
}

export { criarCamadasCidade, criarCamadasFabrica };
