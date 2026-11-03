/** Estocada isolada: guarda, extensão, rastro curto e pequeno avanço pela física Arcade. */
import { obstaculosFlecha, tempoImpactoFlecha } from "./ArrowCollision.js";
import { causarDanoInimigo } from "../enemies/EnemyHealth.js";
import { causarDanoBoss } from "../enemies/BossFinal.js";
import { jogadorPresoNovoBoss } from "./PlayerControlEffects.js";
import { eAlvoAdicionalCombate, causarDanoAlvoAdicional } from "../combat/CombatTargets.js";

const suave = t => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };
const rad = graus => graus * Math.PI / 180;

export function calcularFaseFlorete(config, tempo, dash = false) {
  const g = config.estocada, avancar = dash ? g.avancarDash : g.avancar;
  const fimAvanco = g.preparo + avancar;
  let extensao = 0, angulo = g.anguloRepouso, impulso = 0, alpha = 0;
  if (tempo < g.preparo) {
    const q = suave(tempo / g.preparo);
    extensao = -g.recuo * q;
    angulo += (-4 - angulo) * q;
  } else if (tempo < fimAvanco) {
    const q = (tempo - g.preparo) / avancar, rapido = 1 - (1 - q) ** 3;
    extensao = -g.recuo + (g.extensao + g.recuo) * rapido;
    angulo = -4 * (1 - rapido);
    impulso = (dash ? g.velocidadeDash : g.velocidadeImpulso) * Math.sin(Math.PI * q);
    alpha = Math.sin(Math.PI * Math.min(0.85, q));
  } else {
    const q = suave((tempo - fimAvanco) / g.recuperar);
    extensao = g.extensao * (1 - q);
    angulo *= q;
    alpha = Math.max(0, 1 - (tempo - fimAvanco) / 70) * 0.45;
  }
  return { extensao, angulo: rad(angulo), impulso, alpha,
    ativo: tempo >= g.preparo && tempo < fimAvanco,
    terminou: tempo >= fimAvanco + g.recuperar };
}

function tempoAtual(scene, golpe) {
  // Evita saltar do preparo ao fim da estocada durante um travamento.
  return golpe.tempo + Math.min(40, Math.max(0, scene.time.now - golpe.ultimoRelogio));
}

export function aplicarPoseFlorete(scene, estado, pose) {
  const golpe = estado.estocada, config = estado.config;
  if (golpe) {
    golpe.tempo = tempoAtual(scene, golpe);
    golpe.ultimoRelogio = Math.max(golpe.ultimoRelogio, scene.time.now);
  }
  const fase = calcularFaseFlorete(config, golpe?.tempo ?? 0, golpe?.dash);
  const lado = pose.esquerda ? -1 : 1;
  const maoAtaque = { x: pose.mao.x + Math.cos(pose.angulo) * fase.extensao,
    y: pose.mao.y + Math.sin(pose.angulo) * fase.extensao };
  // As folhas não têm braço estendido. A mão medida fica presa ao cabo;
  // o rastro já existente mostra a extensão exata da área de estocada.
  if (pose.socketMedido) pose.maoAtaque = maoAtaque;
  else Object.assign(pose.mao, maoAtaque);
  pose.angulo += fase.angulo * lado;
  pose.rotacaoSprite = pose.angulo - config.anguloArte * lado;
  const alcance = Math.hypot(config.cano.x - config.empunhadura.x,
    config.cano.y - config.empunhadura.y) * pose.escala;
  pose.cano = { x: pose.mao.x + Math.cos(pose.angulo) * alcance,
    y: pose.mao.y + Math.sin(pose.angulo) * alcance };
  pose.pontaAtaque = { x: maoAtaque.x + Math.cos(pose.angulo) * alcance,
    y: maoAtaque.y + Math.sin(pose.angulo) * alcance };
}

export function iniciarEstocada(scene, estado) {
  if (scene.time.now > estado.floreteComboAte) estado.estocadasConsecutivas = 0;
  estado.estocadasConsecutivas = (estado.estocadasConsecutivas % 3) + 1;
  const angulo = estado.pose.angulo - rad(estado.config.estocada.anguloRepouso) *
    (estado.pose.esquerda ? -1 : 1);
  estado.estocada = { tempo: 0, ultimoRelogio: scene.time.now, angulo,
    numero: estado.estocadasConsecutivas, dash: estado.estocadasConsecutivas === 3,
    esquerda: estado.pose.esquerda, direcao: { x: Math.cos(angulo), y: Math.sin(angulo) },
    efeito: scene.add.graphics(), acertados: new Set(), ultimoTempo: 0,
    ultimaMao: { ...estado.pose.mao }, impactoAte: 0 };
  if (scene.cache?.audio?.exists("ataque-no-ar")) {
    scene.sound.play("ataque-no-ar", { volume: 0.1, rate: 1.2 });
  }
}

/** Soma somente velocidade: colisões, dash e impulso de dano continuam tendo prioridade. */
export function obterImpulsoFlorete(scene) {
  const estado = scene.armaPersonagemTeste, golpe = estado?.estocada;
  if (!golpe || !scene.player?.active || scene.morteEmAndamento || scene.generatorMenuOpen ||
    scene.movimentoBloqueado || jogadorPresoNovoBoss(scene) || (scene.vida ?? 1) <= 0) return null;
  const fase = calcularFaseFlorete(estado.config, tempoAtual(scene, golpe), golpe.dash);
  if (fase.impulso <= 0) return null;
  const delta = Math.max(1, scene.game?.loop?.delta ?? 16.67);
  // O terceiro golpe avança de verdade; o limite por passo continua menor que
  // a largura do corpo para preservar a colisão mesmo em quedas de FPS.
  const passoMaximo = golpe.dash ? 12 : 4;
  const velocidade = Math.min(fase.impulso, passoMaximo * 1000 / delta);
  return { x: golpe.direcao.x * velocidade, y: golpe.direcao.y * velocidade,
    controle: golpe.dash ? 0 : 0.4 };
}

