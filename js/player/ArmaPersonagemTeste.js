/** Armas temporárias do sprite de teste: empunhadura, mira, lasers e integração da espada. */
import { PERSONAGEM_TESTE, obterArmasPersonagemTeste, obterArmaPersonagemTeste,
  obterPersonagemTeste, personagemTesteAtivo } from "./PersonagemTeste.js";
import { obstaculosFlecha, tempoImpactoFlecha } from "./ArrowCollision.js";
import { causarDanoInimigo } from "../enemies/EnemyHealth.js";
import { causarDanoBoss } from "../enemies/BossFinal.js";
import { alvosAdicionaisCombate, eAlvoAdicionalCombate,
  causarDanoAlvoAdicional } from "../combat/CombatTargets.js";
import { aplicarPoseEspada, iniciarGolpeEspada, atualizarGolpeEspada,
  cancelarGolpeEspada } from "./EspadaPersonagemTeste.js";
import { aplicarPoseFlorete, iniciarEstocada, atualizarEstocada,
  cancelarEstocada } from "./FloretePersonagemTeste.js";

import { obterSocketTeste, transformarPontoArma, camadaArmaTeste } from "./WeaponSocketsTeste.js";
import { atualizarDebugEncaixe } from "./WeaponSocketDebug.js";

const DIRECOES = { down: { x: 0, y: 1 }, up: { x: 0, y: -1 },
  left: { x: -1, y: 0 }, right: { x: 1, y: 0 } };

function alvosDaCena(scene) {
  return [...new Set([...(scene.inimigos ?? []), scene.inimigoTeste, scene.bossFinal,
    ...alvosAdicionaisCombate(scene)])]
    .filter(alvo => alvo?.active && alvo.visible !== false && !alvo.morto &&
      alvo.body?.enable !== false && (alvo.vida ?? 1) > 0);
}

function centroAlvo(alvo) {
  const area = alvo.hitboxDano ?? alvo.body;
  return area ? { x: area.x + area.width / 2, y: area.y + area.height / 2 }
    : { x: alvo.x, y: alvo.y };
}

function encaixeArma(scene, config) {
  return obterPersonagemTeste(scene)?.encaixeArmas?.[config.tipo] ?? config;
}

/** Mantém o alvo visível até ele morrer, sair do alcance ou passar atrás de uma parede. */
export function obterAlvoArmaTeste(scene, alvoAtual = null) {
  const config = obterArmaPersonagemTeste(scene);
  const encaixe = encaixeArma(scene, config);
  const player = scene.player;
  const alvos = alvosDaCena(scene).filter(alvo => {
    const centro = centroAlvo(alvo);
    return Math.hypot(centro.x - player.x, centro.y - player.y) <= config.alcanceMira;
  }).sort((a, b) => {
    if (a === alvoAtual) return -1;
    if (b === alvoAtual) return 1;
    const pa = centroAlvo(a), pb = centroAlvo(b);
    return Math.hypot(pa.x - player.x, pa.y - player.y) -
      Math.hypot(pb.x - player.x, pb.y - player.y);
  });
  return alvos.find(alvo => {
    const centro = centroAlvo(alvo);
    const inicio = obterSocketTeste(scene, centro.x < player.x, encaixe);
    const angulo = Math.atan2(centro.y - inicio.y, centro.x - inicio.x);
    const direcao = { x: Math.cos(angulo), y: Math.sin(angulo) };
    return !obstaculosFlecha(scene, inicio, centro, 0).some(corpo =>
      tempoImpactoFlecha(inicio, centro, direcao, corpo, 0, 0) !== null);
  }) ?? null;
}

