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
  caminhoMovimentoBloqueado,
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
  visaoProxima: 130,

  memoriaAlvoMs: 9000,
  investigarMs: 3600,
  investigarDeslocamentoMaxMs: 12000,
  pausaAposDesistirMs: 4500,

  alcanceMaximoDoSpawn: 1100,
  alcanceRetornoDoSpawn: 1250,
  alertaAliadoRaio: 420,
  alertaIntervaloMs: 1600,

  patrulhaRaio: 130,
  patrulhaEsperaMinMs: 650,
  patrulhaEsperaMaxMs: 1600,
  patrulhaTempoMaxMs: 3200,
  distanciaChegada: 22,

  atiradorRecuarAbaixo: 190,
  atiradorPararRecuo: 265,
  atiradorAproximarAcima: 300,
  atiradorPassoRecuo: 110,

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
  robo.iaAndando = false;

  if (robo.estado !== "atacando" || !robo.anims?.isPlaying) {
    pararAnimacaoInimigo(robo);
  }

  atualizarSomPassoRobo(scene, robo, viu, d, false);
}

/**
 * Move o robô até um ponto e sincroniza direção, animação e som dos passos.
 */
function mover(scene, robo, ponto, velocidade, viu = false, d = Infinity, foco = null) {
  scene.physics.moveTo(robo, ponto.x, ponto.y, velocidade);
  robo.iaAndando = true;

  if (foco) olharPara(robo, foco);
  else olharMovimento(robo);
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
// nem mesmo de perto.
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

  const alcance = Number(robo.distanciaDeteccao) || 760;

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

  const idAlvo = alvo.id ?? alvo;
  const mudouDirecao =
    robo.iaDirecaoUltimaVisao !== robo.direcaoAtual ||
    robo.iaIdUltimaVisao !== idAlvo;

  robo.iaDirecaoUltimaVisao = robo.direcaoAtual;
  robo.iaIdUltimaVisao = idAlvo;

  // ============================================
  // 5. FREQUENCIA DA CONSULTA DE VISAO
  // ============================================

  // De perto a consulta é mais frequente, sem repetir interseções a cada frame.

  // Nao verifica paredes em todos os frames.
  // Se o robo mudou de direcao, verifica logo.

  if (!mudouDirecao && agora < (robo.iaProximaVisao || 0)) {
    return Boolean(robo.iaViu);
  }

  robo.iaProximaVisao =
    agora + (d <= IA.visaoProxima ? 75 : IA.visaoIntervalo) +
    ((robo.formacaoIndex || 0) % 4) * 20;

  // ============================================
  // 6. DETECCAO DE PAREDES
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

  robo.iaIgnorarAlvoAte = 0;
  robo.iaProximaVisao = 0;
  robo.iaDirecaoUltimaVisao = null;
  robo.iaViu = false;

  robo.iaUltimaPosicao = null;
  robo.iaDestinoPatrulha = null;

  robo.iaProximoPatrulha = 0;
  robo.iaProximaRota = 0;
  robo.iaRecuando = false;
  robo.iaProximoAlerta = 0;
  robo.iaAndando = false;

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
  robo.iaDestinoRecuo = null;
  robo.iaReavaliarRecuo = 0;
  robo.iaBuscaDesde = null;
  robo.iaProximaRota = 0;
  robo.iaMonitorMovimento = null;

  if (estado === "patrulha") {
    robo.iaUltimaPosicao = null;
    robo.iaUltimaVisao = -Infinity;
  }

  limparRota(robo);
}

/**
 * Marca o robô em combate e atualiza a posição e o instante em que o alvo foi visto.
 */
