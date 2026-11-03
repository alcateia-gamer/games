/** Geradores exclusivos do encontro. Não alteram a energia ou o inventário da fábrica. */
import { retanguloLivreDoMapa } from "../EnemyPathfinding.js";
import { areasSobrepostasNovoBoss } from "./NovoBossTeleporte.js";
import { areaCorpoNovoBoss } from "./NovoBossConfig.js";
import { jogadorPresoNovoBoss } from "../../player/PlayerControlEffects.js";
import { criarEscudoEnergia } from "./NovoBossEfeitosEnergia.js";

function configuracaoValida(scene, encontro, config) {
  if (!Array.isArray(config.pontos) || config.pontos.length === 0 ||
      !Number.isFinite(config.tamanho) || config.tamanho <= 0) return false;
  const arena = encontro.config.arena;
  const areas = config.pontos.map(ponto => ({
    x: ponto.x - config.tamanho / 2,
    y: ponto.y - config.tamanho / 2,
    width: config.tamanho, height: config.tamanho,
  }));
  const destinos = encontro.config.teleporte.pontos.map(ponto =>
    areaCorpoNovoBoss(encontro.config, ponto));
  return areas.every((area, indice) =>
    Object.values(area).every(Number.isFinite) &&
    area.x >= arena.xMin && area.y >= arena.yMin &&
    area.x + area.width <= arena.xMax && area.y + area.height <= arena.yMax &&
    retanguloLivreDoMapa(scene, area) &&
    !areas.some((outra, outroIndice) => outroIndice !== indice &&
      areasSobrepostasNovoBoss(area, outra)) &&
    !destinos.some(destino => areasSobrepostasNovoBoss(area, destino)));
}

function encontroVisivel(scene, encontro) {
  return !scene.multiplayer && !encontro.encerrado && !encontro.morto &&
    !encontro.suspenso && encontro.jogadorNaArena && Boolean(scene.player?.active) &&
    !scene.player.morto && !scene.morteEmAndamento && (scene.vida ?? 1) > 0;
}

function podeInteragir(scene, encontro) {
  return encontroVisivel(scene, encontro) && !scene.movimentoBloqueado &&
    !scene.generatorMenuOpen && !jogadorPresoNovoBoss(scene);
}

function centroJogador(player) {
  const centro = player?.body?.center;
  if (Number.isFinite(centro?.x) && Number.isFinite(centro?.y)) return centro;
  return player;
}

/**
 * Retorna false enquanto os pontos ainda estiverem bloqueados ou inválidos.
 * O controlador só começa o combate quando a arena inteira está preparada.
 */