/** A arma gira pelo cabo; compensar a altura do cano faz o laser cruzar o centro do alvo. */
export function calcularPoseArmaTeste(player, direcao, alvo = null, recuo = 0,
  config = PERSONAGEM_TESTE.arma, esquerdaFixa = null, encaixe = config) {
  const centro = alvo ? centroAlvo(alvo) : null;
  const esquerda = esquerdaFixa ?? (centro ? centro.x < player.x : direcao.x < 0);
  const socket = encaixe.obterMao?.(esquerda);
  const mao = socket ? { x: socket.x, y: socket.y }
    : { x: player.x + (esquerda ? -encaixe.maoX : encaixe.maoX), y: player.y + encaixe.maoY };
  const escala = config.largura / config.recorte.largura;
  const base = config.anguloArte ?? 0;
  const dx = (config.cano.x - config.empunhadura.x) * escala;
  const dy = (config.cano.y - config.empunhadura.y) * escala;
  const canoX = dx * Math.cos(base) + dy * Math.sin(base);
  const canoY = (-dx * Math.sin(base) + dy * Math.cos(base)) * (esquerda ? -1 : 1);
  let angulo = Math.atan2(direcao.y, direcao.x);
  if (centro) {
    const dx = centro.x - mao.x, dy = centro.y - mao.y;
    const distancia = Math.hypot(dx, dy);
    angulo = Math.atan2(dy, dx) - Math.asin(Math.max(-1, Math.min(1,
      canoY / Math.max(distancia, 1))));
  }
  const x = Math.cos(angulo), y = Math.sin(angulo);
  mao.x -= x * recuo;
  mao.y -= y * recuo;
  return { mao, anguloMira: angulo, socketMedido: Boolean(socket?.medido), socket, angulo, rotacaoSprite: angulo - base * (esquerda ? -1 : 1),
    esquerda, escala, direcao: { x, y },
    cano: { x: mao.x + canoX * x - canoY * y, y: mao.y + canoX * y + canoY * x } };
}

function podeDisparar(scene) {
  return personagemTesteAtivo(scene) && !scene.multiplayer && scene.player?.active &&
    scene.player.visible !== false && !scene.morteEmAndamento && (scene.vida ?? 1) > 0 &&
    !scene.generatorMenuOpen && !scene.movimentoBloqueado;
}

function atualizarPose(scene, estado) {
  const config = estado.config;
  const velocidade = scene.player.body?.velocity;
  const modulo = Math.hypot(velocidade?.x ?? 0, velocidade?.y ?? 0);
  if (modulo > 1) estado.direcao = { x: velocidade.x / modulo, y: velocidade.y / modulo };
  estado.alvo = obterAlvoArmaTeste(scene, estado.alvo);
  const corpoACorpo = config.tipo === "espada" || config.tipo === "florete";
  const desdeDisparo = scene.time.now - estado.ultimoDisparo;
  const recuo = !corpoACorpo && desdeDisparo > 0 && desdeDisparo < 90
    ? Math.sin(Math.PI * desdeDisparo / 90) * 3 * Math.PI / 180 : 0;
  const golpe = estado.golpeEspada ?? estado.estocada;
  const pose = calcularPoseArmaTeste(scene.player,
    golpe?.direcao ?? estado.direcao, golpe ? null : estado.alvo, 0, config,
    golpe?.esquerda ?? (!estado.alvo && Math.abs(estado.direcao.x) < 0.02 ? Boolean(scene.player.flipX) : null),
    { ...encaixeArma(scene, config),
      obterMao: esquerda => obterSocketTeste(scene, esquerda, encaixeArma(scene, config)) });
  if (config.tipo === "espada") aplicarPoseEspada(scene, estado, pose);
  if (config.tipo === "florete") aplicarPoseFlorete(scene, estado, pose);
  // Recuo angular após o disparo: gira pelo grip sem arrancá-lo da mão.
  pose.rotacaoSprite -= recuo * (pose.esquerda ? -1 : 1);
  pose.cano = transformarPontoArma(config, pose, config.cano);
  estado.pose = pose;
  // O corpo acompanha a mira; a velocidade permanece na direção escolhida pelo jogador.
  scene.player.setFlipX(pose.esquerda);
  estado.sprite.setPosition(pose.mao.x, pose.mao.y).setScale(pose.escala)
    .setOrigin(config.empunhadura.x / config.recorte.largura,
      pose.esquerda ? 1 - config.empunhadura.y / config.recorte.altura
        : config.empunhadura.y / config.recorte.altura)
    .setRotation(pose.rotacaoSprite).setFlipY(pose.esquerda)
    .setDepth(scene.player.depth + (pose.socketMedido ? camadaArmaTeste(estado, pose) : 0.1))
    .setVisible(scene.player.visible !== false && !scene.morteEmAndamento)
    .setAlpha(scene.player.alpha);
  const claridade = corpoACorpo ? 0
    : Math.max(0, 1 - (scene.time.now - estado.ultimoDisparo) / 65);
  estado.clarao.setPosition(pose.cano.x, pose.cano.y).setAlpha(claridade)
    .setScale(0.5 + claridade).setDepth(estado.sprite.depth + 0.01)
    .setVisible(estado.sprite.visible && claridade > 0);
  // Reusa os pixels originais da palma por cima da empunhadura, sem desenhar dedos.
  if (pose.socketMedido && estado.sprite.setCrop) {
    estado.maoSobreArma ??= scene.add.image(0, 0, scene.player.texture.key, scene.player.frame.name);
    const p = scene.player, local = pose.socket.local;
    estado.maoSobreArma.setTexture(p.texture.key, p.frame.name)
      .setPosition(p.x, p.y).setOrigin(p.originX, p.originY)
      .setScale(p.scaleX, p.scaleY).setFlipX(p.flipX).setRotation(p.rotation)
      .setCrop(local.x - 9, local.y - 9, 18, 18)
      .setDepth(p.depth + 0.0002).setAlpha(p.alpha)
      .setVisible(estado.sprite.visible && !estado.armaAtras);
  } else estado.maoSobreArma?.setVisible(false);
  atualizarDebugEncaixe(scene, estado);
}

