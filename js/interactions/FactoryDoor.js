/**
 * @file Portas da fábrica abertas por interação. Substitui os tiles por um visual animado e
 * remove a colisão ao concluir a abertura.
 */

import { distanceToInteractionArea, findFactoryInteraction } from "./FactoryGenerator.js";

const FACTORY_DOOR_STATE_KEY = "factoryDoorOpen";
const INTERACTION_RANGE = 64;
const OPEN_DURATION = 850;
const PORTAS_COM_ACESSO = new Set(["porta02", "porta03"]);

/** Objetos de tile do leitor usam Y na base, diferente das áreas retangulares de interação. */
function localizarLeitorCartao(map) {
  const camada = map.getObjectLayer("Leitordecartão");
  if (camada?.visible === false) return null;
  const objeto = camada?.objects?.find(objeto => objeto.visible !== false &&
    Number.isFinite(objeto.x) && Number.isFinite(objeto.y) && objeto.width > 0 && objeto.height > 0);
  return objeto ? { x: objeto.x, y: objeto.y - (objeto.gid ? objeto.height : 0),
    width: objeto.width, height: objeto.height } : null;
}

/** Reconhece as persianas pelos seis tiles, preservando a configuração após exportar o Tiled. */
function completarAreasPortas(map, layer, areas) {
  const parede = map.getObjectLayer("ParedePortaBoss")?.objects?.filter(objeto => objeto.gid);
  const referencia = areas.find(area => area.name === "porta01");
  if (!referencia) return;
  const tw = map.tileWidth ?? 48;
  const th = map.tileHeight ?? 48;
  const candidatos = [];
  if (parede?.length) {
    const esquerda = Math.min(...parede.map(objeto => objeto.x));
    const direita = Math.max(...parede.map(objeto => objeto.x + objeto.width));
    const topo = Math.min(...parede.map(objeto => objeto.y - objeto.height));
    candidatos.push({ name: "porta02", x: esquerda - tw * 3, y: topo },
      { name: "porta03", x: direita, y: topo });
  }
  // Persiana próxima a X=322, Y=-1887; uma área porta04 no Tiled pode substituir a posição.
  candidatos.push({ name: "porta04", x: 240, y: -1920 });
  for (const { name, x, y } of candidatos) {
    if (areas.some(area => area.name === name)) continue;
    let mesmosTiles = true;
    for (let row = 0; row < 2; row++) {
      for (let col = 0; col < 3; col++) {
        const tile = layer.getTileAtWorldXY(x + col * tw, y + row * th);
        const original = layer.getTileAtWorldXY(referencia.x + col * tw, referencia.y + row * th);
        if (!tile || !original || tile.index !== original.index) mesmosTiles = false;
      }
    }
    if (mesmosTiles) areas.push({ name, x, y, width: tw * 3, height: th * 2 });
  }
}

/**
 * Mantém a chave original da primeira porta e estados independentes para as demais.
 */
function chaveEstadoPorta(nome) {
  return nome === "porta01" ? FACTORY_DOOR_STATE_KEY : `${FACTORY_DOOR_STATE_KEY}:${nome}`;
}

