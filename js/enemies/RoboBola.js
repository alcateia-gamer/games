import { obterBalanceamentoInimigos } from "./EnemyBalance.js";
import { atorRelevante, atualizarDecisaoAtor, atualizarBarrasDistantes } from "../core/ActorActivity.js";
/**
 * IA exclusiva do Robo Bola: inimigo voador que orbita o jogador, flutua em uma
 * onda vertical e dispara pelo olho na direção atual do alvo.
 */

import { calcularDepthAtor } from "../map/ProfundidadeMapa.js";
import { configurarSomPropulsaoRoboBola } from "../sounds/propulsaoRoboBola.js";
import { tocarSomTiroLaser } from "../sounds/inimigos.js";
import { caminhoDiretoBloqueado, caminhoMovimentoBloqueado, retanguloLivreDoMapa } from "./EnemyPathfinding.js";
import { atualizarIAInimigo, moverInimigoAte } from "./EnemyAI.js";
import { suavizarTexturasRoboBola, criarBrilhoOlho, criarRastroPlasma } from "./RoboBolaEffects.js";
import { protegerColisaoRoboBola } from "./RoboBolaColisao.js";
import { ROBO_BOLA_FLUTUACAO } from "./RoboBolaFlutuacao.js";
import { atualizarEmergenciaRoboBola, EMERGENCIA_ROBO_BOLA } from "./RoboBolaEmergencia.js";

// Grade viva 2×3: frente, disparo frontal, costas, esquerda, direita, vazio.
// A morte usa as mesmas poses, cada uma em uma linha de quatro quadros.
const POSES = Object.freeze({
  down: { frame: 0, morte: 0, angulo: Math.PI / 2, olho: { x: 63, y: 59 } },
  left: { frame: 3, morte: 8, angulo: Math.PI, olho: { x: 40, y: 56 } },
  right: { frame: 4, morte: 12, angulo: 0, olho: { x: 87, y: 56 } },
  up: { frame: 2, morte: 4, angulo: -Math.PI / 2, olho: { x: 63, y: 43 } },
});

const CONFIG = Object.freeze({
  velocidade: 145,
  velocidadeOrbita: 100,
  velocidadeRecuo: 175,
  distanciaIdeal: 135,
  distanciaMinima: 100,
  distanciaMaxima: 180,
  intervaloTiro: 1100,
  tempoCarga: 240,
  alcanceTiro: 300,
  velocidadeProjetil: 280,
  dano: 10,
});

const TAMANHO_HITBOX = 60; // Pixels da folha, antes da escala visual de 0,56.
const ALTURA_BARRA_VIDA = 36; // Mantém uma pequena folga acima da antena.

function atualizarHitboxRoboBola(robo) {
  const largura = (robo.perfilVoador?.hitbox ?? TAMANHO_HITBOX) * Math.abs(robo.scaleX);
  const altura = (robo.perfilVoador?.hitbox ?? TAMANHO_HITBOX) * Math.abs(robo.scaleY);
  robo.hitboxDano?.setTo(robo.x - largura / 2, robo.y + (robo.deslocamentoFlutuacao || 0) - altura / 2, largura, altura);
}

/** Move só a imagem: a colisão de navegação permanece estável sobre o chão. */
function atualizarFlutuacao(robo, time, delta = 0) {
  robo.faseFlutuacaoAtual = time / ROBO_BOLA_FLUTUACAO.periodoMs * Math.PI * 2 +
    (robo.faseFlutuacao || 0);
  // O centro visual nasce na abertura; a oscilação entra junto com a saída física.
  const saida = robo.emergenciaPortal;
  const progresso = saida ? Math.min(1, (saida.tempo + Math.max(0, delta)) / EMERGENCIA_ROBO_BOLA.duracaoMs) : 1;
  robo.deslocamentoFlutuacao = Math.sin(robo.faseFlutuacaoAtual) * ROBO_BOLA_FLUTUACAO.amplitude * progresso;
  const deslocamentoLocal = robo.deslocamentoFlutuacao / robo.scaleY;
  const tamanho = robo.perfilVoador?.tamanho ?? 127;
  robo.setOrigin(0.5, 0.5 - deslocamentoLocal / tamanho);
  const offset = (tamanho - (robo.perfilVoador?.hitbox ?? TAMANHO_HITBOX)) / 2;
  robo.body.setOffset(offset, offset - deslocamentoLocal);
}

