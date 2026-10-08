var config = {
  type: Phaser.WEBGL,
  width: 800,
  height: 450,
  fps: {
    target: 30,
    forceSetTimeOut: true,
  },
  parent: "game-container",
  physics: {
    default: "arcade",
    arcade: {
      gravity: { x: 0, y: 0 },
      debug: false,
    },
  },
  input: {
    activePointers: 3,
  },
  dom: {
    createContainer: true,
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  mqtt: {
    brokerUrl: "wss://broker.hivemq.com:8884/mqtt",
    topicPrefix: "nexus-night-city",
  },
};

export default config;
