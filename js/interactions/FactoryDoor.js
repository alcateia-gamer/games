/**
 * @file Portas da fábrica abertas por interação, com persianas animadas e portas instantâneas.
 */

import { calcularDepthAtor } from "../map/ProfundidadeMapa.js";
import { distanceToInteractionArea, findFactoryInteraction } from "./FactoryGenerator.js";
import { criarInteracaoLeitorCartao } from "./FactoryCardReader.js";
import { drawCollectibleMarker } from "../ui/CollectibleMarker.js";
import { criarFalaFlutuante } from "../ui/PlayerSpeechBubble.js";
import { criarSomPortaFabrica, SINCRONIA_PORTA_FABRICA } from "../sounds/portaFabrica.js";

const FACTORY_DOOR_STATE_KEY = "factoryDoorOpen";
const INTERACTION_RANGE = 64;
const CLOSE_DURATION = 850;
const PORTAS_COM_ACESSO = new Set(["porta02", "porta03"]);
const PORTAS_COM_ENERGIA = new Set(["porta01", "porta04"]);
const FALAS_SEM_ENERGIA = Object.freeze([
  "Preciso ligar a energia antes.",
  "Sem energia... melhor ligar o gerador.",
  "Primeiro preciso ativar o gerador.",
  "Essa porta está sem energia. Preciso ligar o gerador.",
  "Sem energia, essa porta não vai abrir.",
  "O gerador desligado está travando a passagem.",
  "Preciso de energia para abrir essa porta.",
  "Essa porta só funciona com a energia ligada.",
]);
const FALAS_SEM_CARTAO = Object.freeze([
  "Preciso encontrar o cartão de acesso.",
  "Sem o cartão, essa porta não abre.",
  "Esse leitor precisa de um cartão de acesso.",
  "Tenho que achar o cartão para continuar.",
  "Não estou com o cartão. Melhor procurar.",
  "Preciso do cartão para liberar a passagem.",
  "Ainda falta encontrar o cartão de acesso.",
  "Vou ter que encontrar esse cartão primeiro.",
]);

function criarMarcadorPorta(scene, area, nome) {
  const marcador = scene.add.graphics()
    .setPosition(area.x + area.width / 2, area.y - 18)
    .setDepth(200).setName(nome).setVisible(false);
  drawCollectibleMarker(marcador, 0, 0, 18);
  scene.tweens.add({ targets: marcador, y: marcador.y - 5,
    duration: 700, ease: "Sine.easeInOut", yoyo: true, repeat: -1 });
  return marcador;
}

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
  // Porta vertical da sala dos computadores: os três tiles não possuem animação.
  if (!areas.some(area => area.name === "porta05")) {
    const x = -480, y = -5904;
    const completa = [0, 1, 2].every(row =>
      (layer.getTileAtWorldXY(x, y + row * th)?.index & 0x1fffffff) === 2980);
    if (completa) areas.push({ name: "porta05", x, y, width: tw, height: th * 3, semAnimacao: true });
  }
}

/**
 * Mantém a chave original da primeira porta e estados independentes para as demais.
 */
function chaveEstadoPorta(nome) {
  return nome === "porta01" ? FACTORY_DOOR_STATE_KEY : `${FACTORY_DOOR_STATE_KEY}:${nome}`;
}

