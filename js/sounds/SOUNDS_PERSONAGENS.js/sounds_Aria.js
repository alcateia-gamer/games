/**
 * @file Áudio do arco da Aria. A tensão começa após o atraso configurado e é interrompida ao
 * soltar; a flecha usa um som próprio.
 */

/*
 * SONS DA ARIA KADE
 *
 * Clique rápido:
 *   - Somente o som de soltar flecha.
 *
 * Botão segurado:
 *   - Após 250 ms, começa o som de tensão.
 *   - Usa apenas o primeiro segundo do áudio.
 *   - Reproduz a tensão em velocidade 1.25x.
 *   - Quando solta, para a tensão e toca o disparo.
 */

// CHAVES DOS ÁUDIOS CARREGADOS NO PRELOADER
const CHAVE_TENSAR_ARCO = "aria-tensar-arco";
const CHAVE_SOLTAR_FLECHA = "aria-soltar-flecha";

// =====================================================
// CONFIGURAÇÕES MANUAIS
// =====================================================

// ATRASO PARA COMEÇAR O SOM
//
// Valor original: 180 ms
// Valor atual: 250 ms
//
// Aumentar = som começa mais tarde.
// Diminuir = som começa mais cedo.
const ATRASO_TENSAO_MS = 270;

// TRECHO UTILIZADO DO ÁUDIO
//
// Utiliza somente o primeiro segundo do arquivo.
const TRECHO_TENSAO_SEGUNDOS = 1;

// VELOCIDADE DO SOM DE TENSÃO
//
// 1.00 = velocidade original.
// 1.25 = 25% mais rápido.
// 1.50 = 50% mais rápido.
//
// Não modifica a velocidade das animações.
const VELOCIDADE_TENSAO = 1.25;

// VOLUMES
const VOLUME_TENSAO = 0.65;
const VOLUME_DISPARO = 0.8;

// =====================================================
// PARAR SOM DE TENSÃO
// =====================================================

/**
 * Cancela o início agendado e interrompe o áudio de tensão se ele estiver tocando.
 */
function pararSomTensaoAria(scene) {
  // Cancela o início agendado do som caso o jogador
  // solte o botão antes dos 250 ms.
  if (scene.eventoTensaoAria) {
    scene.eventoTensaoAria.remove(false);
    scene.eventoTensaoAria = null;
  }

  // Interrompe o som imediatamente quando o arco é solto.
  if (scene.somTensaoAria?.isPlaying) {
    scene.somTensaoAria.stop();
  }
}

// =====================================================
// CRIAR SOM DE TENSÃO
// =====================================================

/**
 * Cria ou reutiliza a instância com marcador do trecho de tensão e conecta sua limpeza à cena.
 */
function obterSomTensaoAria(scene) {
  // Reutiliza a instância para não criar vários sons.
  if (scene.somTensaoAria) {
    return scene.somTensaoAria;
  }

  // Evita erro caso o áudio não tenha sido carregado.
  if (!scene.cache.audio.exists(CHAVE_TENSAR_ARCO)) {
    return null;
  }

  const som = scene.sound.add(CHAVE_TENSAR_ARCO, {
    volume: VOLUME_TENSAO,
    loop: false,
  });

  // Marcador que utiliza somente o primeiro segundo
  // do arquivo MP3 original.
  som.addMarker({
    name: "primeiro-segundo",
    start: 0,
    duration: TRECHO_TENSAO_SEGUNDOS,
  });

  scene.somTensaoAria = som;

  // Limpeza ao sair da fase.
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    pararSomTensaoAria(scene);

    som.destroy();
    scene.somTensaoAria = null;
  });

  return som;
}

// =====================================================
// INICIAR SOM DE TENSÃO
// =====================================================

/**
 * Agenda a tensão do arco e só toca se a Aria continuar ativa e carregando o ataque ao vencer
 * o atraso.
 */
function iniciarSomTensaoAria(scene) {
  // O som pertence somente à Aria.
  if (
    scene.personagemSelecionada !== "aria-kade" ||
    !scene.ariaAtaqueCarregando
  ) {
    return;
  }

  pararSomTensaoAria(scene);

  // Aguarda 250 ms antes de iniciar o áudio.
  // A animação permanece na velocidade original.
  scene.eventoTensaoAria = scene.time.delayedCall(ATRASO_TENSAO_MS, () => {
    scene.eventoTensaoAria = null;

    // Não toca se o personagem morreu ou
    // se o jogador já soltou o arco.
    if (
      scene.morteEmAndamento ||
      !scene.player?.active ||
      !scene.atacando ||
      !scene.ariaAtaqueCarregando
    ) {
      return;
    }

    const som = obterSomTensaoAria(scene);

    if (!som) {
      return;
    }

    // Reproduz o primeiro segundo do áudio
    // com velocidade aumentada para 1.25x.
    //
    // O trecho de 1 segundo passa a durar
    // aproximadamente 0.8 segundo.
    som.play("primeiro-segundo", {
      rate: VELOCIDADE_TENSAO,
      volume: VOLUME_TENSAO,
    });
  });
}

// =====================================================
// SOM DE SOLTAR FLECHA
// =====================================================

/**
 * Toca um novo som de soltura para a flecha quando o arquivo necessário está no cache.
 */
function tocarSomSoltarFlechaAria(scene) {
  if (!scene.cache.audio.exists(CHAVE_SOLTAR_FLECHA)) {
    return;
  }

  // Mantém a velocidade original do disparo.
  // Toca um novo som a cada flecha disparada.
  scene.sound.play(CHAVE_SOLTAR_FLECHA, {
    volume: VOLUME_DISPARO,
  });
}

// =====================================================
// EXPORTAÇÕES
// =====================================================

export { iniciarSomTensaoAria, pararSomTensaoAria, tocarSomSoltarFlechaAria };