/** Prepara uma persiana com a mesma animação e colisão da porta original. */
function criarPorta(scene, layer, area) {
  const tiles = layer.getTilesWithinWorldXY(
    area.x, area.y, area.width, area.height,
  );
  const firstTile = layer.getTileAtWorldXY(area.x, area.y);
  if (!firstTile?.tileset) return null;

  // Os seis tiles da persiana ocupam um retângulo contínuo no atlas original.
  const texture = firstTile.tileset.image;
  const source = firstTile.tileset.getTileTextureCoordinates(firstTile.index);
  const frameName = `factory-door-${area.name}`;
  if (!texture.has(frameName)) {
    texture.add(frameName, 0, source.x, source.y, area.width, area.height);
  }

  const originalAlphas = tiles.map((tile) => tile.alpha);
  tiles.forEach((tile) => { tile.alpha = 0; });
  const visual = scene.add.image(area.x, area.y, texture.key, frameName)
    .setOrigin(0, 0).setDepth(layer.depth);
  // A moldura superior permanece no lugar enquanto a folha sobe por trás dela.
  const header = scene.add.image(area.x, area.y, texture.key, frameName)
    .setOrigin(0, 0).setCrop(0, 0, area.width, 8).setDepth(layer.depth);
  const prompt = scene.add.text(
    area.x + area.width / 2, area.y - 12, "E - ABRIR PORTA", {
      fontSize: "14px",
      backgroundColor: "#000000",
      padding: { x: 6, y: 4 },
    },
  ).setOrigin(0.5, 1).setDepth(200).setVisible(false);

  const stateKey = chaveEstadoPorta(area.name);
  const alreadyOpen = scene.game.registry.get(stateKey) === true;
  const colisao = alreadyOpen ? null : scene.collisionGroup.create(
    area.x + area.width / 2, area.y + area.height / 2,
  ).setDisplaySize(area.width, area.height).setVisible(false).refreshBody();
  const porta = {
    nome: area.name,
    area,
    estado: alreadyOpen ? "aberta" : "fechada",
    visual,
    colisao,
    progresso: alreadyOpen ? 1 : 0,
  };
  let tween;

  /**
   * Move e recorta a folha conforme o progresso da abertura, mantendo a moldura no lugar.
   */
  const atualizarVisual = () => {
    const offset = Math.round(area.height * porta.progresso);
    visual.setY(area.y - offset);
    visual.setCrop(0, offset, area.width, area.height - offset);
    visual.setVisible(offset < area.height);
  };
  /**
   * Verifica alcance, estado da porta e bloqueios de morte ou menu antes de permitir a
   * interação.
   */
  const podeInteragir = (alvo = area) =>
    porta.estado === "fechada" && scene.player?.active &&
    !scene.morteEmAndamento && !scene.generatorMenuOpen && !scene.devItemMenuOpen &&
    distanceToInteractionArea(scene.player.x, scene.player.y, alvo) <=
      INTERACTION_RANGE;

  /** A porta04 usa só energia; o leitor da arena também exige o crachá reutilizável. */
  const motivoBloqueio = () => {
    const exigeCartao = PORTAS_COM_ACESSO.has(area.name);
    if (!exigeCartao && area.name !== "porta04") return null;
    const requisitos = [];
    if (scene.luzFabricaAcesa !== true) requisitos.push("SEM ENERGIA");
    if (exigeCartao && !(scene.inventory?.getQuantity("card") > 0)) requisitos.push("REQUER CARTÃO DE ACESSO");
    return requisitos.length ? requisitos.join(" | ") : null;
  };

  /**
   * Inicia a animação; ao concluir, remove a colisão e registra que a porta está aberta.
   */
  const abrir = (alvo = area) => {
    if (!podeInteragir(alvo)) return false;
    const bloqueio = motivoBloqueio();
    if (bloqueio) {
      prompt.setText(bloqueio);
      return false;
    }
    porta.estado = "abrindo";
    scene.interacaoMundoProxima = null;
    prompt.setVisible(false);
    tween = scene.tweens.add({
      targets: porta,
      progresso: 1,
      duration: OPEN_DURATION,
      ease: "Sine.easeInOut",
      onUpdate: atualizarVisual,
      onComplete: () => {
        porta.estado = "aberta";
        // Remover o corpo do grupo também atualiza o índice de navegação dos robôs.
        colisao.destroy();
        porta.colisao = null;
        scene.game.registry.set(stateKey, true);
      },
    });
    return true;
  };

  /**
   * Ajusta a profundidade sem mover a moldura que cobre a folha da porta.
   */
  const atualizar = () => {
    // O personagem fica por cima enquanto a porta está fechada ou abrindo.
    // Após a abertura, a moldura fica acima dele durante a passagem.
    const playerDepth = scene.profundidadePersonagemParte2 ??
      scene.player?.depth ?? layer.depth;
    const doorDepth = porta.estado === "aberta"
      ? Math.max(layer.depth, playerDepth + 0.01)
      : Math.min(layer.depth, playerDepth - 0.01);
    visual.setDepth(doorDepth);
    header.setDepth(doorDepth);
    prompt.setText(motivoBloqueio() ?? "E - ABRIR PORTA");
  };

  const limpar = () => {
    tween?.stop();
    porta.colisao?.destroy();
    visual.destroy();
    header.destroy();
    prompt.destroy();
    tiles.forEach((tile, index) => { tile.alpha = originalAlphas[index]; });
  };
  atualizarVisual();
  return { porta, prompt, podeInteragir, motivoBloqueio, abrir, atualizar, limpar };
}

