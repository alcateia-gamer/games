import {
  ataquePorEstado,
  cooldownRecVida,
  distanciaLonge,
  distanciaPerto,
  percentualVidaParaRecuperar,
  previsaoMaxima,
  emitirEventoBoss,
} from "./BossConfig.js";
import { exibirEstadoBoss } from "./BossAnimacoes.js";

function observarJogador(boss, player, delta) {
  const ia = boss.iaCombate;
  const distancia = Math.hypot(player.x - boss.x, player.y - boss.y);
  const intervalo = Math.max(delta, 1) / 1000;
  const anterior = ia.posicaoAnterior || { x: player.x, y: player.y };
  ia.velocidadeX = (player.x - anterior.x) / intervalo;
  ia.velocidadeY = (player.y - anterior.y) / intervalo;
  const velocidade = Math.hypot(ia.velocidadeX, ia.velocidadeY);
  ia.aproximacaoRadial =
    ia.distanciaAnterior === null
      ? 0
      : (ia.distanciaAnterior - distancia) / intervalo;
  ia.posicaoAnterior = { x: player.x, y: player.y };
  ia.distanciaAnterior = distancia;
  ia.distancia = distancia;
  ia.direcao = {
    x: velocidade > 24 ? Math.sign(ia.velocidadeX) : 0,
    y: velocidade > 24 ? Math.sign(ia.velocidadeY) : 0,
  };
  ia.aproximando = ia.aproximacaoRadial > 20;
  ia.afastando = ia.aproximacaoRadial < -20;
  ia.correndo = velocidade > 140;
  ia.parado = velocidade < 22;
  ia.atacandoPerto =
    distancia < distanciaPerto &&
    Boolean(player.atacando || boss.scene?.atacando);
  ia.pertoPor =
    distancia < distanciaPerto
      ? ia.pertoPor + delta
      : Math.max(0, ia.pertoPor - delta * 1.4);
  ia.longePor =
    distancia > distanciaLonge
      ? ia.longePor + delta
      : Math.max(0, ia.longePor - delta * 1.4);
  ia.pressaoPerto = ia.atacandoPerto
    ? ia.pressaoPerto + delta
    : Math.max(0, ia.pressaoPerto - delta * 1.5);
  ia.paradoPor = ia.parado
    ? ia.paradoPor + delta
    : Math.max(0, ia.paradoPor - delta);
  const regiao = `${Math.floor(player.x / 220)}:${Math.floor(player.y / 220)}`;
  ia.tempoNaRegiao = regiao === ia.regiaoAtual ? ia.tempoNaRegiao + delta : 0;
  ia.regiaoAtual = regiao;
  ia.jogadorAtual = player;
  ia.aprendizadoEsquiva *= Math.pow(0.84, delta / 1000);
}

function preverPosicaoJogador(ia, player, horizonte) {
  const correcao =
    ia.ataqueAtual === "tiroLaser" ? ia.aprendizadoEsquiva * 24 : 0;
  return {
    x:
      player.x +
      Phaser.Math.Clamp(
        ia.velocidadeX * horizonte,
        -previsaoMaxima,
        previsaoMaxima,
      ) +
      correcao,
    y:
      player.y +
      Phaser.Math.Clamp(
        ia.velocidadeY * horizonte,
        -previsaoMaxima,
        previsaoMaxima,
      ),
  };
}

function observarEsquivaLaser(boss, player) {
  const ia = boss.iaCombate;
  const inicio = ia.posicaoNoDisparo;
  if (!inicio || !player?.active) {
    ia.posicaoNoDisparo = null;
    return;
  }
  const deltaX = player.x - inicio.x;
  if (Math.abs(deltaX) >= 36) {
    ia.tendenciaEsquiva.push(Math.sign(deltaX));
    if (ia.tendenciaEsquiva.length > 6) ia.tendenciaEsquiva.shift();
    const media =
      ia.tendenciaEsquiva.reduce((soma, direcao) => soma + direcao, 0) /
      ia.tendenciaEsquiva.length;
    ia.aprendizadoEsquiva = ia.aprendizadoEsquiva * 0.65 + media * 0.35;
  } else {
    ia.aprendizadoEsquiva *= 0.7;
  }
  ia.posicaoNoDisparo = null;
}