function escolherSpawn(scene, perfil) {
  const anguloInicial = Math.random() * Math.PI * 2;
  const tamanho = (perfil?.hitbox ?? TAMANHO_HITBOX) * (perfil?.escala ?? 0.56);
  for (const raio of [perfil?.config.distanciaIdeal ?? CONFIG.distanciaIdeal, 180, 225, 270]) {
    for (let i = 0; i < 24; i++) {
      const angulo = anguloInicial + i * Math.PI / 12;
      const x = scene.player.x + Math.cos(angulo) * raio;
      const y = scene.player.y + Math.sin(angulo) * raio;
      if (!retanguloLivreDoMapa(scene, { x: x - tamanho / 2, y: y - tamanho / 2, width: tamanho, height: tamanho })) continue;
      if ((scene.inimigos || []).some(outro => outro?.active && !outro.morto && Math.hypot(outro.x - x, outro.y - y) < 50)) continue;
      return { x, y };
    }
  }
  return null; // Não cria um robô dentro de paredes quando não há espaço próximo.
}

function registrarAnimacoes(scene) {
  for (const [direcao, pose] of Object.entries(POSES)) {
    const chave = `robo-bola-morte-${direcao}`;
    if (!scene.anims.exists(chave)) {
      scene.anims.create({
        key: chave,
        frames: scene.anims.generateFrameNumbers("robo-bola-morte", {
          start: pose.morte, end: pose.morte + 3,
        }),
        frameRate: 14,
        repeat: 0,
      });
    }
  }
}

function direcaoParaAlvo(robo, alvo) {
  const dx = alvo.x - robo.x;
  const dy = alvo.y - robo.y;
  const atual = POSES[robo.direcaoAtual];
  if (atual) {
    if (Math.hypot(dx, dy) < 2) return robo.direcaoAtual;
    const diferenca = Math.atan2(dy, dx) - atual.angulo;
    const desvio = Math.abs(Math.atan2(Math.sin(diferenca), Math.cos(diferenca)));
    // 12° de margem nas diagonais: continua seguindo o alvo, sem alternar a cada frame.
    if (desvio <= Math.PI / 4 + Math.PI / 15) return robo.direcaoAtual;
  }
  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx < 0 ? "left" : "right";
  }
  return dy < 0 ? "up" : "down";
}

function atualizarFrame(robo, atirando = false) {
  if (robo.perfilVoador?.atualizarFrame) return robo.perfilVoador.atualizarFrame(robo, atirando);
  robo.setFlipX(false);
  robo.anims.stop();
  // O único frame de disparo é o frontal. Nas outras direções o olho não pisca.
  const frameDeDisparo = atirando && robo.direcaoAtual === "down" ? 1 : 0;
  robo.setFrame(POSES[robo.direcaoAtual].frame + frameDeDisparo);
}

function obterPoseMorteRoboBola(robo) {
  // Captura o frame realmente desenhado, inclusive se o golpe chegar entre atualizações.
  const frame = Number(robo.frame?.name);
  const direcao = frame === 1 ? "down" : Object.keys(POSES).find(
    (key) => POSES[key].frame === frame,
  ) || (POSES[robo.direcaoAtual] ? robo.direcaoAtual : "down");
  return { direcao, frame: POSES[direcao].morte, flipX: Boolean(robo.flipX) };
}

function obterPosicaoOlho(robo) {
  if (robo.perfilVoador?.obterOlho) return robo.perfilVoador.obterOlho(robo);
  // Os perfis mostram o olho na borda externa (não na fenda central do casco).
  // Olhando para cima, a origem é a projeção do olho na face oculta pela carcaça.
  const olho = POSES[robo.direcaoAtual].olho;
  return {
    x: robo.x + (olho.x - robo.originX * 127) * robo.scaleX,
    // Ajuste fino compartilhado pelo tiro e pelo brilho: dois pixels abaixo no jogo.
    y: robo.y + (olho.y - robo.originY * 127) * robo.scaleY + 2,
  };
}

