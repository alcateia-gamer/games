/** Colisões e dano do encontro, preservando as defesas dos personagens. */
import { causarDanoPlayer } from "../EnemyLaser.js";
import { causarDanoInimigo } from "../EnemyHealth.js";
import { retanguloLivreDoMapa } from "../EnemyPathfinding.js";
import { obstaculosFlecha, tempoImpactoFlecha } from "../../player/ArrowCollision.js";
import { applyKnockback } from "../../combat/CombatEffects.js";
import { alvosAdicionaisCombate, causarDanoAlvoAdicional } from "../../combat/CombatTargets.js";
import { capturarJogadorNovoBoss, liberarJogadorNovoBoss } from "../../player/PlayerControlEffects.js";
import { criarAvisoNovoBoss } from "./NovoBossAvisos.js";
import { configurarCorpoDisparoEnergia } from "./NovoBossDisparoEnergia.js";

function direcao(inicio, fim) {
  const mag = Math.hypot(fim.x - inicio.x, fim.y - inicio.y) || 1;
  return { x: (fim.x - inicio.x) / mag, y: (fim.y - inicio.y) / mag };
}

export function criarServicosAtaques(scene, encontro) {
  const areaPlayer = () => scene.hitboxDanoPlayer ?? scene.player?.body;
  const jogadorValido = () => scene.player?.active && !scene.morteEmAndamento &&
    !encontro.morto && !encontro.suspenso && encontro.jogadorNaArena && !scene.multiplayer;
  const danoJogador = (quantidade, origem, opcoes = {}) => {
    if (!jogadorValido() || !Number.isFinite(quantidade) || quantidade <= 0) return false;
    const antes = scene.vida;
    const invulneravelAntes = scene.player.invulneravel;
    causarDanoPlayer(scene, quantidade, origem);
    const aceito = scene.vida < antes || (scene.developerMode && !invulneravelAntes && scene.player.invulneravel);
    if (aceito && opcoes.empurrao > 0 && !scene.morteEmAndamento) {
      applyKnockback(scene, origem, scene.player, opcoes.empurrao, opcoes.duracaoEmpurrao);
    }
    return Boolean(aceito);
  };
  return {
    rng: () => (encontro.rng ?? Math.random)(),
    criarAviso: (x, y, raio) => criarAvisoNovoBoss(scene, x, y, raio),
    jogadorAtingeCirculo(x, y, raio) {
      const area = areaPlayer();
      if (!jogadorValido() || !area) return false;
      const px = Math.max(area.x, Math.min(x, area.x + area.width));
      const py = Math.max(area.y, Math.min(y, area.y + area.height));
      return (px - x) ** 2 + (py - y) ** 2 <= raio ** 2;
    },
    pontoLivre(x, y, raio) {
      const arena = encontro.config.arena;
      const area = { x: x - raio, y: y - raio, width: raio * 2, height: raio * 2 };
      return area.x >= arena.xMin && area.y >= arena.yMin &&
        area.x + area.width <= arena.xMax && area.y + area.height <= arena.yMax &&
        retanguloLivreDoMapa(scene, area) && !(encontro.obstaculosTeleporte ?? []).some(obj => {
          const b = obj.body ?? obj;
          return b.enable !== false && area.x < b.x + b.width && area.x + area.width > b.x &&
            area.y < b.y + b.height && area.y + area.height > b.y;
        });
    },
    segmentoBloqueado(inicio, fim, raio = 6) {
      const vetor = direcao(inicio, fim);
      return obstaculosFlecha(scene, inicio, fim, raio).some(area =>
        tempoImpactoFlecha(inicio, fim, vetor, area, raio, raio) !== null);
    },
    danoJogador,
    criarExplosaoPulso(origem, raio, idade, delta) {
      const inicio = encontro.relogioCombate + delta - idade;
      return encontro.apresentacao?.criarExplosaoPulso(origem, raio, inicio);
    },
    capturarJogador: (fonte, duracao, ponto, opcoes) => jogadorValido() && capturarJogadorNovoBoss(scene, fonte, duracao, ponto, opcoes),
    capturaAtiva: fonte => scene.restricaoControleNovoBoss?.fonte === fonte,
    liberarJogador: fonte => liberarJogadorNovoBoss(scene, fonte),
    registrarLaser(visual) {
      visual.setName("novo-boss-laser").setDepth(53);
      scene.physics.add.existing(visual);
      configurarCorpoDisparoEnergia(visual);
      visual.body.setAllowGravity(false);
      visual.body.moves = false;
      visual.especialRefletido = false;
      encontro.projeteisBoss.push(visual);
    },
    desregistrarLaser(visual) {
      const indice = encontro.projeteisBoss.indexOf(visual);
      if (indice >= 0) encontro.projeteisBoss.splice(indice, 1);
    },
    atingirJogadorComLaser(inicio, fim, raio, dano, origem, visual) {
      if (!jogadorValido()) return false;
      visual?.setPosition?.(fim.x, fim.y);
      visual?.body?.updateFromGameObject?.();
      if (visual?.especialLaserInimigo && scene.tentarInterceptarLaserEspecial?.(visual)) return false;
      if (visual?.especialLaserInimigo && scene.acertarHologramaEspecial?.(visual)) return true;
      const area = areaPlayer();
      if (!area || tempoImpactoFlecha(inicio, fim, direcao(inicio, fim), area, raio, raio) === null) return false;
      danoJogador(dano, origem);
      return true;
    },
    atingirAlvoComLaserRefletido(inicio, fim, raio, dano) {
      const vetor = direcao(inicio, fim);
      let impacto = null;
      for (const alvo of [...alvosAdicionaisCombate(scene), ...(scene.inimigos ?? [])]) {
        if (!alvo?.active || alvo.morto || !alvo.hitboxDano) continue;
        const tempo = tempoImpactoFlecha(inicio, fim, vetor, alvo.hitboxDano, raio, raio);
        if (tempo !== null && (!impacto || tempo < impacto.tempo)) impacto = { alvo, tempo };
      }
      if (!impacto) return false;
      if (alvosAdicionaisCombate(scene).includes(impacto.alvo)) causarDanoAlvoAdicional(scene, impacto.alvo, dano);
      else causarDanoInimigo(scene, impacto.alvo, dano, { playSound: true });
      return true;
    },
  };
}
