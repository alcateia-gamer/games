import {
  ataquePorEstado,
  duracaoFrame,
  estadosAnimacao,
  emitirEventoBoss,
  intervaloEntreAtaques,
  obterNumeroFrameAnimacao,
} from "./BossConfig.js";
import { atualizarHitboxesBoss, socoComDanoAtivo } from "./BossHitboxes.js";

export function criarAnimacoesBoss(scene) {
  for (const [estado, dados] of Object.entries(estadosAnimacao)) {
    if (estado === "idle") continue;
    const chave = `boss-final-${estado}`;
    if (scene.anims.exists(chave)) continue;
    scene.anims.create({
      key: chave,
      frames: scene.anims.generateFrameNumbers(dados.textura, {
        start: 0,
        end: dados.frameFinal,
      }),
      frameRate: 1000 / duracaoFrame,
      repeat: 0,
    });
  }
}

export function exibirEstadoBoss(boss, estado) {
  const dados = estadosAnimacao[estado];
  if (!dados)
    throw new RangeError(`Estado de animação do Boss desconhecido: ${estado}`);
  if (boss.bossEstadoAtual === estado) return;
  boss.sprite.anims.stop();
  boss.bossEstadoAtual = estado;
  boss.iaCombate.frame = 0;
  boss.sprite
    .setTexture(dados.textura, 0)
    .setPosition(dados.offsetX, dados.offsetY);
  atualizarHitboxesBoss(boss);
  if (estado !== "idle") boss.sprite.anims.play(`boss-final-${estado}`);
}

function atualizarMiraDurantePreparacao(boss, player, frame, callbacks) {
  const ia = boss.iaCombate;
  if (
    !player?.active ||
    ia.ataqueAtual !== "tiroLaser" ||
    frame < 8 ||
    frame > 12
  )
    return;
  if (frame < 12) {
    const previsao = callbacks.preverPosicaoJogador(ia, player, 0.12);
    const dx = previsao.x - boss.x;
    const dy = previsao.y - (boss.y - 175);
    const comprimento = Math.hypot(dx, dy) || 1;
    ia.direcaoLaser = { x: dx / comprimento, y: dy / comprimento };
    return;
  }
  if (ia.frameMiraTravada !== null) return;
  ia.frameMiraTravada = frame;
  ia.posicaoNoDisparo = { x: player.x, y: player.y };
  emitirEventoBoss(boss, "boss:laser-disparado", {
    direcao: ia.direcaoLaser,
    frame,
    danoAtivo: false,
  });
}

export function finalizarAnimacaoBoss(boss, animacao, callbacks) {
  if (boss.morto) return;
  const ia = boss.iaCombate;
  const estadoTerminado = Object.keys(ataquePorEstado).find(
    (estado) => `boss-final-${estado}` === animacao.key,
  );
  if (!estadoTerminado || boss.bossEstadoAtual !== estadoTerminado) return;
  if (estadoTerminado === "tiroLaser")
    callbacks.observarEsquivaLaser(boss, ia.jogadorAtual);
  ia.ataqueAtual = null;
  ia.frameMiraTravada = null;
  ia.direcaoLaser = null;
  ia.zonasRaio = [];
  ia.areaRaio = null;
  ia.jogadorAtingidoNesteAtaque = false;
  ia.framesCuraAplicados.clear();
  ia.estado = "IDLE";
  ia.tempoAteDecidir = intervaloEntreAtaques;
  exibirEstadoBoss(boss, "idle");
  emitirEventoBoss(boss, "boss:ataque-finalizado", {
    ataque: ataquePorEstado[estadoTerminado],
  });
}

export function tratarAnimationUpdate(boss, animacao, frame, callbacks) {
  if (boss.morto) return;
  const ia = boss.iaCombate;
  if (!ia.ataqueAtual || animacao.key !== `boss-final-${ia.ataqueAtual}`)
    return;
  ia.frame = obterNumeroFrameAnimacao(frame);
  ia.jogadorAtual = boss.scene.player;
  atualizarHitboxesBoss(boss); // mao laranja e corpo verde seguem o frame real
  atualizarMiraDurantePreparacao(boss, ia.jogadorAtual, ia.frame, callbacks);
  callbacks.aplicarCuraDoFrame(boss);
  callbacks.aplicarDanoDoAtaque(boss);
  emitirEventoBoss(boss, "boss:ataque-frame", {
    ataque: ataquePorEstado[ia.ataqueAtual],
    estado: ia.ataqueAtual,
    frame: ia.frame,
    zonas: [],
    area: socoComDanoAtivo(boss) ? boss.areaDanoChao : null,
    direcao: ia.direcaoLaser,
    danoAtivo: socoComDanoAtivo(boss),
  });
}

export function registrarListenersBoss(boss, callbacks) {
  if (boss.listenersRegistrados) return;
  boss.onAnimationUpdate = (animacao, frame) =>
    tratarAnimationUpdate(boss, animacao, frame, callbacks);
  boss.onAnimationComplete = (animacao) =>
    finalizarAnimacaoBoss(boss, animacao, callbacks);
  boss.sprite.on("animationupdate", boss.onAnimationUpdate);
  boss.sprite.on("animationcomplete", boss.onAnimationComplete);
  boss.listenersRegistrados = true;
}