function criarProjetil(scene, robo, alvo) {
  if (robo.perfilVoador?.criarProjetil) return robo.perfilVoador.criarProjetil(scene, robo, alvo);
  const olho = obterPosicaoOlho(robo);
  const angulo = Phaser.Math.Angle.Between(olho.x, olho.y, alvo.x, alvo.y);
  const comprimento = 16;
  const espessura = 3;
  const cos = Math.cos(angulo);
  const sin = Math.sin(angulo);
  // A cauda do traço nasce no olho, sem o antigo afastamento de 32 pixels.
  const projetil = scene.add.rectangle(
    olho.x + cos * comprimento / 2,
    olho.y + sin * comprimento / 2,
    comprimento,
    espessura,
    0xd8faff,
    1,
  );
  projetil.setRotation(angulo).setDepth(56).setStrokeStyle(0.5, 0xa9e5ff, 1);
  projetil.especialLaserInimigo = true;
  projetil.especialAtirador = robo;
  projetil.danoEspecial = 0;
  projetil.danoLaser = robo.danoLaser;
  scene.physics.add.existing(projetil);
  projetil.body.setAllowGravity(false);
  scene.lasersInimigo.add(projetil);
  // Arcade não gira a hitbox: ajusta a caixa ao traço já orientado.
  projetil.body.setSize(
    Math.abs(cos) * comprimento + Math.abs(sin) * espessura,
    Math.abs(sin) * comprimento + Math.abs(cos) * espessura,
  );
  projetil.body.updateFromGameObject();
  scene.physics.velocityFromRotation(angulo, robo.velocidadeLaser, projetil.body.velocity);
  criarRastroPlasma(scene, projetil);
  const expiracao = scene.time.delayedCall(2200, () => projetil.active && projetil.destroy());
  projetil.once("destroy", () => expiracao?.remove(false));
  tocarSomTiroLaser(scene, robo);
}

