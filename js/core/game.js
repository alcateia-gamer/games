/**
 * @file Ponto de entrada do jogo. Registra as cenas e compartilha os serviços de rede pelo
 * registry do Phaser.
 */

import config from "./config.js";

import Start from "../scenes/start.js";
import PreLoader from "../scenes/preloader.js";
import Level1 from "../scenes/Level1.js";
import Level1Parte2 from "../scenes/Level1Parte2.js";
import MultiplayerMenu from "../scenes/MultiplayerMenu.js";
import MultiplayerLobby from "../scenes/MultiplayerLobby.js";
import MqttClient from "../mqttClient.js";
import MultiplayerManager from "../multiplayer/multiplayerManager.js";

/**
 * Atualiza a escala do canvas após uma mudança no tamanho visível da página.
 */
function atualizarEscalaComViewport(game) {
  game.scale.refresh();
}

/**
 * Registra os eventos de tamanho, orientação e tela cheia que exigem recalcular a escala.
 */
function registrarAtualizacaoDeViewport(game) {
  /**
   * Adia o ajuste da escala para o próximo quadro do navegador.
   */
  const atualizar = () => {
    window.requestAnimationFrame(() => atualizarEscalaComViewport(game));
  };

  window.addEventListener("resize", atualizar, { passive: true });
  window.addEventListener("orientationchange", atualizar, { passive: true });
  document.addEventListener("fullscreenchange", atualizar, { passive: true });
  document.addEventListener("webkitfullscreenchange", atualizar, {
    passive: true,
  });

  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", atualizar, {
      passive: true,
    });
  }
}

class Game extends Phaser.Game {
  /**
   * Cria o jogo, prepara o desbloqueio de áudio, registra as cenas e abre a tela inicial.
   */
  constructor() {
    super(config);

    /**
     * Tenta liberar o áudio após a primeira interação do usuário com a página.
     */
    this._unlockAudio = () => {
      const soundManager = this.sound;

      /**
       * Retoma o contexto de áudio e os sons suspensos, tratando falhas do navegador.
       */
      const resumeAudio = async () => {
        try {
          if (soundManager?.context && soundManager.context.state === "suspended") {
            await soundManager.context.resume();
          }

          if (typeof soundManager?.resumeAll === "function") {
            soundManager.resumeAll();
          }
        } catch (error) {
          console.warn("Audio não pôde ser desbloqueado:", error);
        }
      };

      void resumeAudio();
    };

    ["pointerdown", "touchstart", "keydown"].forEach((nomeEvento) => {
      window.addEventListener(
        nomeEvento,
        this._unlockAudio,
        { once: true, passive: true },
      );
    });

    // O registry compartilha estas instâncias entre menus e fases.
    const mqttClient = new MqttClient(config.mqtt);
    const multiplayer = new MultiplayerManager(mqttClient);
    this.registry.set("mqtt", mqttClient);
    this.registry.set("multiplayer", multiplayer);

    // As chaves registradas aqui devem coincidir com os nomes usados em scene.start.
    this.scene.add("Start", Start);

    this.scene.add("preloader", PreLoader);

    this.scene.add("Level1", Level1);

    this.scene.add("Level1Parte2", Level1Parte2);
    this.scene.add("MultiplayerMenu", MultiplayerMenu);
    this.scene.add("MultiplayerLobby", MultiplayerLobby);

    this.scene.start("Start");
  }
}

/**
 * Instancia o jogo quando a página termina de carregar e conecta os ajustes de viewport.
 */
window.onload = () => {
  const game = new Game();
  registrarAtualizacaoDeViewport(game);
};
git