function entrarCombate(robo, alvo, agora) {
  if (robo.iaEstado !== "combate") {
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
 * Compartilha somente a última posição conhecida. O rádio alcança aliados próximos, mas
 * receber um aviso não equivale a enxergar o jogador nem dispara uma cadeia de avisos.
 */
function notificarGrupo(scene, roboOrigem, motivo = "dano", agora = scene.time?.now ?? 0) {
  if (
    !roboOrigem?.active || roboOrigem.morto || roboOrigem.remoteOnly ||
    (motivo !== "dano" && motivo !== "visao")
  ) {
    return;
  }

  iniciarIA(roboOrigem, agora);
  if (agora < roboOrigem.iaProximoAlerta) return;
  roboOrigem.iaProximoAlerta = agora + IA.alertaIntervaloMs;

  const lembrancaRecente = agora - roboOrigem.iaUltimaVisao <= IA.memoriaAlvoMs;
  const posicao = (lembrancaRecente ? roboOrigem.iaUltimaPosicao : null) ||
    (motivo === "visao" ? roboOrigem.alvoAtual : null) || roboOrigem;

  for (const outro of scene.inimigos || []) {
    if (
      !outro?.active ||
      outro.morto ||
      outro.remoteOnly ||
      outro.body?.enable === false ||
      outro === roboOrigem
    ) {
      continue;
    }

    if (distancia(outro, roboOrigem) > IA.alertaAliadoRaio) {
      continue;
    }

    iniciarIA(outro, agora);

    if (
      outro.iaEstado === "combate" ||
      agora < outro.iaIgnorarAlvoAte ||
      distancia(outro, origem(outro)) >= IA.alcanceRetornoDoSpawn
    ) {
      continue;
    }

    const mudouPosicao = !outro.iaUltimaPosicao || distancia(outro.iaUltimaPosicao, posicao) > 48;
    mudarEstado(outro, "investigar", agora);
    outro.iaUltimaPosicao = {
      x: posicao.x,
      y: posicao.y,
    };
    outro.alvoPlayerId = roboOrigem.alvoPlayerId;
    outro.iaUltimaVisao = agora;
    outro.iaProximaVisao = 0;
    if (mudouPosicao) {
      outro.iaBuscaDesde = null;
      outro.iaDesde = agora;
      outro.iaProximaRota = 0;
    }
    outro.alerta = true;
  }
}

/**
 * Detecta falta de avanço também no movimento direto, que não passa pelo seguidor A*.
 * A próxima busca considera os aliados para sair de filas e colisões em corredores.
 */
function verificarProgresso(robo, agora) {
  const anterior = robo.iaMonitorMovimento;
  if (!robo.iaAndando || !anterior) {
    robo.iaMonitorMovimento = { x: robo.x, y: robo.y, tempo: agora };
    return;
  }
  if (agora - anterior.tempo < 450) return;

  if (distancia(robo, anterior) < 4) {
    limparRota(robo);
    robo.iaProximaRota = 0;
    robo.ultimoCalculoRota = -Infinity;
    robo.iaForcarRotaAte = agora + 1800;
    robo.iaDestinoRecuo = null;
    robo.iaReavaliarRecuo = 0;
  }
  robo.iaMonitorMovimento = { x: robo.x, y: robo.y, tempo: agora };
}

// =====================================================
// MOVIMENTACAO COM DESVIO DE OBSTACULOS
// =====================================================

/**
 * Usa movimento direto ou rota A* para alcançar um destino; para se não houver caminho válido.
 */
function irAte(scene, robo, destino, agora, velocidade, viu, d, foco = null) {
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

  if (agora >= (robo.iaForcarRotaAte || 0) && !caminhoMovimentoBloqueado(scene, robo, destino)) {
    limparRota(robo);

    mover(scene, robo, destino, velocidade, viu, d, foco);

    return true;
  }

  // ============================================
  // CALCULO DE ROTA A*
  // ============================================

  if (agora >= (robo.iaProximaRota || 0)) {
    atualizarRotaSeguindoInimigo(scene, robo, destino, agora);

    robo.iaProximaRota = robo.rotaPendente
      ? Math.max(agora + 50, robo.proximaTentativaRota || 0)
      : agora + 550 + ((robo.formacaoIndex || 0) % 4) * 60;
  }

  if (robo.rotaAtual?.length) {
    const seguindo = seguirRotaAtual(scene, robo, destino, agora, (_scene, r) => {
      if (foco) olharPara(r, foco);
      else olharMovimento(r);
    }, velocidade);

    if (seguindo) {
      robo.iaAndando = true;
      if (foco) olharPara(robo, foco);
      else olharMovimento(robo);
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

      if (!caminhoMovimentoBloqueado(scene, robo, ponto)) {
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
    caminhoMovimentoBloqueado(scene, robo, robo.iaDestinoPatrulha)
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

  irAte(scene, robo, robo.iaDestinoPatrulha, agora, robo.velocidade * 0.55, false, d);
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

/** Gira de forma espaçada ao alcançar uma pista, procurando nas saídas ao redor. */
function varrerArea(robo, agora) {
  if (agora < (robo.iaProximaVarredura || 0)) return;
  const direcoes = ["up", "right", "down", "left"];
  robo.direcaoAtual = direcoes[(direcoes.indexOf(robo.direcaoAtual) + 1) % 4];
  robo.iaProximaVarredura = agora + 650;
  robo.iaProximaVisao = 0;
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

  irAte(scene, robo, destino, agora, robo.velocidade, vendo, d, vendo ? alvo : null);
  if (!vendo && destino && distancia(robo, destino) <= IA.distanciaChegada) {
    varrerArea(robo, agora);
  }
}

/**
 * Escolhe um recuo livre para a hitbox inteira. Se a saída traseira estiver fechada,
 * tenta diagonais e laterais, mantendo a escolha por alguns instantes para não oscilar.
 */
function escolherRecuo(scene, robo, alvo, agora, d) {
  if (!robo.iaDestinoRecuo && agora < robo.iaReavaliarRecuo) return null;
  if (
    robo.iaDestinoRecuo && agora < robo.iaReavaliarRecuo &&
    distancia(robo, robo.iaDestinoRecuo) > IA.distanciaChegada &&
    distancia(robo.iaDestinoRecuo, alvo) > d + 8 &&
    !caminhoMovimentoBloqueado(scene, robo, robo.iaDestinoRecuo)
  ) return robo.iaDestinoRecuo;

  const base = d > 1 ? Math.atan2(robo.y - alvo.y, robo.x - alvo.x) :
    ({ up: Math.PI / 2, down: -Math.PI / 2, left: 0, right: Math.PI })[robo.direcaoAtual];
  const lado = (robo.formacaoIndex || 0) % 2 ? -1 : 1;
  let melhor = null;
  let melhorNota = -Infinity;
  for (const giro of [0, lado * Math.PI / 4, -lado * Math.PI / 4, lado * Math.PI / 2, -lado * Math.PI / 2]) {
    const angulo = base + giro;
    for (const passo of [IA.atiradorPassoRecuo, IA.atiradorPassoRecuo * 0.55]) {
      const ponto = { x: robo.x + Math.cos(angulo) * passo, y: robo.y + Math.sin(angulo) * passo };
      if (
        distancia(ponto, origem(robo)) > IA.alcanceMaximoDoSpawn ||
        caminhoMovimentoBloqueado(scene, robo, ponto)
      ) continue;

      let nota = distancia(ponto, alvo) - Math.abs(giro) * 14;
      for (const aliado of scene.inimigos || []) {
        if (aliado !== robo && aliado?.active && !aliado.morto && distancia(aliado, ponto) < 65) {
          nota -= 90;
        }
      }
      // Dá preferência a recuos que preservam a linha de tiro na posição escolhida.
      if (!caminhoDiretoBloqueado(scene, ponto, alvo)) nota += 35;
      if (nota > melhorNota) {
        melhor = ponto;
        melhorNota = nota;
      }
    }
  }
  robo.iaDestinoRecuo = melhor;
  robo.iaReavaliarRecuo = agora + (melhor ? 500 : 220);
  return melhor;
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
    robo.iaDestinoRecuo = null;
    robo.iaReavaliarRecuo = 0;

    irAte(
      scene,
      robo,
      robo.iaUltimaPosicao,
      agora,
      robo.velocidade * 0.8,
      false,
      d,
    );

    if (robo.iaUltimaPosicao && distancia(robo, robo.iaUltimaPosicao) <= IA.distanciaChegada) {
      varrerArea(robo, agora);
    }

    return;
  }

  olharPara(robo, alvo);

  const alcanceTiro = Number(robo.distanciaAtaque) || 330;
  const escalaDistancia = Math.min(1, alcanceTiro / 330);

  // ============================================
  // DECIDIR SE PRECISA RECUAR
  // ============================================

  if (d < IA.atiradorRecuarAbaixo * escalaDistancia) {
    robo.iaRecuando = true;
  }

  if (d >= IA.atiradorPararRecuo * escalaDistancia) {
    robo.iaRecuando = false;
    robo.iaDestinoRecuo = null;
    robo.iaReavaliarRecuo = 0;
  }

  // ============================================
  // RECUAR SE O JOGADOR ESTIVER MUITO PERTO
  // ============================================

  if (robo.iaRecuando) {
    const destino = escolherRecuo(scene, robo, alvo, agora, d);
    if (destino) {
      irAte(scene, robo, destino, agora, robo.velocidade * 0.9, true, d, alvo);
    } else {
      parar(scene, robo, true, d);
    }

    // ============================================
    // APROXIMAR CASO ESTEJA LONGE
    // ============================================
  } else if (d > IA.atiradorAproximarAcima * escalaDistancia) {
    irAte(scene, robo, alvo, agora, robo.velocidade * 0.9, true, d, alvo);

    // ============================================
    // PARAR E PRIORIZAR DISPAROS
    // ============================================
  } else {
    parar(scene, robo, true, d);
  }

  // ============================================
  // ATACAR MESMO DURANTE O RECUO
  // ============================================

  // A direção e o semicírculo de visão acompanham o alvo até entre dois disparos.
  olharPara(robo, alvo);

  if (
    d <= alcanceTiro && agora >= robo.ultimoTiro + robo.tempoEntreTiros &&
    linhaLivre(scene, robo, alvo)
  ) {

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
    scene.morteEmAndamento ||
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
  verificarProgresso(robo, time);

  robo.alvoAtual = alvo;

  const d = distancia(robo, alvo);

  const dOrigem = distancia(robo, origem(robo));

  // ============================================
  // ECONOMIA DE PROCESSAMENTO
  // ============================================

  if (d > IA.distanciaSono && robo.iaEstado === "patrulha" && !robo.foiFerido && !robo.alerta) {
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
    time >= robo.iaIgnorarAlvoAte &&
    vendo &&
    dOrigem <= IA.alcanceMaximoDoSpawn
  ) {
    const adquiriuAlvo = robo.iaEstado !== "combate";
    entrarCombate(robo, alvo, time);
    if (adquiriuAlvo) robo.iaProximoAlerta = 0;
    notificarGrupo(scene, robo, "visao", time);
  } else if (robo.iaEstado === "patrulha" && ferido) {
    // Sem contato visual, o dano é uma pista local; não revela o alvo atrás de paredes.
    if (!robo.iaUltimaPosicao || time - robo.iaUltimaVisao > IA.memoriaAlvoMs) {
      robo.iaUltimaPosicao = { x: robo.x, y: robo.y };
    }

    robo.alerta = true;

    mudarEstado(robo, "investigar", time);
  }

  // ============================================
  // LIMITE DE PERSEGUICAO
  // ============================================

  if (
    (robo.iaEstado === "combate" || robo.iaEstado === "investigar") &&
    dOrigem >= IA.alcanceRetornoDoSpawn
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

    const pista = robo.iaUltimaPosicao || origem(robo);
    const chegou = distancia(robo, pista) <= IA.distanciaChegada;
    if (chegou && robo.iaBuscaDesde == null) robo.iaBuscaDesde = time;

    if (
      (robo.iaBuscaDesde != null && time - robo.iaBuscaDesde >= IA.investigarMs) ||
      time - robo.iaDesde >= IA.investigarDeslocamentoMaxMs + IA.investigarMs
    ) {
      mudarEstado(robo, "retorno", time);

      robo.alerta = false;
      parar(scene, robo, false, d);
    } else if (chegou) {
      varrerArea(robo, time);
      parar(scene, robo, false, d);
    } else if (time - robo.iaDesde >= IA.investigarDeslocamentoMaxMs) {
      // Uma pista inacessível ainda merece uma última varredura antes do retorno.
      robo.iaBuscaDesde ??= time;
      varrerArea(robo, time);
      parar(scene, robo, false, d);
    } else {
      irAte(
        scene,
        robo,
        pista,
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
