/**
 * @file Configuração do Phaser: resolução lógica, física Arcade, entrada, escala e conexão
 * MQTT.
 */

import { dispositivoComToque } from "./MobileDisplay.js";

var config = {
  // WebGL permite os shaders de clima e os efeitos gráficos usados pelo jogo.
  type: Phaser.WEBGL,
  // Resolução mínima dos menus e controles. No mobile, expande a área conforme a tela.
  width: 800,
  height: 450,
  // Preserva os pixels das imagens, inclusive nos frames de ataque dos personagens.
  render: {
    antialias: false,
    antialiasGL: false,
    // O mundo alinha os próprios vértices; a câmera mantém o HUD estável durante o zoom.
    roundPixels: false,
  },
  // Meta de quadros por segundo e escolha do agendador de atualização.
  fps: {
    target: 30,
    forceSetTimeOut: true,
  },
  // Elemento HTML que recebe o canvas criado pelo Phaser.
  parent: "game-container",
  // Física sem gravidade para o movimento visto de cima; debug exibe os corpos.
  physics: {
    default: "arcade",
    arcade: {
      gravity: { x: 0, y: 0 },
      debug: false,
    },
  },
  // Configura ponteiros adicionais para uso simultâneo dos controles por toque.
  input: {
    activePointers: 4,
  },
  // Habilita elementos HTML sobre o jogo, como o campo de código da sala.
  dom: {
    createContainer: true,
  },
  // EXPAND preenche celulares de qualquer proporção, preservando os pixels e os controles.
  scale: {
    mode: dispositivoComToque() ? Phaser.Scale.EXPAND : Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  // Endereço do broker e prefixo que agrupam os tópicos de rede desta aplicação.
  mqtt: {
    brokerUrl: "wss://broker.hivemq.com:8884/mqtt",
    topicPrefix: "nullborns-night-city",
    brokerUrl: "wss://nullborns.feira-de-jogos.dev.br/mqtt",
  },
};

export default config;
