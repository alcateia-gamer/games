import config from "./config.js";

import Start from "../scenes/start.js";
import PreLoader from "../scenes/preloader.js";
import Level1 from "../scenes/Level1.js";
import Level1Parte2 from "../scenes/Level1Parte2.js";
import MultiplayerMenu from "../scenes/MultiplayerMenu.js";
import MultiplayerLobby from "../scenes/MultiplayerLobby.js";
import MqttClient from "../mqttClient.js";
import MultiplayerManager from "../multiplayer/multiplayerManager.js";

function atualizarEscalaComViewport(game) {
  game.scale.refresh();
}

function registrarAtualizacaoDeViewport(game) {
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
  constructor() {
    super(config);

    this._unlockAudio = () => {
      const soundManager = this.sound;

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

    const mqttClient = new MqttClient(config.mqtt);
    const multiplayer = new MultiplayerManager(mqttClient);
    this.registry.set("mqtt", mqttClient);
    this.registry.set("multiplayer", multiplayer);

    this.scene.add("Start", Start);

    this.scene.add("preloader", PreLoader);

    this.scene.add("Level1", Level1);

    this.scene.add("Level1Parte2", Level1Parte2);
    this.scene.add("MultiplayerMenu", MultiplayerMenu);
    this.scene.add("MultiplayerLobby", MultiplayerLobby);

    this.scene.start("Start");
  }
}

window.onload = () => {
  const game = new Game();
  registrarAtualizacaoDeViewport(game);
};