/** Varredura contínua: mesmo com delta longo, só o primeiro obstáculo/alvo recebe o tiro. */
function moverLaser(scene, laser, inicio, fim) {
  let impacto = null;
  const testar = (area, alvo = null) => {
    if (!area) return;
    const tempo = tempoImpactoFlecha(inicio, fim, laser.direcao, area, 13, 3);
    if (tempo !== null && (!impacto || tempo < impacto.tempo)) impacto = { tempo, alvo };
  };
  for (const corpo of obstaculosFlecha(scene, inicio, fim)) testar(corpo);
  for (const alvo of alvosDaCena(scene)) testar(alvo.hitboxDano ?? alvo.body, alvo);
  const proporcao = impacto?.tempo ?? 1;
  laser.sprite.setPosition(inicio.x + (fim.x - inicio.x) * proporcao,
    inicio.y + (fim.y - inicio.y) * proporcao);
  if (impacto) {
    if (eAlvoAdicionalCombate(scene, impacto.alvo)) causarDanoAlvoAdicional(scene, impacto.alvo, laser.dano, null, laser);
    else if (impacto.alvo === scene.bossFinal && impacto.alvo) causarDanoBoss(scene, laser.dano);
    else if (impacto.alvo) causarDanoInimigo(scene, impacto.alvo, laser.dano);
    laser.sprite.destroy();
  }
}

export function dispararLaserPersonagemTeste(scene) {
  const estado = scene.armaPersonagemTeste;
  if (!estado || estado.config.tipo === "espada" || estado.config.tipo === "florete" || !podeDisparar(scene) ||
    scene.time.now < estado.proximoDisparo) return false;
  const config = estado.config;
  estado.proximoDisparo = scene.time.now + config.intervaloDisparos;
  estado.ultimoDisparo = scene.time.now;
  atualizarPose(scene, estado);
  const { cano, mao, angulo, direcao } = estado.pose;
  const sprite = scene.add.rectangle(cano.x, cano.y, 24, 4, 0xeaffff)
    .setStrokeStyle(2, 0x26dfff).setRotation(angulo).setDepth(estado.sprite.depth + 0.02)
    .setBlendMode(Phaser.BlendModes.ADD);
  const laser = { sprite, direcao: { ...direcao }, distancia: 0,
    dano: config.danoLaser, velocidade: config.velocidadeLaser, alcance: config.alcanceLaser };
  // Verifica também o trecho até o cano para não atravessar uma parede encostada na arma.
  moverLaser(scene, laser, mao, cano);
  if (sprite.active) estado.lasers.push(laser);
  if (scene.cache?.audio?.exists("tiro-laser")) scene.sound.play("tiro-laser", { volume: 0.12 });
  return true;
}