/** Mantém os tiles de portas instantâneas e prepara o visual móvel apenas das persianas. */
function criarPorta(scene, layer, area, fala) {
  const tiles = layer.getTilesWithinWorldXY(
    area.x, area.y, area.width, area.height,
  );
  const firstTile = layer.getTileAtWorldXY(area.x, area.y);
  if (!firstTile?.tileset) return null;
  const animada = area.semAnimacao !== true;
  const som = criarSomPortaFabrica(scene, area, animada);
  const originalAlphas = tiles.map((tile) => tile.alpha);
  let visual = null, header = null;
  if (animada) {
    // Os seis tiles da persiana ocupam um retângulo contínuo no atlas original.
    const texture = firstTile.tileset.image;
    const source = firstTile.tileset.getTileTextureCoordinates(firstTile.index);
    const frameName = `factory-door-${area.name}`;
    if (!texture.has(frameName)) {
      texture.add(frameName, 0, source.x, source.y, area.width, area.height);
    }
    tiles.forEach((tile) => { tile.alpha = 0; });
    visual = scene.add.image(area.x, area.y, texture.key, frameName)
      .setOrigin(0, 0).setDepth(layer.depth);
    // A moldura superior permanece no lugar enquanto a folha sobe por trás dela.
    header = scene.add.image(area.x, area.y, texture.key, frameName)
      .setOrigin(0, 0).setCrop(0, 0, area.width, 8).setDepth(layer.depth);
  }
  const marcador = PORTAS_COM_ENERGIA.has(area.name)
    ? criarMarcadorPorta(scene, area, `door-marker-${area.name}`) : null;
  const prompt = marcador ? null : scene.add.text(
    area.x + area.width / 2, area.y - 12, "E - ABRIR PORTA", {
      fontSize: "14px",
      backgroundColor: "#000000",
      padding: { x: 6, y: 4 },
    },
  ).setOrigin(0.5, 1).setDepth(200).setVisible(false);

  const stateKey = chaveEstadoPorta(area.name);
  const alreadyOpen = scene.game.registry.get(stateKey) === true &&
    (area.name !== "porta05" || scene.novoBoss?.morto === true);
  const criarColisao = () => scene.collisionGroup.create(
    area.x + area.width / 2, area.y + area.height / 2,
  ).setDisplaySize(area.width, area.height).setVisible(false).refreshBody();
  const porta = {
    nome: area.name,
    area,
    estado: alreadyOpen ? "aberta" : "fechada",
    visual,
    marcador,
    colisao: alreadyOpen ? null : criarColisao(),
    bloqueadaPorBoss: false,
    progresso: alreadyOpen ? 1 : 0,
  };
  let tween;
  let encerrada = false;
  let abertaAntesDoBoss = false;

  /**
   * Move e recorta a folha conforme o progresso da abertura, mantendo a moldura no lugar.
   */
  const atualizarVisual = () => {
    if (!animada) {
      tiles.forEach((tile, index) => { tile.alpha = porta.estado === "aberta" ? 0 : originalAlphas[index]; });
      return;
    }
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
    !encerrada && !porta.bloqueadaPorBoss && !scene.cenaEntradaBossAtiva &&
    porta.estado === "fechada" && scene.player?.active &&
    !scene.morteEmAndamento && !scene.generatorMenuOpen && !scene.devItemMenuOpen &&
    distanceToInteractionArea(scene.player.x, scene.player.y, alvo) <=
      INTERACTION_RANGE;

  /** As duas portas iniciais usam energia; o leitor da arena também exige o crachá. */
  const motivoBloqueio = () => {
    if (porta.bloqueadaPorBoss) return "COMBATE EM ANDAMENTO";
    if (area.name === "porta05" && scene.novoBoss?.morto !== true) return "DERROTE O BOSS PARA ABRIR";
    const exigeCartao = PORTAS_COM_ACESSO.has(area.name);
    if (!exigeCartao && !PORTAS_COM_ENERGIA.has(area.name)) return null;
    const requisitos = [];
    if (scene.luzFabricaAcesa !== true) requisitos.push("SEM ENERGIA");
    if (exigeCartao && !(scene.inventory?.getQuantity("card") > 0)) requisitos.push("REQUER CARTÃO DE ACESSO");
    return requisitos.length ? requisitos.join(" | ") : null;
  };

  const concluirAbertura = () => {
    porta.progresso = 1;
    porta.estado = "aberta";
    atualizarVisual();
    // Remover o corpo do grupo também atualiza o índice de navegação dos robôs.
    porta.colisao?.destroy();
    porta.colisao = null;
    scene.game.registry.set(stateKey, true);
  };

  // O host transmite também o progresso das persianas e seu bloqueio temporário.
  porta.aplicarEstadoRede = estado => {
    if (estado.estado === "abrindo" && porta.estado !== "abrindo" && !scene.coopAudio) som.tocar(estado.progresso);
    else if (estado.estado === "fechada" || estado.estado === "fechando") som.parar();
    porta.estado = estado.estado;
    porta.progresso = estado.progresso;
    porta.bloqueadaPorBoss = !!estado.bloqueadaPorBoss;
    if (porta.estado === "aberta") { porta.colisao?.destroy(); porta.colisao = null; }
    else if (!porta.colisao) porta.colisao = criarColisao();
    atualizarVisual();
  };

  /** Abre diretamente ou conclui a persiana antes de remover a colisão. */
  const abrir = (alvo = area) => {
    if (!podeInteragir(alvo)) return false;
    const bloqueio = motivoBloqueio();
    if (bloqueio) {
      if (PORTAS_COM_ENERGIA.has(area.name) && scene.luzFabricaAcesa !== true) {
        fala.mostrar(FALAS_SEM_ENERGIA);
        return false;
      }
      prompt?.setText(bloqueio);
      return false;
    }
    fala.ocultar();
    porta.estado = "abrindo";
    scene.interacaoMundoProxima = null;
    prompt?.setVisible(false);
    marcador?.setVisible(false);
    som.tocar();
    if (!animada) {
      concluirAbertura();
      return true;
    }
    tween = scene.tweens.add({
      targets: porta,
      progresso: 1,
      delay: SINCRONIA_PORTA_FABRICA.atraso,
      duration: SINCRONIA_PORTA_FABRICA.movimento,
      ease: "Linear",
      onUpdate: atualizarVisual,
      onComplete: concluirAbertura,
    });
    return true;
  };

  // O fechamento do encontro é temporário: preserva a abertura salva pelo leitor.
  porta.fecharParaBoss = () => {
    if (encerrada || porta.bloqueadaPorBoss) return false;
    abertaAntesDoBoss = porta.estado !== "fechada";
    porta.bloqueadaPorBoss = true;
    prompt?.setVisible(false);
    marcador?.setVisible(false);
    tween?.stop();
    som.parar();
    if (porta.estado === "fechada") return true;
    porta.estado = "fechando";
    const concluir = () => {
      porta.progresso = 0;
      porta.estado = "fechada";
      porta.colisao ??= criarColisao();
      atualizarVisual();
    };
    if (!animada) concluir();
    else tween = scene.tweens.add({ targets: porta, progresso: 0,
      duration: CLOSE_DURATION, ease: "Sine.easeInOut",
      onUpdate: atualizarVisual, onComplete: concluir });
    return true;
  };
  porta.liberarAposBoss = () => {
    if (encerrada || !porta.bloqueadaPorBoss ||
        (scene.fabricaDescarregada && PORTAS_COM_ACESSO.has(area.name))) return false;
    tween?.stop();
    porta.bloqueadaPorBoss = false;
    porta.estado = abertaAntesDoBoss ? "aberta" : "fechada";
    porta.progresso = abertaAntesDoBoss ? 1 : 0;
    if (abertaAntesDoBoss) { porta.colisao?.destroy(); porta.colisao = null; }
    else porta.colisao ??= criarColisao();
    atualizarVisual();
    return true;
  };

  /**
   * Ajusta a profundidade sem mover a moldura que cobre a folha da porta.
   */
  const atualizar = () => {
    // A folha usa a mesma ordem pelos pés dos atores: cobre quem está atrás,
    // inclusive enquanto fecha na entrada do boss. A moldura aberta cobre a passagem.
    const playerDepth = scene.profundidadePersonagemParte2 ??
      scene.player?.depth ?? layer.depth;
    const doorDepth = porta.estado === "aberta"
      ? Math.max(layer.depth, playerDepth + 0.01)
      : Math.max(layer.depth, calcularDepthAtor(scene, area.y + area.height));
    visual?.setDepth(doorDepth);
    header?.setDepth(doorDepth);
    prompt?.setText(motivoBloqueio() ?? "E - ABRIR PORTA");
    marcador?.setVisible(porta.estado === "fechada" && !porta.bloqueadaPorBoss &&
      !scene.cenaEntradaBossAtiva && !scene.morteEmAndamento &&
      !scene.generatorMenuOpen && !scene.devItemMenuOpen);
  };

  const limpar = () => {
    if (encerrada) return;
    encerrada = true;
    porta.bloqueadaPorBoss = false;
    tween?.stop();
    som.destruir();
    porta.colisao?.destroy();
    visual?.destroy();
    header?.destroy();
    prompt?.destroy();
    if (marcador) { scene.tweens.killTweensOf(marcador); marcador.destroy(); }
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
  if (!areas.length) return;
  const fala = criarFalaFlutuante(scene);
  for (const area of areas) {
    const controle = criarPorta(scene, layer, area, fala);
    if (controle) portas.push(controle);
  }
  if (!portas.length) { fala.destroy(); return; }
  scene.portasFabrica = portas.map(({ porta }) => porta);
  // Preserva a referência usada pela primeira porta e por integrações existentes.
  scene.portaFabrica = scene.portasFabrica.find(porta => porta.nome === "porta01") ?? null;
  const portasLeitor = portas.filter(controle => PORTAS_COM_ACESSO.has(controle.porta.nome));
  const areaLeitor = localizarLeitorCartao(scene.map);
  const marcadorLeitor = areaLeitor && portasLeitor.length
    ? criarMarcadorPorta(scene, areaLeitor, "card-reader-marker") : null;
  const leitorProximo = (comPainel = false) => !!marcadorLeitor && scene.player?.active &&
    !scene.cenaEntradaBossAtiva &&
    !scene.morteEmAndamento && (!scene.generatorMenuOpen || (comPainel && scene.cardReaderMenuOpen)) &&
    !scene.devItemMenuOpen &&
    distanceToInteractionArea(scene.player.x, scene.player.y, areaLeitor) <= INTERACTION_RANGE;
  const terminal = marcadorLeitor ? criarInteracaoLeitorCartao(scene, {
    podeUsar: comPainel => leitorProximo(comPainel) &&
      portasLeitor.some(controle => controle.porta.estado === "fechada") &&
      portasLeitor.every(controle => !controle.porta.bloqueadaPorBoss && !controle.motivoBloqueio()),
    abrirPortas: () => {
      for (const controle of portasLeitor) controle.abrir(areaLeitor);
    },
  }) : null;
  scene.leitorCartaoFabrica = marcadorLeitor ? { area: areaLeitor, marcador: marcadorLeitor, terminal, fala } : null;
  const passarCartao = () => {
    if (!leitorProximo() || !portasLeitor.some(controle =>
      controle.porta.estado === "fechada" && !controle.porta.bloqueadaPorBoss)) return false;
    if (!(scene.inventory?.getQuantity("card") > 0)) {
      fala.mostrar(FALAS_SEM_CARTAO); return true;
    }
    fala.ocultar();
    return terminal.open();
  };
  const atualizar = () => {
    fala?.atualizar();
    if (terminal?.aberto) {
      for (const controle of portas) { controle.atualizar(); controle.prompt?.setVisible(false); }
      marcadorLeitor.setVisible(false);
      scene.interacaoMundoProxima = null;
      return;
    }
    let proxima = null;
    let distancia = Infinity;
    for (const controle of portas) {
      controle.atualizar();
      if (PORTAS_COM_ACESSO.has(controle.porta.nome) || !controle.podeInteragir()) continue;
      const area = controle.porta.area;
      const atual = distanceToInteractionArea(scene.player.x, scene.player.y, area);
      if (atual < distancia) { proxima = controle; distancia = atual; }
    }
    for (const controle of portas) controle.prompt?.setVisible(controle === proxima);
    scene.interacaoMundoProxima = proxima ? { distance: distancia, interact: proxima.abrir } : null;
    if (marcadorLeitor) {
      const perto = leitorProximo();
      const fechadas = portasLeitor.filter(controle => controle.porta.estado === "fechada" && !controle.porta.bloqueadaPorBoss);
      marcadorLeitor.setVisible(fechadas.length > 0 && !scene.morteEmAndamento &&
        !scene.generatorMenuOpen && !scene.devItemMenuOpen && !scene.cenaEntradaBossAtiva);
      const distanciaLeitor = perto ? distanceToInteractionArea(scene.player.x, scene.player.y, areaLeitor) : Infinity;
      if (fechadas.length && distanciaLeitor < distancia) {
        scene.interacaoMundoProxima = { distance: distanciaLeitor, interact: passarCartao };
        proxima?.prompt?.setVisible(false);
      }
    }
  };
  scene.descarregarPortasFabrica = limiteY => {
    for (let i = portas.length - 1; i >= 0; i--) {
      if (portas[i].porta.area.y <= limiteY) continue;
      portas[i].limpar();
      portas.splice(i, 1);
    }
    scene.portasFabrica = portas.map(controle => controle.porta);
    scene.portaFabrica = null;
  };
  scene.atualizarInteracaoPortaFabrica = atualizar;
  scene.events.on(Phaser.Scenes.Events.PRE_RENDER, atualizar);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    scene.events.off(Phaser.Scenes.Events.PRE_RENDER, atualizar);
    terminal?.destroy();
    portas.forEach(controle => controle.limpar());
    fala?.destroy();
    if (marcadorLeitor) scene.tweens.killTweensOf(marcadorLeitor);
    marcadorLeitor?.destroy();
    scene.leitorCartaoFabrica = null;
    scene.portasFabrica = [];
    scene.portaFabrica = null;
    scene.interacaoMundoProxima = null;
    scene.atualizarInteracaoPortaFabrica = null;
    scene.descarregarPortasFabrica = null;
  });
  atualizar();
}

export { FACTORY_DOOR_STATE_KEY, chaveEstadoPorta, criarInteracaoPortaFabrica };