export function prepararGeradoresNovoBoss(scene, encontro) {
  if (encontro.sistemaGeradores) return encontro.sistemaGeradores;
  const config = encontro.config.geradores;
  if (!config?.ativo || scene.multiplayer) {
    encontro.geradores = [];
    encontro.barreiraAtiva = false;
    return null;
  }
  if (!configuracaoValida(scene, encontro, config)) {
    encontro.pendencia = "posicoes-geradores-bloqueadas";
    return false;
  }

  let destruido = false;
  let tempo = 0;
  const colliders = [];
  const propiosObstaculos = [];
  encontro.obstaculosTeleporte ??= [];
  const barreira = scene.add.graphics().setDepth(52).setName("novo-boss-barreira");
  const escudo = criarEscudoEnergia(scene, config.raioBarreira ?? 95);
  // Corpo exclusivo do escudo: não entra nos obstáculos que validam o próprio boss.
  const raioBarreira = config.raioBarreira ?? 95;
  const colisaoBarreira = scene.add.circle(encontro.sprite.x, encontro.sprite.y + 16,
    raioBarreira, 0, 0).setVisible(false).setName("novo-boss-barreira-colisao");
  scene.physics.add.existing(colisaoBarreira, true);
  colisaoBarreira.body.setCircle(raioBarreira);
  colliders.push(scene.physics.add.collider(scene.player, colisaoBarreira));
  const geradores = config.pontos.map((ponto, indice) => {
    const visual = scene.add.rectangle(ponto.x, ponto.y, config.tamanho,
      config.tamanho, 0x122b36, 1)
      .setStrokeStyle(3, 0x5ce4ff, 1).setDepth(51)
      .setName(`novo-boss-gerador-${ponto.id ?? indice}`);
    scene.physics.add.existing(visual, true);
    visual.body.setSize(config.tamanho, config.tamanho);
    visual.body.updateFromGameObject?.();
    const nucleo = scene.add.circle(ponto.x, ponto.y, config.tamanho * 0.22,
      0x5ce4ff, 1).setDepth(52).setName("novo-boss-gerador-nucleo");
    const label = scene.add.text(ponto.x, ponto.y + config.tamanho / 2 + 10,
      "[E / TOQUE] DESATIVAR", {
        color: "#d9faff", backgroundColor: "#071b29",
        fontFamily: "monospace", fontSize: "14px", padding: { x: 7, y: 6 },
      }).setOrigin(0.5, 0).setDepth(54)
      .setName(`novo-boss-gerador-prompt-${ponto.id ?? indice}`)
      .setInteractive({ useHandCursor: true });
    const gerador = {
      id: ponto.id ?? `gerador-${indice + 1}`, x: ponto.x, y: ponto.y,
      ligado: true, visual, nucleo, label, body: visual.body,
    };
    label.on("pointerdown", (_pointer, _x, _y, evento) => {
      if (interagir(gerador.id)) evento?.stopPropagation();
    });
    colliders.push(scene.physics.add.collider(scene.player, visual));
    propiosObstaculos.push(visual);
    encontro.obstaculosTeleporte.push(visual);
    return gerador;
  });
  encontro.geradores = geradores;
  encontro.barreiraAtiva = true;

  function proximo() {
    if (!podeInteragir(scene, encontro)) return null;
    const jogador = centroJogador(scene.player);
    let escolhido = null;
    let distanciaMaisCurta = config.distanciaInteracao ?? 72;
    for (const gerador of geradores) {
      if (!gerador.ligado) continue;
      const distancia = Math.hypot(jogador.x - gerador.x, jogador.y - gerador.y);
      if (distancia <= distanciaMaisCurta) {
        escolhido = gerador;
        distanciaMaisCurta = distancia;
      }
    }
    return escolhido;
  }

  function interagir(id = null) {
    if (destruido) return false;
    const gerador = proximo();
    if (!gerador || (id !== null && id !== gerador.id)) return false;
    gerador.ligado = false;
    gerador.visual.setFillStyle(0x17222b, 1).setStrokeStyle(2, 0x53616d, 0.85);
    gerador.nucleo.setFillStyle(0x55606b, 0.6);
    encontro.barreiraAtiva = geradores.some(item => item.ligado);
    scene.events.emit("novo-boss:gerador-desativado", { encontro, gerador });
    if (!encontro.barreiraAtiva) scene.events.emit("novo-boss:barreira-desativada", { encontro });
    atualizar(0);
    return true;
  }

  function atualizar(delta = 0) {
    if (destruido) return;
    tempo += Math.max(0, Number.isFinite(delta) ? delta : 0);
    const visivel = encontroVisivel(scene, encontro);
    const perto = proximo();
    for (const gerador of geradores) {
      gerador.visual.setVisible(visivel);
      gerador.nucleo.setVisible(visivel);
      gerador.body.enable = visivel;
      gerador.label.setVisible(visivel && gerador === perto);
      if (gerador.ligado) gerador.nucleo.setAlpha(0.72 + Math.sin(tempo / 220) * 0.22);
    }
    barreira.clear();
    barreira.setVisible(visivel && encontro.barreiraAtiva && Boolean(encontro.sprite?.visible) &&
      !encontro.teleporte && (encontro.sprite.alpha ?? 1) > 0);
    colisaoBarreira.x = encontro.sprite.x;
    colisaoBarreira.y = encontro.sprite.y + 16;
    colisaoBarreira.body.updateFromGameObject();
    colisaoBarreira.body.enable = barreira.visible;
    escudo?.atualizar(delta, encontro.sprite.x, encontro.sprite.y + 16,
      barreira.visible, encontro.sprite.alpha ?? 1);
    if (!barreira.visible) return;
    if (escudo) return;
    const x = encontro.sprite.x;
    const y = encontro.sprite.y + 16;
    const raio = (config.raioBarreira ?? 95) + Math.sin(tempo / 320) * 3;
    barreira.fillStyle(0x34cfe6, 0.05);
    barreira.fillCircle(x, y, raio);
    barreira.lineStyle(3, 0x5ce4ff, 0.7 + Math.sin(tempo / 210) * 0.18);
    barreira.strokeCircle(x, y, raio);
    barreira.lineStyle(1, 0xb0f6ff, 0.5);
    barreira.strokeCircle(x, y, raio - 7);
  }

  function destruir() {
    if (destruido) return;
    destruido = true;
    scene.input.keyboard?.off("keydown-E", teclaE);
    for (const collider of colliders) collider?.destroy();
    for (const gerador of geradores) {
      gerador.visual.destroy();
      gerador.nucleo.destroy();
      gerador.label.destroy();
    }
    barreira.destroy();
    colisaoBarreira.destroy();
    escudo?.destruir();
    for (let indice = encontro.obstaculosTeleporte.length - 1; indice >= 0; indice--) {
      if (propiosObstaculos.includes(encontro.obstaculosTeleporte[indice])) {
        encontro.obstaculosTeleporte.splice(indice, 1);
      }
    }
    encontro.geradores = [];
    encontro.barreiraAtiva = false;
    if (encontro.sistemaGeradores === sistema) encontro.sistemaGeradores = null;
  }

  const teclaE = evento => {
    if (!evento?.repeat) interagir();
  };
  const sistema = {
    atualizar, destruir, interagir,
    get corpoBarreira() { return colisaoBarreira.body; },
    snapshot: () => ({
      destruido, barreiraAtiva: encontro.barreiraAtiva,
      restantes: geradores.filter(item => item.ligado).length,
      proximo: proximo()?.id ?? null,
      geradores: geradores.map(({ id, x, y, ligado }) => ({ id, x, y, ligado })),
    }),
  };
  encontro.sistemaGeradores = sistema;
  scene.input.keyboard?.on("keydown-E", teclaE);
  encontro.pendencia = null;
  atualizar(0);
  return sistema;
}