/** A porta original usa E; as duas persianas da arena são acionadas apenas pelo leitor. */
function criarInteracaoPortaFabrica(scene) {
  const layer = scene.map.getLayer("Portas")?.tilemapLayer;
  if (!layer) return;
  const objectLayers = Array.isArray(scene.map.objects) ? scene.map.objects : scene.map.layers;
  const nomes = new Set((objectLayers ?? []).flatMap(layer => layer.objects ?? [])
    .map(object => object.name).filter(name => /^porta\d+$/.test(name)));
  const portas = [];
  const areas = [];
  for (const nome of nomes) {
    const result = findFactoryInteraction(scene.map, nome);
    if (result.status === "ok") areas.push(result.object);
  }
  completarAreasPortas(scene.map, layer, areas);
  for (const area of areas) {
    const controle = criarPorta(scene, layer, area);
    if (controle) portas.push(controle);
  }
  if (!portas.length) return;
  scene.portasFabrica = portas.map(({ porta }) => porta);
  // Preserva a referência usada pela primeira porta e por integrações existentes.
  scene.portaFabrica = scene.portasFabrica.find(porta => porta.nome === "porta01") ?? null;
  const portasLeitor = portas.filter(controle => PORTAS_COM_ACESSO.has(controle.porta.nome));
  const areaLeitor = localizarLeitorCartao(scene.map);
  const avisoLeitor = areaLeitor && portasLeitor.length ? scene.add.text(
    areaLeitor.x + areaLeitor.width / 2, areaLeitor.y - 12, "E - PASSAR CARTÃO", {
      fontSize: "14px", backgroundColor: "#000000", padding: { x: 6, y: 4 },
    },
  ).setOrigin(0.5, 1).setDepth(200).setVisible(false) : null;
  scene.leitorCartaoFabrica = avisoLeitor ? { area: areaLeitor, prompt: avisoLeitor } : null;
  const leitorProximo = () => !!avisoLeitor && scene.player?.active &&
    !scene.morteEmAndamento && !scene.generatorMenuOpen && !scene.devItemMenuOpen &&
    distanceToInteractionArea(scene.player.x, scene.player.y, areaLeitor) <= INTERACTION_RANGE;
  const passarCartao = () => {
    if (!leitorProximo()) return false;
    let abriu = false;
    for (const controle of portasLeitor) {
      if (controle.abrir(areaLeitor)) abriu = true;
    }
    return abriu;
  };
  const atualizar = () => {
    let proxima = null;
    let distancia = Infinity;
    for (const controle of portas) {
      controle.atualizar();
      if (PORTAS_COM_ACESSO.has(controle.porta.nome) || !controle.podeInteragir()) continue;
      const area = controle.porta.area;
      const atual = distanceToInteractionArea(scene.player.x, scene.player.y, area);
      if (atual < distancia) { proxima = controle; distancia = atual; }
    }
    for (const controle of portas) controle.prompt.setVisible(controle === proxima);
    scene.interacaoMundoProxima = proxima ? { distance: distancia, interact: proxima.abrir } : null;
    if (avisoLeitor) {
      const perto = leitorProximo();
      const fechadas = portasLeitor.filter(controle => controle.porta.estado === "fechada");
      const abrindo = portasLeitor.some(controle => controle.porta.estado === "abrindo");
      avisoLeitor.setVisible(perto).setText(fechadas.length
        ? fechadas[0].motivoBloqueio() ?? "E - PASSAR CARTÃO"
        : abrindo ? "ABRINDO PORTAS..." : "ACESSO LIBERADO");
      const distanciaLeitor = perto ? distanceToInteractionArea(scene.player.x, scene.player.y, areaLeitor) : Infinity;
      if (fechadas.length && distanciaLeitor < distancia) {
        scene.interacaoMundoProxima = { distance: distanciaLeitor, interact: passarCartao };
        proxima?.prompt.setVisible(false);
      }
    }
  };
  scene.atualizarInteracaoPortaFabrica = atualizar;
  scene.events.on(Phaser.Scenes.Events.PRE_RENDER, atualizar);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    scene.events.off(Phaser.Scenes.Events.PRE_RENDER, atualizar);
    portas.forEach(controle => controle.limpar());
    avisoLeitor?.destroy();
    scene.leitorCartaoFabrica = null;
    scene.portasFabrica = [];
    scene.portaFabrica = null;
    scene.interacaoMundoProxima = null;
    scene.atualizarInteracaoPortaFabrica = null;
  });
  atualizar();
}

export { FACTORY_DOOR_STATE_KEY, chaveEstadoPorta, criarInteracaoPortaFabrica };