function criarRoboBola(scene, posicao = null, perfil = null) {
  if (!scene?.player?.active) return null;
  const spawn = posicao ?? escolherSpawn(scene, perfil);
  if (!spawn) return null;
  if (posicao) {
    const tamanho = (perfil?.hitbox ?? TAMANHO_HITBOX) * (perfil?.escala ?? 0.56);
    if (![spawn.x, spawn.y].every(Number.isFinite) ||
        !retanguloLivreDoMapa(scene, { x: spawn.x - tamanho / 2, y: spawn.y - tamanho / 2,
          width: tamanho, height: tamanho }) ||
        Math.hypot(scene.player.x - spawn.x, scene.player.y - spawn.y) < 70 ||
        (scene.inimigos ?? []).some(outro => outro?.active && !outro.morto &&
          Math.hypot(outro.x - spawn.x, outro.y - spawn.y) < 50)) return null;
  }

  if (perfil) perfil.registrarAnimacoes(scene);
  else registrarAnimacoes(scene);
  suavizarTexturasRoboBola(scene);
  if (perfil) scene.textures.get(perfil.textura).setFilter(Phaser.Textures.FilterMode.LINEAR);
  const robo = scene.physics.add.sprite(
    spawn.x,
    spawn.y,
    perfil?.textura ?? "robo-bola",
    0,
  );
  robo.origemSpawn = { x: spawn.x, y: spawn.y };
  robo.perfilVoador = perfil;
  robo.tipoRobo = perfil?.tipo ?? "bola";
  robo.morto = false;
  // Cada perfil conserva o porte pequeno com sua própria resolução de folha.
  robo.setScale(perfil?.escala ?? 0.56);
  robo.body.setAllowGravity(false);
  const hitbox = perfil?.hitbox ?? TAMANHO_HITBOX;
  const offsetHitbox = ((perfil?.tamanho ?? 127) - hitbox) / 2;
  robo.body.setSize(hitbox, hitbox).setOffset(offsetHitbox, offsetHitbox);
  robo.configBola = { ...CONFIG, ...perfil?.config };
  robo.velocidade = robo.configBola.velocidade;
  robo.distanciaDeteccao = 760;
  robo.distanciaAtaque = robo.configBola.alcanceTiro;
  robo.patrolCenter = { ...spawn };
  robo.formacaoIndex = scene.inimigos?.length || 0;
  robo.faseFlutuacao = Math.random() * Math.PI * 2;
  robo.body.updateFromGameObject();
  robo.tempoOnda = Math.random() * Math.PI * 2;
  robo.ultimoTiro = scene.time.now;
  robo.sentidoOrbita = Math.random() < 0.5 ? -1 : 1;
  robo.proximaManobra = scene.time.now + 3200 + Math.random() * 1600;
  const balanceamento = obterBalanceamentoInimigos(scene).bola;
  robo.vidaMaxima = balanceamento.vida;
  robo.vida = robo.vidaMaxima;
  robo.danoLaser = balanceamento.dano;
  robo.velocidadeLaser = robo.configBola.velocidadeProjetil;
  robo.direcaoAtual = direcaoParaAlvo(robo, scene.player);
  robo.hitboxDano = new Phaser.Geom.Rectangle(0, 0, 0, 0);
  atualizarHitboxRoboBola(robo);
  robo.larguraBarra = 54;
  const alturaBarra = perfil?.alturaBarra ?? ALTURA_BARRA_VIDA;
  robo.fundoVida = scene.add.rectangle(robo.x, robo.y - alturaBarra, 54, 5, 0x111111, 0.9).setDepth(61);
  robo.barraVida = scene.add.rectangle(robo.x - 27, robo.y - alturaBarra, 54, 5, 0xe52b2b, 1)
    .setOrigin(0, 0.5).setDepth(62);
  robo.bordaVida = scene.add.rectangle(robo.x, robo.y - alturaBarra, 54, 5).setStrokeStyle(1, 0xffffff, 0.7).setDepth(63);
  atualizarFrame(robo);
  if (!perfil) criarBrilhoOlho(scene, robo, obterPosicaoOlho);
  configurarSomPropulsaoRoboBola(scene, robo);
  // O Phaser destrói o grupo antes de alguns listeners de shutdown; a cena pode ser reutilizada.
  if (!scene.lasersInimigo || ("scene" in scene.lasersInimigo && !scene.lasersInimigo.scene)) {
    scene.lasersInimigo = scene.physics.add.group();
  }
  scene.inimigos ||= [];
  const colliders = [];
  for (const aliado of scene.inimigos) {
    if (aliado?.active && !aliado.morto) colliders.push(scene.physics.add.collider(robo, aliado));
  }
  scene.inimigos.push(robo);
  scene.inimigoTeste ||= robo;
  if (scene.collisionGroup) colliders.push(scene.physics.add.collider(robo, scene.collisionGroup));
  robo.once("destroy", () => colliders.forEach(collider => collider.destroy()));
  protegerColisaoRoboBola(scene, robo);
  return robo;
}

