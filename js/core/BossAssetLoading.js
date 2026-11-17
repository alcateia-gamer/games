/** Preparação solo, por visita à fábrica. A fila e os caches continuam sendo do Phaser. */
import { assetsBossProntos, enfileirarAssetsBoss } from "./FactoryAssetPack.js";
import { novoBossConfig, configurarZonasNovoBoss, jogadorNaArenaNovoBoss } from "../enemies/novoBoss/NovoBossConfig.js";
import { distanceToInteractionArea } from "../interactions/FactoryGenerator.js";

const DISTANCIA_PREPARACAO = 640;
const portasArena = porta => porta.nome === "porta02" || porta.nome === "porta03";

/** Saves, retorno e DEV podem iniciar sem passar pelo leitor de cartão. */
export function bossNecessarioNaEntrada(scene) {
  if (scene.multiplayer) return true;
  const registry = scene.game?.registry;
  if (["porta02", "porta03"].some(nome => registry?.get(`factoryDoorOpen:${nome}`) === true)) return true;
  const mapa = scene.cache?.tilemap?.get("mapaParte2")?.data;
  const config = configurarZonasNovoBoss({ getObjectLayer: nome => mapa?.layers?.find(l => l.name === nome) },
    scene.novoBossConfig ?? novoBossConfig);
  const x = scene.respawnX ?? -1093, y = scene.respawnY ?? -5905;
  const arena = config.arena;
  if (jogadorNaArenaNovoBoss({ active: true, x, y }, arena)) return true;
  if (!scene.developerMode) return false;
  if (Array.isArray(arena.zonas)) return arena.zonas.some(zona => {
    const dx = x - zona.x, dy = y - zona.y;
    return distanceToInteractionArea(dx * zona.cos + dy * zona.sin, -dx * zona.sin + dy * zona.cos,
      { x: 0, y: 0, width: zona.width, height: zona.height }) <= DISTANCIA_PREPARACAO;
  });
  return distanceToInteractionArea(x, y, { x: arena.xMin, y: arena.yMin,
    width: arena.xMax - arena.xMin, height: arena.yMax - arena.yMin }) <= DISTANCIA_PREPARACAO;
}

