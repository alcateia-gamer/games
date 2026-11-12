/** Portais sem vida ou hitbox. A seleção e o spawn compartilham a mesma validação. */
import { calcularDepthAtor } from "../../map/ProfundidadeMapa.js";
import { retanguloLivreDoMapa } from "../EnemyPathfinding.js";
import { areasSobrepostasNovoBoss } from "./NovoBossTeleporte.js";
import { entidadesFisicasArena } from "./NovoBossColisoesTorres.js";
import { assetsNovoBoss } from "./NovoBossAssets.js";
import { EMERGENCIA_ROBO_BOLA } from "../RoboBolaEmergencia.js";

export function candidatosPortaisNovoBoss(arena) {
  const largura = arena.xMax - arena.xMin, altura = arena.yMax - arena.yMin;
  // Três alturas por lateral; nenhum candidato central ou acima/abaixo do boss.
  return [[0.15, 0.33], [0.85, 0.33], [0.15, 0.50], [0.85, 0.50],
    [0.15, 0.67], [0.85, 0.67]].map(([fx, fy]) => ({
    x: arena.xMin + largura * fx, y: arena.yMin + altura * fy,
  }));
}

export function lateralPortalNovoBoss(arena, ponto) {
  const fracao = (ponto.x - arena.xMin) / (arena.xMax - arena.xMin);
  return fracao <= 0.25 ? "esquerda" : fracao >= 0.75 ? "direita" : null;
}

export function pontoSeguroPortal(scene, encontro, ponto, margem = 48) {
  const a = encontro.config.arena;
  if (!lateralPortalNovoBoss(a, ponto)) return false;
  const area = { x: ponto.x - margem, y: ponto.y - margem, width: margem * 2, height: margem * 2 };
  if (area.x < a.xMin || area.y < a.yMin || area.x + area.width > a.xMax ||
      area.y + area.height > a.yMax || !retanguloLivreDoMapa(scene, area)) return false;
  const sentido = lateralPortalNovoBoss(a, ponto) === "esquerda" ? 1 : -1;
  const distancia = EMERGENCIA_ROBO_BOLA.distancia;
  const saida = { x: ponto.x + Math.min(0, sentido * distancia) - 18,
    y: ponto.y - 18, width: distancia + 36, height: 36 };
  if (!retanguloLivreDoMapa(scene, saida)) return false;
  if (Math.hypot(ponto.x - scene.player.x, ponto.y - scene.player.y) <
      encontro.config.prologo.distanciaJogador) return false;
  if (Math.hypot(ponto.x - encontro.x, ponto.y - encontro.y) <
      (encontro.config.geradores.raioBarreira ?? 95) + margem + 25) return false;
  if (encontro.geradores.some(g => Math.hypot(g.x - ponto.x, g.y - ponto.y) < 110)) return false;
  if (entidadesFisicasArena(scene).some(e => e?.active && !e.morto && e.body &&
      e.body.enable !== false && areasSobrepostasNovoBoss(area, e.body))) return false;
  // Folga de navegação: não aceita um bolsão livre sem saída para o Robô Bola.
  let saidas = 0;
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    if (retanguloLivreDoMapa(scene, { x: ponto.x + dx * 64 - 20,
      y: ponto.y + dy * 64 - 20, width: 40, height: 40 })) saidas++;
  }
  return saidas >= 3;
}

export function escolherParPortais(scene, encontro, anterior = []) {
  const candidatos = candidatosPortaisNovoBoss(encontro.config.arena);
  const a = encontro.config.arena;
  // Fallback ordenado, validado com as mesmas regras; nunca relaxa a segurança.
  const fallback = [];
  for (let y = a.yMin + 100; y < a.yMax - 100; y += 64) {
    for (const fracao of [0.15, 0.85, 0.10, 0.90, 0.20, 0.80]) {
      fallback.push({ x: a.xMin + (a.xMax - a.xMin) * fracao, y });
    }
  }
  function selecionar(pontos) {
    const livres = pontos.filter(p => pontoSeguroPortal(scene, encontro, p));
    let repetido = null;
    for (let i = 0; i < livres.length; i++) for (let j = i + 1; j < livres.length; j++) {
      const par = [livres[i], livres[j]];
      if (lateralPortalNovoBoss(a, par[0]) === lateralPortalNovoBoss(a, par[1])) continue;
      if (Math.hypot(par[0].x - par[1].x, par[0].y - par[1].y) <
          encontro.config.prologo.distanciaPortais) continue;
      if (anterior.length === 2 && par.every(p => anterior.some(q => p.x === q.x && p.y === q.y))) {
        repetido = par;
      } else return { par, repetido };
    }
    return { par: null, repetido };
  }
  const inicial = selecionar(candidatos);
  if (inicial.par) return inicial.par;
  const reserva = selecionar([...candidatos, ...fallback]);
  return reserva.par ?? inicial.repetido ?? reserva.repetido;
}

export function criarPortaisNovoBoss(scene, pontos) {
  const asset = assetsNovoBoss.portal;
  if (!scene.textures?.exists(asset.chave)) throw new Error("Spritesheet do portal não carregada");
  const portais = pontos.map((ponto, indice) => {
    const flip = ponto.x === Math.min(...pontos.map(p => p.x));
    return { ...ponto, indice,
      sprite: scene.add.sprite(ponto.x, ponto.y, asset.chave, 0)
        // O espelhamento também inverte o pivô: ambos os lados nascem na abertura.
        .setOrigin(flip ? 1 - asset.origemX : asset.origemX, asset.origemY)
        .setScale(asset.escala).setFlipX(flip)
        // O robô precisa aparecer desde o centro, sem ficar oculto atrás da imagem do portal.
        .setDepth(calcularDepthAtor(scene, ponto.y) - 0.01)
        .setVisible(false).setName(`novo-boss-portal-${indice + 1}`),
    };
  });
  let tempo = 0, fechadoEm = null, destruido = false;
  return {
    pontos: portais,
    fechar() { fechadoEm ??= tempo; },
    atualizar(delta, aberturaMs, fechamentoMs) {
      if (destruido) return;
      tempo += delta;
      const tamanho = fechadoEm === null ? Math.min(1, tempo / Math.max(1, aberturaMs))
        : Math.max(0, 1 - (tempo - fechadoEm) / Math.max(1, fechamentoMs));
      let ms = tempo % asset.duracoesMs.reduce((soma, duracao) => soma + duracao, 0);
      let quadro = 0;
      while (quadro < asset.ultimoFrame && ms >= asset.duracoesMs[quadro]) ms -= asset.duracoesMs[quadro++];
      for (const { sprite } of portais) {
        sprite.setVisible(tamanho > 0).setFrame(quadro).setAlpha(tamanho)
          .setScale(asset.escala * tamanho);
      }
    },
    destruir() {
      if (destruido) return;
      destruido = true;
      portais.forEach(p => p.sprite.destroy());
    },
  };
}