export function atacarComArmaPersonagemTeste(scene, golpe = null) {
  const estado = scene.armaPersonagemTeste;
  if (estado?.config.tipo === "florete") {
    if (golpe || !podeDisparar(scene) || estado.estocada || scene.time.now < estado.proximoDisparo) return false;
    atualizarPose(scene, estado);
    estado.proximoDisparo = scene.time.now + estado.config.intervaloDisparos;
    iniciarEstocada(scene, estado);
    atualizarPose(scene, estado);
    return true;
  }
  if (estado?.config.tipo !== "espada") return golpe ? false : dispararLaserPersonagemTeste(scene);
  if (golpe && !estado.config.golpes.includes(golpe)) return false;
  if (!podeDisparar(scene)) return false;
  const combo = obterPersonagemTeste(scene).combo;
  if (estado.golpeEspada) {
    if (!combo || golpe || estado.comboPendente) return false;
    const atual = estado.golpeEspada, g = atual.config;
    const fimEfeito = g.preparo + g.quadros * g.msPorQuadro;
    if (atual.tempo < fimEfeito - combo.buffer) return false;
    estado.comboPendente = true;
    return true;
  }
  if (!combo && scene.time.now < estado.proximoDisparo) return false;
  if (combo && scene.time.now > estado.comboAte) estado.proximoGolpe = 0;
  iniciarAtaqueEspada(scene, estado, golpe);
  return true;
}

function iniciarAtaqueEspada(scene, estado, golpe = null, anguloAnterior = null) {
  const combo = obterPersonagemTeste(scene).combo;
  const sequencia = estado.config.sequencia ?? estado.config.golpes;
  const g = golpe ?? (combo ? sequencia[estado.proximoGolpe] : estado.config.golpe);
  atualizarPose(scene, estado);
  estado.proximoDisparo = scene.time.now + estado.config.intervaloDisparos;
  iniciarGolpeEspada(scene, estado, g, anguloAnterior);
  if (combo) {
    estado.proximoGolpe = (sequencia.indexOf(g) + 1) % sequencia.length;
    estado.comboPendente = false;
  }
  atualizarPose(scene, estado);
}

export function atualizarArmaPersonagemTeste(scene, delta = 0) {
  const estado = scene.armaPersonagemTeste;
  if (!estado) return;
  if (!scene.player?.active || !personagemTesteAtivo(scene)) {
    scene.limparArmaPersonagemTeste();
    return;
  }
  atualizarPose(scene, estado);
  if (estado.estocada) {
    if (!podeDisparar(scene)) cancelarEstocada(estado);
    else atualizarEstocada(scene, estado, alvosDaCena(scene));
  }
  if (estado.golpeEspada) {
    if (!podeDisparar(scene)) {
      cancelarGolpeEspada(estado);
      estado.comboPendente = false;
      estado.proximoGolpe = 0;
      estado.comboAte = 0;
    } else {
      const atual = estado.golpeEspada, g = atual.config;
      atualizarGolpeEspada(scene, estado, alvosDaCena(scene));
      const combo = obterPersonagemTeste(scene).combo;
      if (combo) {
        estado.comboAte = scene.time.now + combo.janela;
        if (estado.comboPendente && atual.tempo >= g.preparo + g.quadros * g.msPorQuadro) {
          const anguloAnterior = estado.pose.angulo;
          cancelarGolpeEspada(estado);
          iniciarAtaqueEspada(scene, estado, null, anguloAnterior);
        }
      }
    }
  }
  // O dano pode remover um inimigo; cada laser resolve somente o primeiro impacto.
  for (const laser of estado.lasers) {
    if (!laser.sprite.active) continue;
    const passo = Math.min(Math.max(0, delta) / 1000 * laser.velocidade,
      laser.alcance - laser.distancia);
    const inicio = { x: laser.sprite.x, y: laser.sprite.y };
    moverLaser(scene, laser, inicio, { x: inicio.x + laser.direcao.x * passo,
      y: inicio.y + laser.direcao.y * passo });
    laser.distancia += passo;
    if (laser.distancia >= laser.alcance && laser.sprite.active) laser.sprite.destroy();
  }
  estado.lasers = estado.lasers.filter(laser => laser.sprite.active);
  const config = estado.config;
  if (config.disparoAutomatico && estado.alvo?.active && !estado.alvo.morto &&
    (estado.alvo.vida ?? 1) > 0) atacarComArmaPersonagemTeste(scene);
}

