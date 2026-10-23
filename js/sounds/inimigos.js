/**
 * @file Áudio dos robôs e dos impactos do boss. Centraliza carregamento, passos com volume por
 * distância e limpeza dos sons temporários.
 */

// =====================================================
// VOLUMES DOS SONS DOS INIMIGOS
// =====================================================

// Volume máximo do passo do robô que atira laser (15%).
const VOLUME_PASSO_ROBO_MAXIMO = 0.22;
const VOLUME_PASSO_SERRA_MAXIMO = 0.020;
// Alcance compartilhado; a serra ganha 40 pixels em relação aos 480 anteriores.
const DISTANCIA_SOM_PASSOS_ROBOS = 700;

// Volume dos sons existentes.
const VOLUME_TIRO_LASER = 0.02;
const VOLUME_MORTE_ROBO = 0.3;

// =====================================================
// NOVO: CONFIGURAÇÕES DO SOCO DO BOSS
// =====================================================
//
// O áudio original é mais longo do que cada soco.
//
// Portanto, reproduzimos somente o início
// do impacto, com uma pequena aceleração
// e um fade-out no final.
//
// Um novo som começa SOMENTE nos frames
// de contato com o chão: 6 e 12.
// =====================================================

const CHAVE_SOM_SOCO_BOSS = "soco-boss";

// Volume do impacto.
// Pode ajustar de 0 até 1.
const VOLUME_SOCO_BOSS = 0.14;

// Velocidade de reprodução.
//
// 1.00 = velocidade original.
// 1.65 = reprodução acelerada.
//
// Não altera a velocidade da animação.
const VELOCIDADE_SOCO_BOSS = 1.65;

// Pular o pequeno silêncio no início do MP3.
//
// A análise do áudio mostrou o impacto
// começando aproximadamente em 0.02 segundo.
//
// Isso ajuda o som a começar junto ao frame.
const INICIO_AUDIO_SOCO = 0.02;

// =====================================================
// DURAÇÃO DE CADA IMPACTO
// =====================================================
//
// Cada frame do Boss dura 90 ms.
//
// Frame 6 -> primeiro impacto.
// Frame 12 -> segundo impacto.
//
// Intervalo entre os impactos: 540 ms.
//
// O som fica ativo por somente 340 ms.
//
// Primeiros 230 ms: volume normal.
// Últimos 110 ms: volume cai até zero.
//
// Assim, um som não invade o próximo soco.
// =====================================================

const TEMPO_ANTES_FADE_SOCO = 230;
const DURACAO_FADE_SOCO = 110;

// =====================================================
// CARREGAMENTO DOS SONS
// =====================================================

/**
 * Enfileira os sons de tiro, passos, explosão e os efeitos de raio e soco do boss.
 */
function carregarSonsInimigos(loader) {
  loader.audio("tiro-laser", "sounds.mp3/tiro_laser.mp3");

  loader.audio("robot-walk", "sounds.mp3/robot_walk_3.mp3");

  loader.audio("walk-robo-serra", "sounds.mp3/walk_robo_serra.mp3");

  loader.audio("robo-explodindo", "sounds.mp3/robo_explodindo.mp3");

  // ===================================================
  // SOM DO RAIO DO BOSS - PRESERVADO
  // ===================================================

  loader.audio(
    "som-boss-raio-chao",
    "../js/sounds/SOUNDS_INIMIGOS.js/raio_boss.mp3",
  );

  // ===================================================
  // NOVO: SOM DO SOCO NO CHÃO DO BOSS
  // ===================================================
  //
  // Caminho informado:
  //
  // /workspaces/games/js/sounds/
  // SOUNDS_INIMIGOS.js/soco_boss_2.mp3
  //
  // O Preloader já usa "./assets/" como base.
  // Por isso, precisamos voltar com "../js/".
  // ===================================================

  loader.audio(
    CHAVE_SOM_SOCO_BOSS,
    "../js/sounds/SOUNDS_INIMIGOS.js/soco_boss_2.mp3",
  );
}

// =====================================================
// NOVO: PARAR SOM DO SOCO DO BOSS
// =====================================================
//
// Cancela:
// - Temporizador do fade.
// - Tween de volume.
// - Instância do áudio.
//
// Também funciona caso o ataque seja interrompido.
// =====================================================

/**
 * Cancela o fade agendado e a animação de volume e destrói o áudio de soco em andamento.
 */
