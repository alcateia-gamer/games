/** Poses, reação aos golpes e efeitos próprios do encontro. */
import { assetsNovoBoss } from "./NovoBossAssets.js";
import { areaCorpoNovoBoss } from "./NovoBossConfig.js";
import { criarTeleporteVisualNovoBoss } from "./NovoBossTeleporteVisual.js";
import { criarExplosaoEnergia } from "./NovoBossEfeitosEnergia.js";
import { COMBAT_FEEL } from "../../combat/CombatEffects.js";
import { destinoValidoNovoBoss, sincronizarCorpoNovoBoss } from "./NovoBossTeleporte.js";

const poses = new WeakMap();
const FLASH_MS = COMBAT_FEEL.hitFlashDuration;
const BURST_MS = 900;
const DERROTA_MS = 900;

/**
 * Troca a folha mantendo o corpo no mesmo retângulo do mundo. A folha de ataque
 * tem margens diferentes; redimensionar a física pela célula inteira deslocaria
 * a hitbox. Falsos usam o mesmo cálculo sem criar corpos Arcade de contato.
 */
export function aplicarPoseNovoBoss(scene, entidade, execucaoAtaque = null) {
  const sprite = entidade?.sprite;
  if (!sprite?.active || !entidade.config?.visual) return null;
  const visual = entidade.config.visual;
  const jogador = scene.player;
  // Conserva a última direção quando os dois estão no mesmo X ou não há alvo.
  // flipX espelha somente a arte, sem inverter a escala usada pela física.
  if (jogador?.active !== false && !jogador?.morto &&
      Number.isFinite(jogador?.x) && Number.isFinite(sprite.x) && jogador.x !== sprite.x) {
    sprite.setFlipX?.(jogador.x < sprite.x);
  }
  const ataqueDisponivel = scene.textures?.exists?.(assetsNovoBoss.ataque.chave) &&
    scene.anims?.exists?.(assetsNovoBoss.ataque.animacao);
  const emAtaque = Boolean(execucaoAtaque && ataqueDisponivel);
  const tipo = emAtaque ? "ataque" : "idle";
  const asset = assetsNovoBoss[tipo];
  const anterior = poses.get(entidade);
  const mudou = !anterior || anterior.tipo !== tipo || anterior.execucao !== execucaoAtaque;
  const deslocamento = emAtaque ? assetsNovoBoss.ataque.deslocamentoCorpo : { x: 0, y: 0 };
  const ancoraX = 288 * visual.origemX + deslocamento.x;
  // O ataque tem margens assimétricas: espelhar sua origem mantém o mesmo pivô.
  const origemPixelsX = sprite.flipX ? asset.larguraFrame - ancoraX : ancoraX;
  const origemX = origemPixelsX / asset.larguraFrame;
  const origemY = (288 * visual.origemY + deslocamento.y) / asset.alturaFrame;
  if (mudou) {
    sprite.setTexture?.(asset.chave, 0);
    if (scene.anims?.exists?.(asset.animacao)) sprite.play?.(asset.animacao, false);
    poses.set(entidade, { tipo, execucao: execucaoAtaque });
  }
  sprite.setOrigin?.(origemX, origemY);
  sprite.body?.setSize?.(visual.corpo.largura, visual.corpo.altura, false);
  sprite.body?.setOffset?.(visual.corpo.x + deslocamento.x + origemPixelsX - ancoraX,
    visual.corpo.y + deslocamento.y);
  sprite.body?.updateFromGameObject?.();
  const area = areaCorpoNovoBoss(entidade.config, sprite);
  if (entidade.hitboxDano?.setTo) entidade.hitboxDano.setTo(area.x, area.y, area.width, area.height);
  else if (entidade.hitboxDano) Object.assign(entidade.hitboxDano, area);
  return tipo;
}