function atualizarCombateRoboBola(scene, robo, alvo, time, delta) {
    const distancia = Phaser.Math.Distance.Between(robo.x, robo.y, alvo.x, alvo.y);
    const dt = Math.min(delta, 100);
    robo.tempoOnda += dt / 520;
    // Se o jogador chegar ao mesmo ponto, ainda existe uma direção de fuga definida.
    const dx = distancia > 1 ? (alvo.x - robo.x) / distancia : Math.cos(POSES[robo.direcaoAtual].angulo);
    const dy = distancia > 1 ? (alvo.y - robo.y) / distancia : Math.sin(POSES[robo.direcaoAtual].angulo);
    const aproximacao = Math.max(0,
      -(alvo.body?.velocity?.x ?? 0) * dx - (alvo.body?.velocity?.y ?? 0) * dy,
    );
    // Combina circulação, reposicionamento e preparação do tiro, sem virar as costas.
    robo.sentidoOrbita ??= 1;
    robo.proximaManobra ??= time + 4000;
    const bloqueado = robo.body.blocked;
    const tocandoParede = bloqueado?.left || bloqueado?.right || bloqueado?.up || bloqueado?.down;
    if (time >= robo.proximaManobra || (tocandoParede && time >= (robo.desvioLiberadoEm || 0))) {
      robo.sentidoOrbita *= -1;
      robo.proximaManobra = time + 3200 + Math.random() * 1600;
      robo.desvioLiberadoEm = time + 900;
    }
    robo.recuando = distancia < robo.configBola.distanciaMinima ||
      (distancia < robo.configBola.distanciaMaxima && aproximacao > 20);
    let radial = Phaser.Math.Clamp(
      (distancia - robo.configBola.distanciaIdeal) * 2.5,
      -robo.configBola.velocidadeRecuo,
      robo.configBola.velocidade,
    );
    if (robo.recuando) {
      radial = -Math.min(robo.configBola.velocidadeRecuo,
        Math.max(80, aproximacao * 0.6 + 25, (robo.configBola.distanciaIdeal - distancia) * 2),
      );
    }
    robo.direcaoAtual = direcaoParaAlvo(robo, alvo);
    const olho = obterPosicaoOlho(robo);
    const temMira = distancia <= robo.configBola.alcanceTiro &&
      !caminhoDiretoBloqueado(scene, olho, alvo);
    if (!temMira) robo.inicioCarga = null;
    else if (robo.inicioCarga == null && time >= robo.ultimoTiro + robo.configBola.intervaloTiro) {
      robo.inicioCarga = time;
    }
    robo.cargaTiro = robo.inicioCarga == null ? 0 :
      Math.min(1, (time - robo.inicioCarga) / robo.configBola.tempoCarga);
    robo.estadoBola = robo.recuando ? "recuando" : robo.inicioCarga != null ? "mirando" :
      distancia > robo.configBola.distanciaMaxima ? "aproximando" : "orbitando";
    // Órbita tangente à posição real: não persegue um ponto que dispara à frente dele.
    const variacao = 0.85 + Math.sin(time / 950) * 0.15;
    const orbita = robo.sentidoOrbita * robo.configBola.velocidadeOrbita * variacao *
      (robo.recuando ? 0.25 : robo.estadoBola === "mirando" ? 0.25 : 1);
    let vx = dx * radial + dy * orbita;
    let vy = dy * radial - dx * orbita + Math.cos(robo.tempoOnda) * 14;
    const velocidadeMaxima = robo.recuando ? robo.configBola.velocidadeRecuo : robo.configBola.velocidade;
    const limite = Math.min(1, velocidadeMaxima / Math.max(Math.hypot(vx, vy), 1));
    vx *= limite;
    vy *= limite;
    const suavidade = 1 - Math.exp(-dt / (robo.recuando ? 100 : 120));
    vx = robo.body.velocity.x + (vx - robo.body.velocity.x) * suavidade;
    vy = robo.body.velocity.y + (vy - robo.body.velocity.y) * suavidade;
    if (robo.recuando) {
      // Não deixa o impulso anterior carregar o robô na direção do jogador.
      const avancando = Math.max(0, vx * dx + vy * dy);
      vx -= dx * avancando;
      vy -= dy * avancando;
    }
    // Separa aliados sem usar sua posição para revelar o jogador escondido.
    for (const aliado of scene.inimigos || []) {
      if (aliado === robo || !aliado?.active || aliado.morto) continue;
      const ax = robo.x - aliado.x;
      const ay = robo.y - aliado.y;
      const d = Math.hypot(ax, ay);
      if (d > 0 && d < 56) {
        vx += ax / d * (56 - d) * 2;
        vy += ay / d * (56 - d) * 2;
      }
    }
    const escala = Math.min(1, velocidadeMaxima / Math.max(1, Math.hypot(vx, vy)));
    vx *= escala;
    vy *= escala;
    const destino = { x: robo.x + vx * 0.4, y: robo.y + vy * 0.4 };
    if (!caminhoMovimentoBloqueado(scene, robo, destino)) {
      robo.setVelocity(vx, vy);
    } else if (distancia > robo.configBola.distanciaMaxima) {
      moverInimigoAte(scene, robo, alvo, time, robo.velocidade, true, distancia, alvo);
    } else {
      // Perto do alvo, desliza pela lateral livre em vez de insistir contra o objeto.
      robo.setVelocity(0, 0);
      const angulo = Math.atan2(vy, vx);
      const velocidade = Math.min(90, Math.hypot(vx, vy));
      for (const desvio of [Math.PI / 4, -Math.PI / 4, Math.PI / 2, -Math.PI / 2]) {
        const sx = Math.cos(angulo + desvio) * velocidade;
        const sy = Math.sin(angulo + desvio) * velocidade;
        if (robo.recuando && sx * dx + sy * dy > 0) continue;
        if (caminhoMovimentoBloqueado(scene, robo, { x: robo.x + sx * 0.5, y: robo.y + sy * 0.5 })) continue;
        robo.setVelocity(sx, sy);
        break;
      }
    }
    robo.iaAndando = Math.hypot(robo.body.velocity.x, robo.body.velocity.y) > 1;
    const vaiAtirar = temMira && robo.cargaTiro >= 1;
    if (vaiAtirar) robo.olhoAzulAte = time + 150;
    // A pose e o cano mudam juntos, antes de criar o projétil.
    atualizarFrame(robo, time < (robo.olhoAzulAte ?? 0));
    if (vaiAtirar) {
      robo.ultimoTiro = time;
      robo.inicioCarga = null;
      robo.cargaTiro = 0;
      robo.flashDisparoAte = time + 120;
      criarProjetil(scene, robo, alvo);
    }
}