function pararSomSocoBoss(boss) {
  if (!boss) return;

  // Cancelar temporizador.
  if (boss.somSocoFadeTimer) {
    boss.somSocoFadeTimer.remove(false);
    boss.somSocoFadeTimer = null;
  }

  // Cancelar animação de volume.
  if (boss.somSocoFadeTween) {
    boss.somSocoFadeTween.stop();
    boss.somSocoFadeTween = null;
  }

  // Interromper áudio.
  if (boss.somSocoBoss) {
    boss.somSocoBoss.stop();
    boss.somSocoBoss.destroy();

    boss.somSocoBoss = null;
  }
}

// =====================================================
// NOVO: REGISTRAR LIMPEZA DO ÁUDIO
// =====================================================
//
// Impede sons restantes quando:
// - O Boss é derrotado.
// - O Boss é destruído.
// - O jogador sai da cena.
//
// Os listeners são registrados somente uma vez.
// =====================================================

/**
 * Conecta a limpeza do soco à derrota, destruição do boss e encerramento da cena uma única
 * vez.
 */
function registrarLimpezaSomSocoBoss(boss) {
  if (!boss?.scene || boss.somSocoLimpezaRegistrada) {
    return;
  }

  const scene = boss.scene;

  boss.somSocoLimpezaRegistrada = true;

  /**
   * Para o impacto de soco quando o evento de derrota pertence ao boss correspondente.
   */
  const aoDerrotarBoss = (evento) => {
    if (evento?.boss === boss) {
      pararSomSocoBoss(boss);
    }
  };

  scene.events.on("boss:derrotado", aoDerrotarBoss);

  /**
   * Remove o listener de derrota e interrompe o som restante ao liberar o boss ou a cena.
   */
  const limparListeners = () => {
    scene.events.off("boss:derrotado", aoDerrotarBoss);

    pararSomSocoBoss(boss);
  };

  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, limparListeners);

  boss.once("destroy", limparListeners);
}

// =====================================================
// NOVO: REPRODUZIR SOM NO FRAME DE IMPACTO
// =====================================================
//
// Esta função não controla a animação do Boss.
//
// Ela apenas recebe a informação de que
// o frame de impacto foi atingido.
//
// É chamada diretamente por BossAnimacoes.js.
// =====================================================

/**
 * Toca o impacto do soco válido dentro da arena e coordena seu encerramento e fade de volume.
 */
function tocarSomSocoBoss(boss) {
  if (!boss?.active || boss.morto) {
    return;
  }

  const scene = boss.scene;
  const ia = boss.iaCombate;

  if (
    !scene?.sound ||
    scene.morteEmAndamento ||
    boss.dentroArena !== true ||
    ia?.ataqueAtual !== "ataqueChao"
  ) {
    return;
  }

  // ===================================================
  // VERIFICAR SE O MP3 FOI CARREGADO
  // ===================================================

  if (!scene.cache.audio.exists(CHAVE_SOM_SOCO_BOSS)) {
    if (!boss.avisoSomSocoAusente) {
      console.warn("Boss: soco_boss_2.mp3 não foi carregado.");

      boss.avisoSomSocoAusente = true;
    }

    return;
  }

  // ===================================================
  // GARANTIR UMA ÚNICA REPRODUÇÃO POR IMPACTO
  // ===================================================

  // Se ainda restou alguma reprodução anterior,
  // interromper antes de iniciar a próxima.
  pararSomSocoBoss(boss);

  registrarLimpezaSomSocoBoss(boss);

  // ===================================================
  // CRIAR SOM DO IMPACTO
  // ===================================================

  const som = scene.sound.add(CHAVE_SOM_SOCO_BOSS, {
    volume: VOLUME_SOCO_BOSS,
    loop: false,
  });

  boss.somSocoBoss = som;

  // Começar exatamente quando a animação
  // entra no frame de contato.
  //
  // O seek pula somente 20 ms do MP3.
  // A velocidade encurta a explosão sonora.
  const iniciou = som.play({
    volume: VOLUME_SOCO_BOSS,
    rate: VELOCIDADE_SOCO_BOSS,
    seek: INICIO_AUDIO_SOCO,
    loop: false,
  });

  if (!iniciou) {
    pararSomSocoBoss(boss);
    return;
  }

  // ===================================================
  // INICIAR FADE-OUT DEPOIS DO IMPACTO
  // ===================================================

  boss.somSocoFadeTimer = scene.time.delayedCall(TEMPO_ANTES_FADE_SOCO, () => {
    boss.somSocoFadeTimer = null;

    // O áudio pode ter sido cancelado antes
    // deste momento por outro evento do jogo.
    if (
      !boss.active ||
      boss.morto ||
      boss.somSocoBoss !== som ||
      !som.isPlaying
    ) {
      if (boss.somSocoBoss === som) {
        pararSomSocoBoss(boss);
      }

      return;
    }

    // ===============================================
    // DIMINUIR VOLUME SUAVEMENTE
    // ===============================================

    boss.somSocoFadeTween = scene.tweens.add({
      targets: som,

      volume: 0,

      duration: DURACAO_FADE_SOCO,

      ease: "Linear",

      onComplete: () => {
        if (boss.somSocoBoss !== som) {
          return;
        }

        // Tween já terminou.
        boss.somSocoFadeTween = null;

        // Destruir áudio após desaparecer.
        pararSomSocoBoss(boss);
      },
    });
  });
}

