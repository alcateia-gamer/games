/**
 * @file Máquina de estados dos robôs: patrulha, combate, investigação e retorno. Usa visão
 * frontal, memória do alvo e navegação compartilhada.
 */

import { atualizarSomPassoRobo } from "../sounds/inimigos.js";
import {
  atualizarEstadoVisualRobo,
  tocarAnimacaoInimigo,
  tocarAnimacaoAtaqueInimigo,
  pararAnimacaoInimigo,
} from "./EnemyAnimations.js";
import {
  caminhoDiretoBloqueado,
  atualizarRotaSeguindoInimigo,
  seguirRotaAtual,
  desenharDebugRotaInimigo,
} from "./EnemyPathfinding.js";
import { causarDanoPlayer, tentarDispararLaser } from "./EnemyLaser.js";

// =====================================================
// CONFIGURACOES GERAIS DA IA
// =====================================================
// Distancias em pixels; tempos em milissegundos.

const IA = Object.freeze({
  visaoIntervalo: 180,
  visaoProxima: 100,

  memoriaAlvoMs: 5500,
  investigarMs: 2600,
  perseguicaoMaxMs: 16000,
  pausaAposDesistirMs: 4500,

  alcanceMaximoDoSpawn: 790,
  alcanceRetornoDoSpawn: 870,
  alertaAliadoRaio: 230,

  patrulhaRaio: 130,
  patrulhaEsperaMinMs: 650,
  patrulhaEsperaMaxMs: 1600,
  patrulhaTempoMaxMs: 3200,
  distanciaChegada: 22,

  atiradorRecuarAbaixo: 85,
  atiradorPararRecuo: 125,
  atiradorAproximarAcima: 170,
  atiradorPassoRecuo: 65,

  distanciaSono: 1550,
  sonoIntervalo: 750,
});

// =====================================================
// FUNCOES AUXILIARES
// =====================================================

/**
 * Calcula a distância entre dois objetos com coordenadas x e y.
 */
