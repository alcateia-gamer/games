import { registrarDesbloqueioAudio } from "./AudioUnlock.js";
/**
 * @file Ponto de entrada do jogo. Registra as cenas e compartilha os serviços de rede pelo
 * registry do Phaser.
 */

import config from "./config.js";
import { solicitarTelaCheiaMobile, registrarAtualizacaoDeViewport } from "./MobileDisplay.js";

import Start from "../scenes/start.js";
import BootPartida from "../scenes/BootPartida.js";
import MultiplayerMenu from "../scenes/MultiplayerMenu.js";
import MultiplayerLobby from "../scenes/MultiplayerLobby.js";

class Game extends Phaser.Game {
  /**
   * Cria o jogo, prepara o desbloqueio de áudio, registra as cenas e abre a tela inicial.
   */
  constructor(jogoRapido = false) {
    // O boot interno do Phaser pode ser adiado; cria o contexto ainda durante o clique.
    const ContextoAudio = window.AudioContext || window.webkitAudioContext;
    const contextoAudio = ContextoAudio ? new ContextoAudio() : null;
    super(contextoAudio
      ? { ...config, audio: { ...config.audio, context: contextoAudio } }
      : config);

    this._audioUnlockCleanup = registrarDesbloqueioAudio(this);

    // As chaves registradas aqui devem coincidir com os nomes usados em scene.start.
    this.scene.add("Start", Start);

    this.scene.add("BootPartida", BootPartida);
    this.scene.add("MultiplayerMenu", MultiplayerMenu);
    this.scene.add("MultiplayerLobby", MultiplayerLobby);

    this.scene.start("Start", { iniciarAbertura: true, jogoRapido });
  }

  destroy(...args) {
    this._viewportCleanup?.();
    this._viewportCleanup = null;
    this._audioUnlockCleanup?.();
    this._audioUnlockCleanup = null;
    return super.destroy(...args);
  }
}

/**
 * Cria o contexto de áudio dentro de um gesto do usuário, respeitando o bloqueio de autoplay.
 */
const botaoJogar = document.getElementById("start-game");
// O botão inicial aparece antes do Phaser: prepara o efeito no áudio do navegador.
const somBotaoJogar = new Audio("assets/sounds.mp3/SONS PARA BOTAR AINDA/botao_jogar.mp3");
somBotaoJogar.preload = "auto";
somBotaoJogar.volume = 1;
let jogoIniciado = false;

function iniciarJogo(jogoRapido = false) {
  if (jogoIniciado) return;
  jogoIniciado = true;
  if (!jogoRapido) {
    void somBotaoJogar.play().catch(error => console.warn("Som do botão JOGAR:", error));
  }
  void solicitarTelaCheiaMobile();
  const game = new Game(jogoRapido);
  game._viewportCleanup = registrarAtualizacaoDeViewport(game);
  botaoJogar.remove();
  window.removeEventListener("keydown", iniciarComAtalho);
}

function iniciarComAtalho(event) {
  if (event.repeat || event.ctrlKey || event.altKey || event.metaKey) return;
  if (event.key.toLowerCase() === "k") iniciarJogo(true);
}

botaoJogar.addEventListener("click", () => iniciarJogo(), { once: true });
window.addEventListener("keydown", iniciarComAtalho);
