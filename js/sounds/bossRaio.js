// =====================================================
// SOM DO RAIO NO CHÃO DO BOSS FINAL
// =====================================================
//
// O áudio acompanha o progresso do raio visual:
//
// 1. Raio começa a aparecer: volume inicial.
// 2. Raio cresce: volume aumenta.
// 3. Raio atinge o pico: volume máximo.
// 4. Raio desaparece: volume diminui.
// 5. Raio termina: áudio é interrompido.
//
// Não altera frames, dano, hitboxes ou animações.
// =====================================================

// =====================================================
// CONFIGURAÇÕES MANUAIS DO SOM
// =====================================================

// Chave usada no carregamento do áudio.
const CHAVE_SOM_RAIO = "som-boss-raio-chao";

// Volume no instante em que o raio aparece.
// Valores permitidos: 0 até 1.
const VOLUME_INICIAL_RAIO = 0.045;

// Volume máximo do raio.
// AUMENTE ou DIMINUA este valor manualmente.
const VOLUME_MAXIMO_RAIO = 0.19;

// Momento da animação em que o volume fica máximo.
//
// 0.50 = metade da duração visual do raio.
// 0.60 = 60% da duração visual do raio.
//
// Quanto maior, mais tarde acontece o pico.
const PONTO_VOLUME_MAXIMO = 0.5;

// Volume quando o raio termina.
const VOLUME_FINAL_RAIO = 0;

// =====================================================
// SUAVIZAÇÃO DO VOLUME
// =====================================================

function suavizarProgresso(valor) {
  const t = Phaser.Math.Clamp(valor, 0, 1);

  return t * t * (3 - 2 * t);
}

// =====================================================
// CALCULAR VOLUME CONFORME A ANIMAÇÃO
// =====================================================

function calcularVolumeRaio(progresso) {
  const p = Phaser.Math.Clamp(progresso, 0, 1);

  // Primeira metade: volume aumentando.
  if (p <= PONTO_VOLUME_MAXIMO) {
    const crescimento = suavizarProgresso(p / PONTO_VOLUME_MAXIMO);

    return (
      VOLUME_INICIAL_RAIO +
      (VOLUME_MAXIMO_RAIO - VOLUME_INICIAL_RAIO) * crescimento
    );
  }

  // Segunda metade: volume diminuindo.
  const reducao = suavizarProgresso(
    (p - PONTO_VOLUME_MAXIMO) / (1 - PONTO_VOLUME_MAXIMO),
  );

  return (
    VOLUME_MAXIMO_RAIO + (VOLUME_FINAL_RAIO - VOLUME_MAXIMO_RAIO) * reducao
  );
}

// =====================================================
// DESTRUIR INSTÂNCIA DO ÁUDIO
// =====================================================

function destruirAudioRaio(boss) {
  if (!boss?.somRaioBoss) {
    return;
  }

  boss.somRaioBoss.stop();
  boss.somRaioBoss.destroy();

  boss.somRaioBoss = null;
}

// =====================================================
// PARAR COMPLETAMENTE O SOM
// =====================================================

export function pararSomRaioBoss(boss) {
  if (!boss) {
    return;
  }

  const scene = boss.scene;

  // Remover atualização do áudio.
  if (scene?.events && boss.somRaioAtualizacao) {
    scene.events.off(Phaser.Scenes.Events.UPDATE, boss.somRaioAtualizacao);
  }

  // Remover listener de derrota.
  if (scene?.events && boss.somRaioAoDerrotar) {
    scene.events.off("boss:derrotado", boss.somRaioAoDerrotar);
  }

  // Remover listener de encerramento da cena.
  if (scene?.events && boss.somRaioAoEncerrar) {
    scene.events.off(Phaser.Scenes.Events.SHUTDOWN, boss.somRaioAoEncerrar);
  }

  boss.somRaioAtualizacao = null;
  boss.somRaioAoDerrotar = null;
  boss.somRaioAoEncerrar = null;

  // Parar e destruir o áudio.
  destruirAudioRaio(boss);
}

// =====================================================
// ATUALIZAR O VOLUME DO RAIO
// =====================================================

export function atualizarSomRaioBoss(boss) {
  if (!boss) {
    return;
  }

  const scene = boss.scene;
  const ia = boss.iaCombate;

  // Se o boss morreu, a cena terminou ou outro
  // ataque começou, interromper imediatamente.
  if (
    !boss.active ||
    boss.morto ||
    !scene ||
    scene.morteEmAndamento ||
    ia?.ataqueAtual !== "raioChao"
  ) {
    pararSomRaioBoss(boss);
    return;
  }

  // ===================================================
  // AGUARDAR O RAIO APARECER NO CHÃO
  // ===================================================

  // O raio visual é ativado pelo BossRaioZonas.js.
  // Não reproduzir som durante a preparação do boss.
  if (
    !ia.raioVisualAtivo ||
    ia.raioAguardandoInicio ||
    !boss.raioZonaSprite?.visible ||
    ia.raioInicioMs === null ||
    ia.raioDuracaoMs <= 0
  ) {
    destruirAudioRaio(boss);
    return;
  }

  // ===================================================
  // PROGRESSO REAL DA ANIMAÇÃO VISUAL
  // ===================================================

  const tempoDecorrido = Math.max(0, scene.time.now - ia.raioInicioMs);

  const progresso = Phaser.Math.Clamp(tempoDecorrido / ia.raioDuracaoMs, 0, 1);

  // Raio terminou.
  if (progresso >= 1) {
    pararSomRaioBoss(boss);
    return;
  }

  // ===================================================
  // INICIAR ÁUDIO NO PRIMEIRO FRAME VISUAL
  // ===================================================

  if (!boss.somRaioBoss) {
    if (!scene.cache.audio.exists(CHAVE_SOM_RAIO)) {
      console.warn("Boss: áudio do raio não foi carregado.");

      pararSomRaioBoss(boss);
      return;
    }

    boss.somRaioBoss = scene.sound.add(CHAVE_SOM_RAIO, {
      volume: VOLUME_INICIAL_RAIO,
      loop: true,
    });

    boss.somRaioBoss.play();
  }

  // ===================================================
  // ACOMPANHAR A INTENSIDADE DO RAIO
  // ===================================================

  const volume = calcularVolumeRaio(progresso);

  boss.somRaioBoss.setVolume(volume);
}

// =====================================================
// ATIVAR MONITORAMENTO DO SOM
// =====================================================

export function ativarMonitorSomRaioBoss(boss) {
  if (!boss?.active || !boss.scene || boss.somRaioAtualizacao) {
    return;
  }

  const scene = boss.scene;

  // Atualizar o volume continuamente.
  boss.somRaioAtualizacao = () => {
    atualizarSomRaioBoss(boss);
  };

  scene.events.on(Phaser.Scenes.Events.UPDATE, boss.somRaioAtualizacao);

  // Parar o som se o boss for derrotado.
  boss.somRaioAoDerrotar = (evento) => {
    if (evento?.boss === boss) {
      pararSomRaioBoss(boss);
    }
  };

  scene.events.on("boss:derrotado", boss.somRaioAoDerrotar);

  // Parar o áudio ao sair da cena.
  boss.somRaioAoEncerrar = () => {
    pararSomRaioBoss(boss);
  };

  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, boss.somRaioAoEncerrar);
}