function prepararQuadroArma(scene, config) {
  const textura = scene.textures.get(config.textura);
  textura.setSmoothPixelArt?.(false);
  if (globalThis.Phaser?.Textures?.FilterMode) textura.setFilter?.(Phaser.Textures.FilterMode.NEAREST);
  if (!textura.has("arma")) {
    const r = config.recorte;
    textura.add("arma", 0, r.x, r.y, r.largura, r.altura);
  }
}

/** Alterna somente entre armas cadastradas; uma única arma permanece equipada. */
export function trocarArmaPersonagemTeste(scene) {
  const estado = scene.armaPersonagemTeste;
  const armas = obterArmasPersonagemTeste(scene);
  if (!estado || estado.golpeEspada || estado.estocada || !podeDisparar(scene) || armas.length < 2) return false;
  const indice = armas.indexOf(estado.config);
  const config = armas[(indice + 1) % armas.length];
  prepararQuadroArma(scene, config);
  estado.config = config;
  estado.armaAtras = false;
  estado.proximoGolpe = 0;
  estado.comboAte = 0;
  estado.comboPendente = false;
  estado.estocadasConsecutivas = 0;
  estado.floreteComboAte = 0;
  estado.sprite.setTexture(config.textura, "arma");
  scene.game?.registry?.set(`${scene.personagemSelecionada}-arma-equipada`, config.id);
  atualizarPose(scene, estado);
  return true;
}

/** O POST_UPDATE acompanha a posição física final nas duas fases, sem alterar suas cenas. */
export function criarArmaPersonagemTeste(scene) {
  if (!personagemTesteAtivo(scene)) return;
  scene.limparArmaPersonagemTeste?.();
  const config = obterArmaPersonagemTeste(scene);
  prepararQuadroArma(scene, config);
  const sprite = scene.add.image(scene.player.x, scene.player.y, config.textura, "arma")
    .setOrigin(config.empunhadura.x / config.recorte.largura,
      config.empunhadura.y / config.recorte.altura);
  const clarao = scene.add.circle(0, 0, 3, 0xb7ffff).setBlendMode(Phaser.BlendModes.ADD);
  scene.armaPersonagemTeste = { config, sprite, clarao, lasers: [], golpeEspada: null, estocada: null, alvo: null,
    direcao: { ...(DIRECOES[scene.direcaoAtual] ?? DIRECOES.down) },
    ultimoDisparo: -Infinity, proximoDisparo: 0, armaAtras: false,
    proximoGolpe: 0, comboPendente: false, comboAte: 0,
    estocadasConsecutivas: 0, floreteComboAte: 0 };
  const atualizar = (_time, delta) => atualizarArmaPersonagemTeste(scene, delta);
  // Atalhos temporários da espada, removidos junto com a arma ao trocar de cena/respawn.
  const teclado = scene.input?.keyboard;
  const atalhos = (obterArmasPersonagemTeste(scene).find(arma => arma.tipo === "espada")?.golpes ?? [])
    .map(golpe => {
      const evento = "keydown-" + golpe.tecla;
      const atacar = event => {
        if (!event?.repeat) atacarComArmaPersonagemTeste(scene, golpe);
      };
      teclado?.on(evento, atacar);
      return { evento, atacar };
    });
  const limpar = () => {
    scene.events.off("postupdate", atualizar);
    scene.events.off("shutdown", limpar);
    for (const { evento, atacar } of atalhos) teclado?.off(evento, atacar);
    const estado = scene.armaPersonagemTeste;
    if (estado) {
      cancelarGolpeEspada(estado);
      cancelarEstocada(estado);
    }
    estado?.lasers.forEach(laser => laser.sprite.destroy());
    estado?.sprite.destroy();
    estado?.clarao.destroy();
    estado?.debugEncaixe?.destroy();
    estado?.maoSobreArma?.destroy();
    scene.armaPersonagemTeste = null;
    scene.limparArmaPersonagemTeste = null;
  };
  scene.limparArmaPersonagemTeste = limpar;
  scene.events.on("postupdate", atualizar);
  scene.events.once("shutdown", limpar);
  atualizarPose(scene, scene.armaPersonagemTeste);
}