function testarDano(scene, estado, alvos) {
  const golpe = estado.estocada, config = estado.config, g = config.estocada;
  const inicio = Math.max(golpe.ultimoTempo, g.preparo);
  const fim = Math.min(golpe.tempo, g.preparo + (golpe.dash ? g.avancarDash : g.avancar) - 0.001);
  if (inicio > fim) return;
  const alcance = Math.hypot(config.cano.x - config.empunhadura.x,
    config.cano.y - config.empunhadura.y) * estado.pose.escala;
  const passos = Math.max(1, Math.ceil((fim - inicio) / 6));
  for (let i = 0; i <= passos; i++) {
    const t = inicio + (fim - inicio) * i / passos;
    const p = golpe.tempo > golpe.ultimoTempo ? (t - golpe.ultimoTempo) / (golpe.tempo - golpe.ultimoTempo) : 1;
    const atual = estado.pose.maoAtaque ?? estado.pose.mao;
    const mao = { x: golpe.ultimaMao.x + (atual.x - golpe.ultimaMao.x) * p,
      y: golpe.ultimaMao.y + (atual.y - golpe.ultimaMao.y) * p };
    const angulo = golpe.angulo + calcularFaseFlorete(config, t, golpe.dash).angulo * (golpe.esquerda ? -1 : 1);
    const direcao = { x: Math.cos(angulo), y: Math.sin(angulo) };
    const ponta = { x: mao.x + direcao.x * alcance, y: mao.y + direcao.y * alcance };
    let parede = Infinity;
    for (const corpo of obstaculosFlecha(scene, mao, ponta, 2)) {
      const impacto = tempoImpactoFlecha(mao, ponta, direcao, corpo, 0, 1.5);
      if (impacto !== null) parede = Math.min(parede, impacto);
    }
    for (const alvo of alvos) {
      if (!alvo.active || alvo.morto || golpe.acertados.has(alvo)) continue;
      const area = alvo.hitboxDano ?? alvo.body;
      if (!area) continue;
      const impacto = tempoImpactoFlecha(mao, ponta, direcao, area, 0, 1.5);
      if (impacto === null || impacto >= parede) continue;
      golpe.acertados.add(alvo);
      if (eAlvoAdicionalCombate(scene, alvo)) causarDanoAlvoAdicional(scene, alvo, config.dano);
      else if (alvo === scene.bossFinal) causarDanoBoss(scene, config.dano);
      else causarDanoInimigo(scene, alvo, config.dano);
      golpe.impactoAte = golpe.tempo + 50;
      if (scene.cache?.audio?.exists("katana-ataque")) {
        scene.sound.play("katana-ataque", { volume: 0.09, rate: 1.25 });
      }
    }
  }
}

export function atualizarEstocada(scene, estado, alvos) {
  const golpe = estado.estocada;
  testarDano(scene, estado, alvos);
  golpe.ultimoTempo = golpe.tempo;
  golpe.ultimaMao = { ...(estado.pose.maoAtaque ?? estado.pose.mao) };
  const fase = calcularFaseFlorete(estado.config, golpe.tempo, golpe.dash);
  estado.floreteComboAte = scene.time.now + estado.config.estocada.janelaCombo;
  const efeito = golpe.efeito, ponta = estado.pose.cano;
  efeito.clear().setPosition(ponta.x, ponta.y).setRotation(estado.pose.angulo)
    .setDepth(estado.sprite.depth + (estado.pose.socketMedido ? 0.00003 : 0.02)).setAlpha(fase.alpha * scene.player.alpha)
    .setVisible(estado.sprite.visible && fase.alpha > 0);
  // Rastro estreito e afunilado junto à ponta: acompanha a lâmina, sem virar projétil.
  const rastro = golpe.dash ? 22 : 18;
  efeito.fillStyle(estado.config.corRastro ?? 0xc6f7ff, 0.35).fillTriangle(-rastro, -2.2, 7, 0, -rastro, 2.2);
  efeito.lineStyle(1, 0xf5fcff, 0.95).lineBetween(-rastro, 0, 6, 0);
  efeito.lineStyle(0.7, 0x91d7ed, 0.65).lineBetween(-18, -3.5, -3, -1.5)
    .lineBetween(-18, 3.5, -3, 1.5);
  if (estado.pose.socketMedido && fase.ativo) {
    const destino = estado.pose.pontaAtaque;
    const dx = destino.x - ponta.x, dy = destino.y - ponta.y;
    const a = estado.pose.angulo;
    const x = dx * Math.cos(a) + dy * Math.sin(a);
    const y = -dx * Math.sin(a) + dy * Math.cos(a);
    efeito.lineStyle(1.5, estado.config.corRastro ?? 0xc6f7ff, 0.6).lineBetween(0, 0, x, y);
    efeito.lineStyle(0.65, 0xffffff, 1).lineBetween(0, 0, x, y);
  }
  if (golpe.tempo < golpe.impactoAte) {
    efeito.lineStyle(1, 0xffefc9, 1).lineBetween(0, -5, 0, 5).lineBetween(-4, -3, 4, 3);
  }
  if (fase.terminou) cancelarEstocada(estado, false);
}

export function cancelarEstocada(estado, reiniciarCombo = true) {
  estado.estocada?.efeito.destroy();
  estado.estocada = null;
  if (reiniciarCombo) {
    estado.estocadasConsecutivas = 0;
    estado.floreteComboAte = 0;
  }
}