// =====================================================
// SOM DOS PASSOS DOS ROBÔS - ORIGINAL
// =====================================================

/**
 * Atualiza passos conforme movimento e distância ao jogador, com volume reduzido para o
 * robô-serra.
 */
function atualizarSomPassoRobo(
  scene,
  inimigo,
  viuPlayer,
  distancia,
  estaSeMovendo,
) {
  const ehSerra = inimigo?.tipoRobo === "serra";

  if (scene.morteEmAndamento) {
    if (inimigo.somPassoRobo?.isPlaying) {
      inimigo.somPassoRobo.stop();
    }

    return;
  }

  const podeTocar = estaSeMovendo;

  // O ouvinte é o jogador local, mesmo quando o robô persegue outro jogador.
  const distanciaOuvinte = scene.player
    ? Math.hypot(scene.player.x - inimigo.x, scene.player.y - inimigo.y)
    : distancia;

  // Ambos perdem a mesma proporção do volume com a distância, independentemente da IA.
  const volumeRelativo =
    Phaser.Math.Clamp(1 - distanciaOuvinte / DISTANCIA_SOM_PASSOS_ROBOS, 0, 1) ** 2;

  const volume = volumeRelativo *
    (ehSerra ? VOLUME_PASSO_SERRA_MAXIMO : VOLUME_PASSO_ROBO_MAXIMO);

  const podeOuvir = volume > 0;

  inimigo.podeTocarPasso = podeTocar;
  inimigo.volumePasso = volume;

  if (inimigo.somPassoRobo) {
    if (!podeTocar || !podeOuvir) {
      inimigo.somPassoRobo.stop();
    } else if (!inimigo.somPassoRobo.isPlaying) {
      inimigo.somPassoRobo.play({ volume });
    } else if (inimigo.somPassoRobo.isPlaying) {
      inimigo.somPassoRobo.setVolume(volume);
    }
  }
}

// =====================================================
// CONFIGURAR PASSOS DOS ROBÔS - ORIGINAL
// =====================================================

/**
 * Cria o loop de passos adequado ao tipo de robô e agenda a destruição da instância na saída
 * da cena.
 */
function configurarSomPassoRobo(scene, inimigo) {
  const chaveSomPasso =
    inimigo?.tipoRobo === "serra" ? "walk-robo-serra" : "robot-walk";

  inimigo.somPassoRobo = scene.sound.add(chaveSomPasso, { loop: true });

  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    if (!inimigo.somPassoRobo) {
      return;
    }

    inimigo.somPassoRobo.stop();
    inimigo.somPassoRobo.destroy();
    inimigo.somPassoRobo = null;
  });
}

// =====================================================
// SOM DO LASER DOS ROBÔS - ORIGINAL
// =====================================================

/**
 * Reproduz o som de disparo dos robôs se a morte do jogador não está em andamento.
 */
function tocarSomTiroLaser(scene) {
  if (scene.morteEmAndamento) {
    return;
  }

  scene.sound.play("tiro-laser", {
    volume: VOLUME_TIRO_LASER,
  });
}

// =====================================================
// SOM DE MORTE DOS ROBÔS - ORIGINAL
// =====================================================

/**
 * Toca a explosão de um robô apenas uma vez, evitando repetições durante sua destruição.
 */
function tocarSomMorteRobo(scene, inimigo) {
  if (
    !scene?.sound ||
    scene.morteEmAndamento ||
    !inimigo ||
    inimigo.somMorteTocado
  ) {
    return;
  }

  inimigo.somMorteTocado = true;

  scene.sound.play("robo-explodindo", {
    volume: VOLUME_MORTE_ROBO,
  });
}

// =====================================================
// EXPORTAÇÕES
// =====================================================

export {
  carregarSonsInimigos,
  configurarSomPassoRobo,
  atualizarSomPassoRobo,
  tocarSomTiroLaser,
  tocarSomMorteRobo,

  // Novas funções do Boss.
  tocarSomSocoBoss,
  pararSomSocoBoss,
};
