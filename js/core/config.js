/**
 * @file Configuração do Phaser: resolução lógica, física Arcade, entrada, escala e conexão
 * MQTT.
 */

var config = {
  // WebGL permite os shaders de clima e os efeitos gráficos usados pelo jogo.
  type: Phaser.WEBGL,
  // Base 16:9 usada pelos menus e controles; FIT mantém toda a área dentro da janela.
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
  // Ajusta o canvas proporcionalmente e centraliza o jogo nos dois eixos.
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  // Endereço do broker e prefixo que agrupam os tópicos de rede desta aplicação.
  mqtt: {
    brokerUrl: "wss://broker.hivemq.com:8884/mqtt",
    topicPrefix: "nullborns-night-city",
  },
};

export default config;