export function criarPreparacaoBoss(scene) {
  if (scene.multiplayer) return null;
  let estado = assetsBossProntos(scene) ? "pronto" : "ocioso";
  let encerrado = false, espera = null, textos = null;
  let paraleloAnterior = null;
  const loader = scene.load;

  function atualizarAviso() {
    if (!espera) return;
    if (!textos) {
      const estilo = { fontFamily: "monospace", fontSize: "18px", color: "#ffffff",
        backgroundColor: "#182026", padding: { x: 14, y: 10 }, align: "center" };
      textos = ["", "TENTAR NOVAMENTE", "VOLTAR"].map(texto => scene.add.text(0, 0, texto, estilo)
        .setOrigin(0.5).setScrollFactor(0).setDepth(100000));
      textos[1].setInteractive({ useHandCursor: true }).on("pointerdown", () => iniciar(true));
      textos[2].setInteractive({ useHandCursor: true }).on("pointerdown", () => {
        if (espera?.cancelavel !== false) concluirEspera(false);
      });
    }
    const camera = scene.cameras.main;
    const zoomX = camera.zoomX || camera.zoom || 1, zoomY = camera.zoomY || camera.zoom || 1;
    const cx = camera.width * camera.originX, cy = camera.height * camera.originY;
    textos.forEach((texto, i) => texto.setPosition(cx + (camera.width / 2 - cx) / zoomX,
      cy + (camera.height / 2 + i * 55 - cy) / zoomY).setScale(1 / zoomX, 1 / zoomY)
      .setVisible(i === 0 || estado === "falhou" && (i === 1 || espera.cancelavel !== false)));
    textos[0].setText(estado === "falhou" ? "Falha ao carregar.\nVerifique a conexão." : "Carregando...");
  }

  function concluirEspera(continuar) {
    const pendente = espera;
    if (!pendente) return;
    espera = null;
    if (!scene.morteEmAndamento && (scene.vida ?? 1) > 0)
      scene.movimentoBloqueado = pendente.movimento;
    scene.generatorMenuOpen = pendente.menu;
    textos?.forEach(texto => texto.setVisible(false));
    if (continuar && !encerrado && scene.player?.active && !scene.player.morto &&
        !scene.morteEmAndamento && (scene.vida ?? 1) > 0)
      pendente.continuar();
    else pendente.cancelar?.();
  }

  function tentarContinuar() {
    if (espera && controle.pronto && (!espera.podeContinuar || espera.podeContinuar())) concluirEspera(true);
  }

  function removerListeners() {
    loader.off("complete", carregar);
    loader.off("complete", terminar);
    if (paraleloAnterior !== null) {
      loader.maxParallelDownloads = paraleloAnterior;
      paraleloAnterior = null;
    }
  }

  function terminar() {
    removerListeners();
    if (encerrado) return;
    estado = assetsBossProntos(scene) ? "pronto" : "falhou";
    tentarContinuar();
    atualizarAviso();
  }

  function carregar() {
    if (encerrado) return;
    paraleloAnterior = loader.maxParallelDownloads;
    loader.maxParallelDownloads = 1;
    try {
      enfileirarAssetsBoss(scene);
      if (assetsBossProntos(scene)) { terminar(); return; }
      loader.once("complete", terminar);
      loader.start();
    } catch {
      removerListeners();
      estado = "falhou";
      atualizarAviso();
    }
  }

  function iniciar(tentarNovamente = false) {
    if (encerrado || estado === "pronto" || estado === "carregando" || estado === "falhou" && !tentarNovamente) return;
    estado = "carregando";
    atualizarAviso();
    if (loader.isLoading()) {
      loader.once("complete", carregar);
    } else carregar();
  }

  const controle = {
    get pronto() { return estado === "pronto"; },
    get aguardando() { return espera !== null; },
    get estado() { return estado; },
    iniciar,
    aguardar(continuar, { podeContinuar = null, cancelar = null, cancelavel = true } = {}) {
      if (encerrado) return;
      if (controle.pronto && (!podeContinuar || podeContinuar())) { continuar(); return; }
      if (espera) return;
      espera = { continuar, podeContinuar, cancelar, cancelavel,
        movimento: scene.movimentoBloqueado, menu: scene.generatorMenuOpen };
      scene.movimentoBloqueado = true;
      scene.generatorMenuOpen = true;
      scene.player?.setVelocity(0, 0);
      iniciar();
      atualizarAviso();
    },
    atualizar() {
      if (scene.morteEmAndamento || (scene.vida ?? 1) <= 0) { concluirEspera(false); return; }
      if (espera) { tentarContinuar(); atualizarAviso(); }
      if (estado !== "ocioso" || !scene.player?.active || !(scene.inventory?.getQuantity("card") > 0)) return;
      const perto = area => distanceToInteractionArea(scene.player.x, scene.player.y, area) <= DISTANCIA_PREPARACAO;
      if ((scene.portasFabrica ?? []).some(porta => portasArena(porta) && perto(porta.area)) ||
          scene.leitorCartaoFabrica?.area && perto(scene.leitorCartaoFabrica.area)) iniciar();
    },
  };
  const destruir = () => {
    encerrado = true;
    removerListeners();
    concluirEspera(false);
    textos?.forEach(texto => texto.destroy());
    textos = null;
    scene.events.off("shutdown", destruir);
    scene.events.off("destroy", destruir);
    if (scene.preparacaoBoss === controle) scene.preparacaoBoss = null;
  };
  scene.events.once("shutdown", destruir);
  scene.events.once("destroy", destruir);
  scene.preparacaoBoss = controle;
  return controle;
}