/** Usa o quadro e o relógio da verdadeira após todas as atualizações deste frame. */
export function sincronizarAnimacoesAtaqueNovoBoss(scene, encontro) {
  const origem = encontro.sprite?.anims;
  if (encontro.estado !== "atacando" || !encontro.ataqueAtual ||
      origem?.currentAnim?.key !== assetsNovoBoss.ataque.animacao || !origem.currentFrame) return;
  for (const alvo of encontro.alvosIlusorios ?? []) {
    if (!alvo.active || !alvo.visible) continue;
    if (aplicarPoseNovoBoss(scene, alvo, encontro.ataqueAtual) !== "ataque") continue;
    const destino = alvo.sprite.anims;
    if (destino?.currentAnim !== origem.currentAnim || !destino.setCurrentFrame) continue;
    // Não chama play() novamente: conserva o progresso e o fim da animação única.
    if (destino.currentFrame !== origem.currentFrame) destino.setCurrentFrame(origem.currentFrame);
    destino.accumulator = origem.accumulator;
    destino.nextTick = origem.nextTick;
    destino.isPlaying = origem.isPlaying;
  }
}

/** Coordenada do brilho no capuz, com as margens reais de cada folha. */
export function pontoNucleoNovoBoss(entidade) {
  const visual = entidade.config.visual;
  const ataque = poses.get(entidade)?.tipo === "ataque";
  const asset = ataque ? assetsNovoBoss.ataque : assetsNovoBoss.idle;
  const deslocamento = ataque ? assetsNovoBoss.ataque.deslocamentoCorpo : { x: 0, y: 0 };
  return {
    x: entidade.sprite.x + (asset.nucleo.x - 288 * visual.origemX - deslocamento.x) *
      visual.escala * (entidade.sprite.flipX ? -1 : 1),
    y: entidade.sprite.y + (asset.nucleo.y - 288 * visual.origemY - deslocamento.y) * visual.escala,
  };
}