function atualizarRoboBola(scene, time, delta) {
  for (const robo of scene.inimigos || []) {
    if (!robo?.active || !["bola", "olhao"].includes(robo.tipoRobo) || robo.morto || robo.remoteOnly) continue;
    const protegendoSpawn = time < Math.max(robo.prologoProtegidoAte ?? -Infinity,
      robo.spawnProtegidoAte ?? -Infinity);
    const relevante = atorRelevante(scene, robo);
    atualizarBarrasDistantes(robo, relevante);
    const decidir = atualizarDecisaoAtor(scene, robo, time);
    if (relevante) atualizarFlutuacao(robo, time, delta);
    let combateVisivel = false;
    if (!atualizarEmergenciaRoboBola(scene, robo, delta)) {
      if (protegendoSpawn) robo.setVelocity(0, 0);
      else if (decidir) atualizarIAInimigo(scene, time, robo, (_scene, _robo, alvo) => {
        combateVisivel = true;
        atualizarCombateRoboBola(scene, robo, alvo, time, delta);
      });
    }
    if (decidir && !combateVisivel) {
      robo.inicioCarga = null;
      robo.cargaTiro = 0;
      robo.recuando = false;
      robo.estadoBola = robo.iaEstado || "patrulha";
    }
    atualizarHitboxRoboBola(robo);
    if (!relevante) continue;
    atualizarFrame(robo, time < (robo.olhoAzulAte || 0));
    const yBarra = robo.y + robo.deslocamentoFlutuacao - (robo.perfilVoador?.alturaBarra ?? ALTURA_BARRA_VIDA);
    robo.fundoVida?.setPosition(robo.x, yBarra);
    robo.barraVida?.setPosition(robo.x - 27, yBarra);
    robo.bordaVida?.setPosition(robo.x, yBarra);
    if (robo.barraVida) robo.barraVida.width = robo.larguraBarra * robo.vida / robo.vidaMaxima;
    robo.setDepth(calcularDepthAtor(scene, robo.y + 38, robo));
  }
}

export {
  criarRoboBola, atualizarRoboBola, obterPoseMorteRoboBola,
  CONFIG as ROBO_BOLA_CONFIG,
  registrarAnimacoes as registrarAnimacoesRoboBola,
};