function distancia(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/**
 * Resolve o jogador remoto selecionado como alvo ou usa o jogador local quando não há alvo
 * remoto.
 */
function obterAlvo(scene, robo) {
  const remoto = scene.multiplayerManager?.room?.players?.find(
    (p) => p.id === robo.alvoPlayerId,
  );

  return remoto ? { ...remoto, active: true } : scene.player;
}

/**
 * Retorna o centro de patrulha do robô ou sua posição atual como referência de origem.
 */
function origem(robo) {
  return (
    robo.patrolCenter || {
      x: robo.x,
      y: robo.y,
    }
  );
}

/**
 * Escolhe a direção visual principal para que o robô olhe para o ponto informado.
 */
function olharPara(robo, ponto) {
  const dx = ponto.x - robo.x;
  const dy = ponto.y - robo.y;

  if (Math.abs(dx) > Math.abs(dy)) {
    robo.direcaoAtual = dx < 0 ? "left" : "right";
  } else if (dx !== 0 || dy !== 0) {
    robo.direcaoAtual = dy < 0 ? "up" : "down";
  }
}

/**
 * Atualiza a direção visual com base na velocidade física quando há deslocamento
 * significativo.
 */
function olharMovimento(robo) {
  const vx = robo.body?.velocity?.x || 0;
  const vy = robo.body?.velocity?.y || 0;

  if (Math.hypot(vx, vy) > 5) {
    olharPara(robo, {
      x: robo.x + vx,
      y: robo.y + vy,
    });
  }
}

/**
 * Consulta se os obstáculos do mapa deixam uma linha direta livre até o alvo.
 */
function linhaLivre(scene, robo, alvo) {
  return !caminhoDiretoBloqueado(scene, robo, alvo);
}

/**
 * Para o corpo e o som de passos sem interromper a animação de ataque ativa.
 */
function parar(scene, robo, viu = false, d = Infinity) {
  robo.setVelocity(0, 0);

  if (robo.estado !== "atacando" || !robo.anims?.isPlaying) {
    pararAnimacaoInimigo(robo);
  }

  atualizarSomPassoRobo(scene, robo, viu, d, false);
}

/**
 * Move o robô até um ponto e sincroniza direção, animação e som dos passos.
 */
function mover(scene, robo, ponto, velocidade, viu = false, d = Infinity) {
  scene.physics.moveTo(robo, ponto.x, ponto.y, velocidade);

  olharMovimento(robo);
  tocarAnimacaoInimigo(robo);

  atualizarSomPassoRobo(scene, robo, viu, d, true);
}

/**
 * Descarta os pontos e o índice de uma rota anterior.
 */
function limparRota(robo) {
  robo.rotaAtual = [];
  robo.indiceRota = 0;
}

// =====================================================
// VISAO EM SEMICIRCULO DE 180 GRAUS
// =====================================================
//
// O robo enxerga somente na metade frontal.
//
// Exemplo quando olha para cima:
//
//          VISAO
//       \         /
//        \       /
//         \     /
//          ROBO
//
//       PONTO CEGO
//
// O jogador atras do robo nao e detectado,
// nem mesmo a menos de 100 pixels.
//
// As paredes bloqueiam a visao.
//

/**
 * Testa alcance, metade frontal e obstáculos; armazena o resultado para reduzir testes de
 * visão distantes.
 */
function temVisao(scene, robo, alvo, agora) {
  const dx = alvo.x - robo.x;
  const dy = alvo.y - robo.y;

  const d = Math.hypot(dx, dy);

  const alcance = Number(robo.distanciaDeteccao) || 550;

  // ============================================
  // 1. DISTANCIA MAXIMA
  // ============================================

  if (!Number.isFinite(d) || d > alcance) {
    robo.iaViu = false;
    return false;
  }

  // ============================================
  // 2. DIRECAO FRONTAL DO ROBO
  // ============================================

  let frenteX = 0;
  let frenteY = 0;

  switch (robo.direcaoAtual) {
    case "up":
      frenteY = -1;
      break;

    case "left":
      frenteX = -1;
      break;

    case "right":
      frenteX = 1;
      break;

    case "down":
    default:
      frenteY = 1;
      break;
  }

  // ============================================
  // 3. TESTE DO SEMICIRCULO
  // ============================================

  // Produto escalar:
  // Positivo: jogador esta na frente.
  // Zero: jogador esta exatamente ao lado.
  // Negativo: jogador esta atras.
  //
  // Isso forma um campo de visao de 180 graus.

  const produtoEscalar = dx * frenteX + dy * frenteY;

  if (produtoEscalar < -0.00001) {
    robo.iaViu = false;

    // Permite verificar novamente assim
    // que o jogador entrar na area frontal.
    robo.iaProximaVisao = agora;

    return false;
  }

  // ============================================
  // 4. IDENTIFICAR MUDANCA DE DIRECAO
  // ============================================

  const mudouDirecao = robo.iaDirecaoUltimaVisao !== robo.direcaoAtual;

  robo.iaDirecaoUltimaVisao = robo.direcaoAtual;

  // ============================================
  // 5. DETECCAO PROXIMA GARANTIDA
  // ============================================

  // A menos de 100 pixels, na metade frontal,
  // verifica imediatamente a linha de visao.
  //
  // A parede continua bloqueando a deteccao.

  if (d <= IA.visaoProxima) {
    robo.iaViu = linhaLivre(scene, robo, alvo);

    robo.iaProximaVisao = agora + IA.visaoIntervalo;

    return robo.iaViu;
  }

  // ============================================
  // 6. OTIMIZACAO DA VISAO DISTANTE
  // ============================================

  // Nao verifica paredes em todos os frames.
  // Se o robo mudou de direcao, verifica logo.

  if (!mudouDirecao && agora < (robo.iaProximaVisao || 0)) {
    return Boolean(robo.iaViu);
  }

  robo.iaProximaVisao =
    agora + IA.visaoIntervalo + ((robo.formacaoIndex || 0) % 4) * 25;

  // ============================================
  // 7. DETECCAO DE PAREDES
  // ============================================

  robo.iaViu = linhaLivre(scene, robo, alvo);

  return robo.iaViu;
}

// =====================================================
// INICIALIZACAO DA INTELIGENCIA ARTIFICIAL
// =====================================================

/**
 * Inicializa uma única vez a memória, temporizadores e estado de patrulha do robô.
 */
function iniciarIA(robo, agora) {
  if (robo.iaInicializada) return;

  robo.iaInicializada = true;
  robo.iaEstado = "patrulha";
  robo.iaDesde = agora;

  robo.iaUltimaVisao = -Infinity;
  robo.iaComecouPerseguir = -Infinity;

  robo.iaIgnorarAlvoAte = 0;
  robo.iaProximaVisao = 0;
  robo.iaDirecaoUltimaVisao = null;
  robo.iaViu = false;

  robo.iaUltimaPosicao = null;
  robo.iaDestinoPatrulha = null;

  robo.iaProximoPatrulha = 0;
  robo.iaProximaRota = 0;
  robo.iaRecuando = false;

  robo.patrolCenter ||= {
    x: robo.x,
    y: robo.y,
  };
}

// =====================================================
// SISTEMA DE ESTADOS
// =====================================================

/**
 * Troca o estado da IA, registra o instante da mudança e limpa rota e decisões anteriores.
 */
function mudarEstado(robo, estado, agora) {
  if (robo.iaEstado === estado) return;

  robo.iaEstado = estado;
  robo.iaDesde = agora;

  robo.iaDestinoPatrulha = null;
  robo.iaRecuando = false;

  limparRota(robo);
}

/**
 * Marca o robô em combate e atualiza a posição e o instante em que o alvo foi visto.
 */
function entrarCombate(robo, alvo, agora) {
  if (robo.iaEstado !== "combate") {
    robo.iaComecouPerseguir = agora;

    mudarEstado(robo, "combate", agora);
  }

  robo.alerta = true;
  robo.iaUltimaVisao = agora;

  robo.iaUltimaPosicao = {
    x: alvo.x,
    y: alvo.y,
  };
}

// =====================================================
// ALERTA ENTRE ROBOS
// =====================================================

/**
 * Alerta aliados próximos após dano e os direciona para investigar a posição do robô atingido.
 */
function notificarGrupo(scene, roboOrigem, motivo = "dano") {
  if (!roboOrigem?.active || motivo !== "dano") {
    return;
  }

  const agora = scene.time?.now ?? 0;

  for (const outro of scene.inimigos || []) {
    if (
      !outro?.active ||
      outro.morto ||
      outro.remoteOnly ||
      outro === roboOrigem
    ) {
      continue;
    }

    if (distancia(outro, roboOrigem) > IA.alertaAliadoRaio) {
      continue;
    }

    iniciarIA(outro, agora);

    if (outro.iaEstado === "combate") {
      continue;
    }

    outro.iaUltimaPosicao = {
      x: roboOrigem.x,
      y: roboOrigem.y,
    };

    outro.alerta = true;

    mudarEstado(outro, "investigar", agora);
  }
}

// =====================================================
// MOVIMENTACAO COM DESVIO DE OBSTACULOS
// =====================================================

/**
 * Usa movimento direto ou rota A* para alcançar um destino; para se não houver caminho válido.
 */
function irAte(scene, robo, destino, agora, velocidade, viu, d) {
  if (!destino || !Number.isFinite(destino.x) || !Number.isFinite(destino.y)) {
    parar(scene, robo, viu, d);
    return false;
  }

  if (distancia(robo, destino) <= IA.distanciaChegada) {
    limparRota(robo);

    parar(scene, robo, viu, d);

    return true;
  }

  // ============================================
  // CAMINHO DIRETO LIVRE
  // ============================================

  if (linhaLivre(scene, robo, destino)) {
    limparRota(robo);

    mover(scene, robo, destino, velocidade, viu, d);

    return true;
  }

  // ============================================
  // CALCULO DE ROTA A*
  // ============================================

  if (agora >= (robo.iaProximaRota || 0)) {
    atualizarRotaSeguindoInimigo(scene, robo, destino, agora);

    robo.iaProximaRota = agora + 1400 + ((robo.formacaoIndex || 0) % 4) * 120;
  }

  if (robo.rotaAtual?.length) {
    const seguindo = seguirRotaAtual(scene, robo, destino, agora, (_scene, r) =>
      olharMovimento(r),
    );

    if (seguindo) {
      olharMovimento(robo);
      tocarAnimacaoInimigo(robo);

      atualizarSomPassoRobo(scene, robo, viu, d, true);

      desenharDebugRotaInimigo(scene, robo);

      return true;
    }
  }

  // Nao forca movimento atraves de paredes.
  parar(scene, robo, viu, d);

  return false;
}

// =====================================================
// SISTEMA DE PATRULHA
// =====================================================

/**
 * Escolhe destinos próximos da origem, alternando caminhada e pausas de vigilância.
 */
function patrulhar(scene, robo, agora, d) {
  robo.estado = "idle";
  robo.alerta = false;
  robo.foiFerido = false;

  const centro = origem(robo);

  // Se saiu da area de patrulha, retorna.
  if (distancia(robo, centro) > IA.patrulhaRaio + 95) {
    mudarEstado(robo, "retorno", agora);
    return;
  }

  // ============================================
  // ESCOLHER UM PONTO DE PATRULHA
  // ============================================

  if (!robo.iaDestinoPatrulha && agora >= robo.iaProximoPatrulha) {
    for (let tentativa = 0; tentativa < 12; tentativa++) {
      const angulo = Math.random() * Math.PI * 2;

      const raio = 30 + Math.random() * IA.patrulhaRaio;

      const ponto = {
        x: centro.x + Math.cos(angulo) * raio,

        y: centro.y + Math.sin(angulo) * raio,
      };

      if (linhaLivre(scene, robo, ponto)) {
        robo.iaDestinoPatrulha = ponto;

        robo.iaPatrulhaLimite = agora + IA.patrulhaTempoMaxMs;

        break;
      }
    }

    if (!robo.iaDestinoPatrulha) {
      robo.iaProximoPatrulha = agora + 1200;
    }
  }

  // ============================================
  // ROBO PARADO DE VIGIA
  // ============================================

  if (!robo.iaDestinoPatrulha) {
    if (agora >= (robo.iaProximaVirada || 0)) {
      const direcoes = ["up", "down", "left", "right"];

      robo.direcaoAtual = direcoes[Math.floor(Math.random() * 4)];

      robo.iaProximaVirada = agora + 900 + Math.random() * 1200;
    }

    parar(scene, robo, false, d);
    return;
  }

  // ============================================
  // CHEGOU AO DESTINO OU FICOU PRESO
  // ============================================

  if (
    distancia(robo, robo.iaDestinoPatrulha) <= IA.distanciaChegada ||
    agora > robo.iaPatrulhaLimite ||
    !linhaLivre(scene, robo, robo.iaDestinoPatrulha)
  ) {
    robo.iaDestinoPatrulha = null;

    robo.iaProximoPatrulha =
      agora +
      IA.patrulhaEsperaMinMs +
      Math.random() * (IA.patrulhaEsperaMaxMs - IA.patrulhaEsperaMinMs);

    parar(scene, robo, false, d);
    return;
  }

  // ============================================
  // CAMINHAR PELA PATRULHA
  // ============================================

  mover(scene, robo, robo.iaDestinoPatrulha, robo.velocidade * 0.55, false, d);
}

// =====================================================
// ATAQUE DO ROBO SERRA
// =====================================================

/**
 * Executa o golpe da serra dentro do alcance e da recarga, aplicando dano local ou pelo host.
 */
function atacarSerra(scene, robo, alvo, agora, d) {
  if (d > robo.distanciaAtaque || !linhaLivre(scene, robo, alvo)) {
    return false;
  }

  olharPara(robo, alvo);
  parar(scene, robo, true, d);

  if (agora >= robo.ultimoAtaque + robo.tempoEntreAtaques) {
    robo.ultimoAtaque = agora;

    tocarAnimacaoAtaqueInimigo(robo);

    if (!scene.multiplayer || alvo === scene.player) {
      causarDanoPlayer(scene, robo.danoContato, robo);
    } else if (alvo.id && scene.isMultiplayerHost) {
      scene.multiplayerManager?.publishPlayerDamage(alvo.id, robo.danoContato);
    }
  }

  return true;
}

// =====================================================
// COMBATE DO ROBO SERRA
// =====================================================

/**
 * Persegue o alvo visível ou sua última posição e tenta o ataque de contato da serra.
 */
function combaterSerra(scene, robo, alvo, agora, d, vendo) {
  if (vendo && atacarSerra(scene, robo, alvo, agora, d)) {
    return;
  }

  // Se perdeu a visao, busca a ultima posicao.
  const destino = vendo ? alvo : robo.iaUltimaPosicao;

  irAte(scene, robo, destino, agora, robo.velocidade, vendo, d);
}

// =====================================================
// COMBATE DO ROBO ATIRADOR
// =====================================================

/**
 * Mantém distância para disparar, recua quando necessário e busca a última posição do jogador
 * ao perder visão.
 */
function combaterAtirador(scene, robo, alvo, agora, d, vendo) {
  // ============================================
  // PERDEU O JOGADOR
  // ============================================

  if (!vendo) {
    robo.iaRecuando = false;

    irAte(
      scene,
      robo,
      robo.iaUltimaPosicao,
      agora,
      robo.velocidade * 0.8,
      false,
      d,
    );

    return;
  }

  olharPara(robo, alvo);

  const alcanceTiro = Number(robo.distanciaAtaque) || 180;

  // ============================================
  // DECIDIR SE PRECISA RECUAR
  // ============================================

  if (d < IA.atiradorRecuarAbaixo) {
    robo.iaRecuando = true;
  }

  if (d >= IA.atiradorPararRecuo) {
    robo.iaRecuando = false;
  }

  // ============================================
  // RECUAR SE O JOGADOR ESTIVER MUITO PERTO
  // ============================================

  if (robo.iaRecuando && d > 1) {
    const ux = (robo.x - alvo.x) / d;

    const uy = (robo.y - alvo.y) / d;

    const destino = {
      x: robo.x + ux * IA.atiradorPassoRecuo,

      y: robo.y + uy * IA.atiradorPassoRecuo,
    };

    if (
      distancia(destino, origem(robo)) <= IA.alcanceMaximoDoSpawn &&
      linhaLivre(scene, robo, destino)
    ) {
      mover(scene, robo, destino, robo.velocidade * 0.8, true, d);
    } else {
      parar(scene, robo, true, d);
    }

    // ============================================
    // APROXIMAR CASO ESTEJA LONGE
    // ============================================
  } else if (d > Math.min(IA.atiradorAproximarAcima, alcanceTiro - 10)) {
    irAte(scene, robo, alvo, agora, robo.velocidade * 0.85, true, d);

    // ============================================
    // PARAR E PRIORIZAR DISPAROS
    // ============================================
  } else {
    parar(scene, robo, true, d);
  }

  // ============================================
  // ATACAR MESMO DURANTE O RECUO
  // ============================================

  if (d <= alcanceTiro && linhaLivre(scene, robo, alvo)) {
    olharPara(robo, alvo);

    robo.alvoAtual = alvo;

    tentarDispararLaser(scene, agora, robo);
  }
}

// =====================================================
// ATUALIZACAO PRINCIPAL DA IA
// =====================================================

/**
 * Atualiza visão e estados do robô, respeitando retorno à origem, limites de perseguição e
 * economia para inimigos distantes.
 */
function atualizarIAInimigo(scene, time, robo = scene.inimigoTeste) {
  if (!robo?.active || robo.morto || robo.remoteOnly || !robo.body?.enable) {
    return;
  }

  const alvo = obterAlvo(scene, robo);

  if (
    !alvo ||
    alvo.active === false ||
    !Number.isFinite(alvo.x) ||
    !Number.isFinite(alvo.y)
  ) {
    parar(scene, robo);
    return;
  }

  // Preserva o knockback.
  if (!scene.multiplayer && robo.combatKnockbackUntil > time) {
    return;
  }

  iniciarIA(robo, time);

  robo.alvoAtual = alvo;

  const d = distancia(robo, alvo);

  const dOrigem = distancia(robo, origem(robo));

  // ============================================
  // ECONOMIA DE PROCESSAMENTO
  // ============================================

  if (d > IA.distanciaSono && robo.iaEstado === "patrulha") {
    if (time < (robo.iaAcordarEm || 0)) {
      return;
    }

    robo.iaAcordarEm = time + IA.sonoIntervalo;

    parar(scene, robo, false, d);
    return;
  }

  // ============================================
  // VERIFICAR VISAO
  // ============================================

  const vendo = temVisao(scene, robo, alvo, time);

  const ferido = Boolean(robo.foiFerido && robo.vida < robo.vidaMaxima);

  // ============================================
  // DETECTOU O JOGADOR
  // ============================================

  if (
    robo.iaEstado !== "retorno" &&
    time >= robo.iaIgnorarAlvoAte &&
    vendo &&
    dOrigem <= IA.alcanceMaximoDoSpawn
  ) {
    entrarCombate(robo, alvo, time);
  } else if (robo.iaEstado === "patrulha" && ferido) {
    robo.iaUltimaPosicao = {
      x: alvo.x,
      y: alvo.y,
    };

    robo.alerta = true;

    mudarEstado(robo, "investigar", time);
  }

  // ============================================
  // LIMITE DE PERSEGUICAO
  // ============================================

  if (
    (robo.iaEstado === "combate" || robo.iaEstado === "investigar") &&
    (dOrigem >= IA.alcanceRetornoDoSpawn ||
      (robo.iaEstado === "combate" &&
        time - robo.iaComecouPerseguir >= IA.perseguicaoMaxMs))
  ) {
    mudarEstado(robo, "retorno", time);

    robo.iaIgnorarAlvoAte = time + IA.pausaAposDesistirMs;

    robo.alerta = false;
    robo.foiFerido = false;
  }

  // ============================================
  // PERDEU O JOGADOR DE VISTA
  // ============================================

  if (
    robo.iaEstado === "combate" &&
    !vendo &&
    time - robo.iaUltimaVisao >= IA.memoriaAlvoMs
  ) {
    mudarEstado(robo, "investigar", time);
  }

  // ============================================
  // ESTADO: COMBATE
  // ============================================

  if (robo.iaEstado === "combate") {
    robo.alerta = true;

    if (robo.estado !== "atacando" || !robo.anims?.isPlaying) {
      robo.estado = "alerta";
    }

    atualizarEstadoVisualRobo(robo);

    if (robo.tipoRobo === "serra") {
      combaterSerra(scene, robo, alvo, time, d, vendo);
    } else {
      combaterAtirador(scene, robo, alvo, time, d, vendo);
    }

    return;
  }

  // ============================================
  // ESTADO: INVESTIGACAO
  // ============================================

  if (robo.iaEstado === "investigar") {
    robo.alerta = true;
    robo.estado = "alerta";

    atualizarEstadoVisualRobo(robo);

    if (time - robo.iaDesde >= IA.investigarMs) {
      mudarEstado(robo, "retorno", time);

      robo.alerta = false;
      parar(scene, robo, false, d);
    } else {
      irAte(
        scene,
        robo,
        robo.iaUltimaPosicao || origem(robo),
        time,
        robo.velocidade * 0.65,
        false,
        d,
      );
    }

    return;
  }

  // ============================================
  // ESTADO: RETORNO A ORIGEM
  // ============================================

  if (robo.iaEstado === "retorno") {
    robo.alerta = false;
    robo.foiFerido = false;
    robo.estado = "idle";

    atualizarEstadoVisualRobo(robo);

    if (distancia(robo, origem(robo)) <= 35) {
      mudarEstado(robo, "patrulha", time);

      parar(scene, robo, false, d);
    } else {
      irAte(scene, robo, origem(robo), time, robo.velocidade * 0.7, false, d);
    }

    return;
  }

  // ============================================
  // ESTADO: PATRULHA
  // ============================================

  atualizarEstadoVisualRobo(robo);

  patrulhar(scene, robo, time, d);
}

// =====================================================
// EXPORTACOES
// =====================================================

export { atualizarIAInimigo, notificarGrupo };