export function prepararApresentacaoNovoBoss(scene, encontro) {
  if (encontro.apresentacao) return encontro.apresentacao;
  let destruido = false;
  let grafico = null;
  let flashRestante = 0;
  let recuoRestante = 0;
  let recuouNesteQuadro = false;
  let recuoX = 0, recuoY = 0;
  let burstRestante = 0;
  let origemBurst = null;
  let derrotaDecorrido = null;
  let poseMorte = false;
  let tempo = 0;
  const explosoes = new Set();
  const teleporteVisual = criarTeleporteVisualNovoBoss(scene, encontro);
  function limparExplosoesPulso() {
    for (const { efeito } of explosoes) efeito.destruir();
    explosoes.clear();
  }

  const doEncontro = payload => payload?.encontro === encontro;
  const dano = payload => {
    if (!destruido && doEncontro(payload) && payload.anterior > payload.vida && !encontro.morto) {
      flashRestante = FLASH_MS;
      const sprite = encontro.sprite;
      sprite?.setTint?.(0xffffff);
      sprite?.setTintMode?.(globalThis.Phaser?.TintModes?.FILL);
      const dx = sprite?.x - scene.player?.x, dy = sprite?.y - scene.player?.y;
      if (!encontro.prologo?.bloqueiaCombatePrincipal && [dx, dy].every(Number.isFinite)) {
        const distancia = Math.hypot(dx, dy);
        recuoX = distancia > 0 ? dx / distancia : sprite.flipX ? 1 : -1;
        recuoY = distancia > 0 ? dy / distancia : 0;
        recuoRestante = COMBAT_FEEL.knockbackDuration;
      }
    }
  };
  const fase = payload => {
    if (!destruido && encontro.config.visual.efeitosGeometricosLegados &&
        doEncontro(payload) && payload.fase === 2 && encontro.sprite) {
      burstRestante = BURST_MS;
      origemBurst = { x: encontro.sprite.x, y: encontro.sprite.y };
    }
  };
  const derrota = payload => {
    if (!destruido && doEncontro(payload) && derrotaDecorrido === null) {
      derrotaDecorrido = 0;
      const asset = assetsNovoBoss.morte;
      poseMorte = Boolean(scene.textures?.exists?.(asset.chave));
      if (poseMorte) {
        const sprite = encontro.sprite;
        sprite.anims?.stop?.();
        sprite.setTexture?.(asset.chave, 0);
        sprite.setOrigin?.(sprite.flipX ? 1 - asset.origemX : asset.origemX, asset.origemY);
      }
      // A derrota limpa o combate, mas o corpo permanece até o encerramento da sala.
      encontro.sprite?.setAlpha?.(1);
      encontro.sprite?.setVisible?.(true);
      flashRestante = 0;
      recuoRestante = 0;
      recuouNesteQuadro = false;
      encontro.sprite?.clearTint?.();
      limparExplosoesPulso();
    }
  };
  scene.events.on("novo-boss:vida", dano);
  scene.events.on("novo-boss:fase-alterada", fase);
  scene.events.on("novo-boss:derrotada", derrota);

  function obterGrafico() {
    if (!grafico && scene.add?.graphics) {
      grafico = scene.add.graphics();
      grafico.setName?.("novo-boss-apresentacao");
      // Fica abaixo dos avisos vermelhos e acima da sombra ambiente (depth 50).
      grafico.setDepth?.(50.5);
    }
    return grafico;
  }

  const sistema = {
    get recuouNesteQuadro() { return recuouNesteQuadro; },
    atualizarRecuo(delta = 0) {
      recuouNesteQuadro = false;
      if (destruido || recuoRestante <= 0 || !Number.isFinite(delta) || delta < 0) return;
      if (!encontro.sprite?.active || encontro.morto || encontro.encerrado || encontro.suspenso ||
          !encontro.jogadorNaArena || encontro.teleporte || scene.multiplayer ||
          scene.morteEmAndamento || (scene.vida ?? 1) <= 0) {
        recuoRestante = 0;
        return;
      }
      const passoMs = Math.min(delta, recuoRestante);
      recuouNesteQuadro = passoMs > 0;
      recuoRestante -= passoMs;
      const fatorRecuo = encontro.config.combate?.fatorRecuo ?? 0.2;
      let restante = COMBAT_FEEL.knockback * Math.max(0, fatorRecuo) * passoMs / 1000;
      // O corpo é imóvel na física Arcade: aplica o mesmo impulso em passos seguros.
      while (restante > 0) {
        const passo = Math.min(2, restante);
        const ponto = { x: encontro.sprite.x + recuoX * passo,
          y: encontro.sprite.y + recuoY * passo };
        if (!destinoValidoNovoBoss(scene, encontro, ponto)) {
          recuoRestante = 0;
          break;
        }
        sincronizarCorpoNovoBoss(encontro, ponto);
        restante -= passo;
      }
    },
    criarExplosaoPulso(origem, raio, inicio = encontro.relogioCombate) {
      if (destruido || encontro.morto || encontro.encerrado || encontro.suspenso ||
          !encontro.jogadorNaArena || scene.multiplayer || scene.morteEmAndamento ||
          !Number.isFinite(inicio)) return false;
      const efeito = criarExplosaoEnergia(scene, origem, raio,
        Math.max(0, encontro.relogioCombate - inicio));
      if (!efeito) return false;
      explosoes.add({ efeito, inicio });
      return true;
    },
    limparExplosoesPulso,
    atualizar(delta = 0) {
      if (destruido || !encontro.sprite?.active || !Number.isFinite(delta) || delta < 0) return;
      const sprite = encontro.sprite;
      const visivel = !scene.multiplayer && !encontro.encerrado && !encontro.suspenso &&
        encontro.jogadorNaArena && !scene.morteEmAndamento && (scene.vida ?? 1) > 0;
      if (!visivel || encontro.morto) limparExplosoesPulso();
      else for (const item of explosoes) {
        if (item.efeito.atualizarIdade(encontro.relogioCombate - item.inicio)) explosoes.delete(item);
      }
      if (!encontro.morto && visivel) {
        aplicarPoseNovoBoss(scene, encontro, encontro.estado === "atacando" ? encontro.ataqueAtual : null);
      }
      const temVisualTeleporte = teleporteVisual.atualizar(visivel && !encontro.morto);
      if (flashRestante > 0) {
        flashRestante = Math.max(0, flashRestante - delta);
        if (flashRestante === 0) sprite.clearTint?.();
      }
      if (encontro.morto && derrotaDecorrido !== null) {
        derrotaDecorrido = Math.min(DERROTA_MS, derrotaDecorrido + delta);
      }
      tempo += delta;
      if (burstRestante > 0) burstRestante = Math.max(0, burstRestante - delta);
      grafico?.clear();
      grafico?.setVisible(visivel && !encontro.morto);
      if (!visivel || encontro.morto) return;

      const viagem = encontro.teleporte;
      // Vulnerabilidade e proteção são informadas pelo HUD, sem marcar a verdadeira no chão.
      if (!encontro.config.visual.efeitosGeometricosLegados || (!viagem && burstRestante <= 0)) {
        grafico?.setVisible(false);
        return;
      }
      const efeito = obterGrafico();
      if (!efeito) return;
      efeito.setVisible(true);
      if (viagem && !temVisualTeleporte) {
        const cfg = encontro.config.teleporte;
        const duracao = viagem.etapa === "desaparecendo" ? cfg.desaparecerMs : cfg.reaparecerMs;
        const p = Math.min(1, viagem.decorrido / Math.max(1, duracao));
        const origem = viagem.origem;
        efeito.lineStyle(2, 0xc1a0ff, 0.9);
        efeito.strokeCircle(origem.x, origem.y + 35, 17 + (1 - p) * 13);
        if (viagem.etapa !== "aguardando-destino") {
          const destino = viagem.destino;
          efeito.strokeCircle(destino.x, destino.y + 35, 24 + Math.sin(tempo / 75) * 4);
          efeito.lineStyle(1, 0xe1caff, 0.75);
          efeito.strokeCircle(destino.x, destino.y + 35, 11 + p * 12);
        }
        for (const lado of [-1, 1]) {
          efeito.lineStyle(2, 0xa99aca, 0.7);
          efeito.beginPath();
          efeito.moveTo(origem.x + lado * 22, origem.y + 15);
          efeito.lineTo(origem.x + lado * (33 - p * 19), origem.y - 3 - p * 15);
          efeito.lineTo(origem.x + lado * 7, origem.y - 25 - p * 14);
          efeito.strokePath();
        }
      }
      if (burstRestante > 0 && origemBurst) {
        const p = 1 - burstRestante / BURST_MS;
        efeito.lineStyle(2, 0xe3adff, (1 - p) * 0.7);
        efeito.strokeCircle(origemBurst.x, origemBurst.y, 18 + p * 105);
        for (let indice = 0; indice < 9; indice++) {
          const angulo = indice / 9 * Math.PI * 2;
          const raio = 25 + p * 110;
          efeito.lineBetween(origemBurst.x + Math.cos(angulo) * raio,
            origemBurst.y + Math.sin(angulo) * raio,
            origemBurst.x + Math.cos(angulo) * (raio + 10),
            origemBurst.y + Math.sin(angulo) * (raio + 10));
        }
      }
    },
    destruir() {
      if (destruido) return;
      destruido = true;
      scene.events.off("novo-boss:vida", dano);
      scene.events.off("novo-boss:fase-alterada", fase);
      scene.events.off("novo-boss:derrotada", derrota);
      if (flashRestante > 0) encontro.sprite?.clearTint?.();
      teleporteVisual.destruir();
      grafico?.destroy();
      limparExplosoesPulso();
      grafico = null;
      flashRestante = 0;
      recuoRestante = 0;
      recuouNesteQuadro = false;
      burstRestante = 0;
      poses.delete(encontro);
      if (encontro.apresentacao === sistema) encontro.apresentacao = null;
    },
    snapshot() {
      return { destruido, pose: poses.get(encontro)?.tipo ?? null, flashRestante, recuoRestante,
        explosoesPulso: explosoes.size,
        burstRestante, derrotaDecorrido, poseMorte, graficoVisivel: Boolean(grafico?.visible),
        nucleo: encontro.sprite ? pontoNucleoNovoBoss(encontro) : null };
    },
  };
  encontro.apresentacao = sistema;
  return sistema;
}