function pontuarAtaque(boss, ataque) {
  const ia = boss.iaCombate;
  let pontos = 0;
  if (ataque === "chao") {
    if (ia.distancia < distanciaPerto && ia.pertoPor > 650)
      pontos += 2 + Math.min(4, ia.pertoPor / 1800);
    if (ia.atacandoPerto) pontos += 9 + Math.min(4, ia.pressaoPerto / 1500);
    if (ia.aproximando && ia.correndo && ia.distancia < 390) pontos += 4;
    if (
      ia.ataquesRecentes[0] === "laser" &&
      ia.aproximando &&
      ia.distancia < 420
    )
      pontos += 6;
    if (ia.ataquesRecentes[0] === "chao") pontos -= 6;
  } else if (ataque === "laser") {
    if (ia.distancia > distanciaLonge)
      pontos += 4 + Math.min(4, ia.longePor / 3000);
    if (ia.afastando && ia.distancia > distanciaPerto) pontos += 2;
    if (
      ia.ataquesRecentes[0] === "chao" &&
      ia.afastando &&
      ia.distancia > distanciaLonge
    )
      pontos += 6;
    if (ia.distancia > distanciaLonge && ia.ataquesRecentes[0] !== "raio")
      pontos += 1;
  } else if (ataque === "raio") {
    if (ia.parado) pontos += 6 + Math.min(5, ia.paradoPor / 1600);
    if (ia.tempoNaRegiao > 2500) pontos += 3;
    if (ia.distancia >= distanciaPerto && ia.distancia <= distanciaLonge)
      pontos += 2;
    if (ia.pressaoPerto > 2200) pontos += 3;
    if (
      ia.ataquesRecentes[0] === "laser" &&
      ia.parado &&
      ia.posicaoNoDisparo === null
    )
      pontos += 6;
    if (ia.ataquesRecentes[0] === "chao" && ia.afastando && ia.paradoPor > 300)
      pontos += 6;
    if (ia.ataquesRecentes[0] === "chao" && ia.pressaoPerto > 600) pontos += 5;
    if (ia.longePor > 5000 && ia.ataquesRecentes[0] === "laser") pontos += 3;
  } else if (ataque === "rec") {
    const percentual = boss.vida / boss.vidaMaxima;
    if (
      percentual > percentualVidaParaRecuperar ||
      ia.cooldownRecVidaRestante > 0
    )
      return -9999;
    pontos += 10 + (percentualVidaParaRecuperar - percentual) * 20;
    if (ia.distancia > distanciaPerto) pontos += 3;
    if (ia.ataquesRecentes[0] === "rec") pontos -= 20;
  }
  if (ia.ataquesRecentes[0] === ataque) pontos -= 5;
  if (ia.ataquesRecentes[1] === ataque) pontos -= 2;
  return pontos;
}

function escolherAtaque(boss) {
  const ia = boss.iaCombate;
  const candidatos = [
    { estado: "ataqueChao", chave: "chao" },
    { estado: "raioChao", chave: "raio" },
    { estado: "tiroLaser", chave: "laser" },
    { estado: "recVida", chave: "rec" },
  ];
  candidatos.sort(
    (a, b) => pontuarAtaque(boss, b.chave) - pontuarAtaque(boss, a.chave),
  );
  if (pontuarAtaque(boss, candidatos[0].chave) > 0) return candidatos[0].estado;
  if (
    ia.atacandoPerto ||
    (ia.aproximando && ia.correndo && ia.distancia < 390) ||
    (ia.distancia < distanciaPerto && ia.pertoPor > 650)
  )
    return "ataqueChao";
  if (ia.parado || ia.tempoNaRegiao > 2500) return "raioChao";
  return ia.distancia > distanciaLonge || !ia.parado ? "tiroLaser" : "raioChao";
}

function iniciarAtaque(boss, estado) {
  const ia = boss.iaCombate;
  if (boss.morto || ia.ataqueAtual || !Object.hasOwn(ataquePorEstado, estado))
    return false;
  ia.ataqueAtual = estado;
  ia.estado = estado;
  ia.frame = 0;
  ia.frameMiraTravada = null;
  ia.direcaoLaser = null;
  ia.posicaoNoDisparo = null;
  ia.zonasRaio = [];
  ia.areaRaio = null;
  ia.jogadorAtingidoNesteAtaque = false;
  ia.framesCuraAplicados.clear();
  if (estado === "recVida") ia.cooldownRecVidaRestante = cooldownRecVida;
  ia.ataquesRecentes.unshift(ataquePorEstado[estado]);
  ia.ataquesRecentes.length = Math.min(ia.ataquesRecentes.length, 2);
  exibirEstadoBoss(boss, estado);
  if (estado === "raioChao")
    emitirEventoBoss(boss, "boss:ataque-raio-anunciado", { danoAtivo: false });
  emitirEventoBoss(boss, "boss:ataque-iniciado", {
    ataque: ataquePorEstado[estado],
    estado,
    danoAtivo: false,
  });
  return true;
}

function atualizarIABoss(scene, delta = 16.67) {
  const boss = scene.bossFinal;
  const player = scene.player;
  if (!boss?.active || boss.morto) return;
  const deltaSeguro = Number.isFinite(delta) ? Math.max(0, delta) : 16.67;
  if (!player?.active) return;
  observarJogador(boss, player, deltaSeguro);
  const ia = boss.iaCombate;
  ia.cooldownRecVidaRestante = Math.max(
    0,
    ia.cooldownRecVidaRestante - deltaSeguro,
  );
  if (ia.ataqueAtual) return;
  ia.tempoAteDecidir = Math.max(0, ia.tempoAteDecidir - deltaSeguro);
  if (ia.tempoAteDecidir > 0) return;
  ia.estado = "ANALISANDO";
  const estado = ia.ataqueSolicitado || escolherAtaque(boss);
  ia.ataqueSolicitado = null;
  iniciarAtaque(boss, estado);
}

function solicitarAtaqueBoss(scene, ataque) {
  const estado = Object.hasOwn(ataquePorEstado, ataque)
    ? ataque
    : Object.entries(ataquePorEstado).find(([, nome]) => nome === ataque)?.[0];
  if (!estado) throw new RangeError(`Ataque de Boss desconhecido: ${ataque}`);
  const boss = scene.bossFinal;
  if (!boss?.active || boss.morto || boss.iaCombate.ataqueAtual) return false;
  boss.iaCombate.ataqueSolicitado = estado;
  boss.iaCombate.tempoAteDecidir = 0;
  return true;
}

export {
  escolherAtaque,
  iniciarAtaque,
  observarEsquivaLaser,
  observarJogador,
  pontuarAtaque,
  preverPosicaoJogador,
  solicitarAtaqueBoss,
  atualizarIABoss,
};
