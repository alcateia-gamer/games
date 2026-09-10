var config = {
  type: Phaser.AUTO,
  width: 800,
  height: 450,
  fps: {
    target: 30,
    forceSetTimeOut: true,
  },
  parent: "gamer-container",
  physics: {
    default: "arcade",
    arcade: {
      gravity: { x: 0, y: 0 },
      debug: false,
    },
  },
  pointers: {
    activePointers: 3,
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
};

export default config;
