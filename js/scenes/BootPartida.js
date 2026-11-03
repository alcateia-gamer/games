/** Carrega o código das fases somente depois de iniciar uma partida. */
export default class BootPartida extends Phaser.Scene {
  constructor() {
    super("BootPartida");
  }

  create(data) {
    this.cameras.main.setBackgroundColor("#000000");
    const status = this.add.text(400, 225, "PREPARANDO INCURSÃO...", {
      fontFamily: "monospace", fontSize: "16px", color: "#75ff9a",
    }).setOrigin(0.5);
    const carregar = async () => {
      try {
        const [preloader, cidade, fabrica] = await Promise.all([
          import("./preloader.js"), import("./Level1.js"), import("./Level1Parte2.js"),
        ]);
        if (!this.scene.isActive()) return;
        for (const [key, Scene] of [["preloader", preloader.default], ["Level1", cidade.default], ["Level1Parte2", fabrica.default]]) {
          if (!this.game.scene.keys[key]) this.game.scene.add(key, Scene);
        }
        this.scene.start("preloader", data);
      } catch (error) {
        if (!this.scene.isActive()) return;
        console.error("Erro ao preparar a partida:", error);
        status.setText("FALHA AO CARREGAR. TOQUE PARA TENTAR NOVAMENTE.")
          .setFontSize(12).setInteractive().once("pointerdown", () => {
            status.setText("PREPARANDO INCURSÃO...");
            void carregar();
          });
      }
    };
    void carregar();
  }
}
