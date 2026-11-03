/** Pressão da fase 2 entre ataques; não desloca as aberturas nem os ataques centrais. */
import { destinoValidoNovoBoss, sincronizarCorpoNovoBoss } from "./NovoBossTeleporte.js";

const positivo = (valor, padrao) => Number.isFinite(valor) && valor > 0 ? valor : padrao;

function movimentoPermitido(scene, encontro, delta) {
  const config = encontro.config.fase2?.movimento;
  if (!config?.ativo || encontro.fase !== 2 || !Number.isFinite(delta) || delta <= 0 ||
      encontro.teleporte || encontro.teleportePendente || encontro.transicaoFase2Pendente ||
      encontro.morto || encontro.encerrado || encontro.suspenso || !encontro.sprite?.active ||
      !encontro.jogadorNaArena || scene.multiplayer || scene.morteEmAndamento || (scene.vida ?? 1) <= 0 ||
      !["preparando", "atacando"].includes(encontro.estado) ||
      ["pulsoRepulsao", "lasers"].includes(encontro.ataqueAtual?.tipo) ||
      encontro.sistemaIlusoes?.ativo) return false;
  return true;
}

function teleporteVencido(encontro) {
  const agora = encontro.relogioCombate;
  return encontro.estado === "preparando" && agora >=
    Math.max(encontro.inicioFase2Em ?? agora, encontro.ultimoTeleporteEm) +
    positivo(encontro.config.fase2.movimento.intervaloTeleporteMs, 6000);
}

/** Mesmas pausas, velocidade e fração de frame para a verdadeira e cada cópia. */
export function tempoMovimentoNovoBoss(scene, encontro, delta) {
  if (!movimentoPermitido(scene, encontro, delta) || teleporteVencido(encontro)) return 0;
  const agora = encontro.relogioCombate;
  // Não atribui à caminhada o tempo gasto na janela anterior ou na criação dos clones.
  let tempo = Math.min(delta, encontro.estado === "preparando"
    ? encontro.tempoEstado : (encontro.tempoAtaque ?? delta));
  if (encontro.sistemaClones?.ativo) {
    tempo = Math.min(tempo, Math.max(0, agora - (encontro.inicioOndaClonesEm ?? agora)));
  }
  return tempo;
}

export function moverCorpoEmPressaoNovoBoss(scene, encontro, entidade, tempo, desvioRumo = 0) {
  const config = encontro.config.fase2.movimento;
  const agora = encontro.relogioCombate;
  let restante = positivo(config.velocidade, 250) * tempo / 1000;
  let moveu = false;
  const distanciaPreferida = positivo(config.distanciaPreferida, 180);
  const sentido = Math.floor(agora / positivo(config.alternarRumoMs, 1200)) % 2 ? -1 : 1;
  while (restante > 0) {
    const dx = scene.player.x - entidade.sprite.x;
    const dy = scene.player.y - entidade.sprite.y;
    const distancia = Math.hypot(dx, dy);
    const radial = Math.max(-1, Math.min(1, (distancia - distanciaPreferida) / distanciaPreferida));
    // Aproxima de longe, flanqueia perto e recua se o jogador encostar.
    const rumo = Math.atan2(dy, dx) + Math.atan2(sentido * 0.8, radial) + desvioRumo;
    const passo = Math.min(8, restante);
    let aceito = false;
    for (const desvio of [0, sentido * Math.PI / 4, -sentido * Math.PI / 4,
      sentido * Math.PI / 2, -sentido * Math.PI / 2, Math.PI]) {
      const ponto = { x: entidade.sprite.x + Math.cos(rumo + desvio) * passo,
        y: entidade.sprite.y + Math.sin(rumo + desvio) * passo };
      // Corpo inteiro, paredes, bordas, jogador e geradores são reavaliados a cada <=8px.
      if (!destinoValidoNovoBoss(scene, encontro, ponto)) continue;
      sincronizarCorpoNovoBoss(entidade, ponto);
      moveu = aceito = true;
      break;
    }
    if (!aceito) break;
    restante -= passo;
  }
  return moveu;
}

export function atualizarMovimentoNovoBoss(scene, encontro, delta = 0) {
  if (!movimentoPermitido(scene, encontro, delta)) return false;
  if (teleporteVencido(encontro)) {
    encontro.teleportePendente = "pressao-fase2";
    encontro.proximaTentativaTeleporteEm = encontro.relogioCombate;
    return false;
  }
  return moverCorpoEmPressaoNovoBoss(scene, encontro, encontro,
    tempoMovimentoNovoBoss(scene, encontro, delta));
}
