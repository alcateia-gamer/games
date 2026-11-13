import { ECONOMY_KEY } from '../systems/UpgradeSystem.js';
import { CutsceneLoading } from "../ui/CutsceneLoading.js";

/** A introdução começa junto com a importação e permanece durante a fila de assets. */
export default class BootPartida extends Phaser.Scene {
  constructor() {
    super("BootPartida");
  }

  create(data = {}) {
    this.registry.remove(ECONOMY_KEY);
    const manager = this.registry.get("multiplayer");
    if (manager?.room) delete manager.room.upgradeEconomy;
    this.registry.set("lojaArmasVisitada", false);
    this.registry.set("tanqueCombustivelUsado", false);
    this.registry.set("fabricaVisitada", false);
    this.cameras.main.setBackgroundColor("#000000");
    const cutscene = new CutsceneLoading(this.game);
    cutscene.attach(this);
    const carregar = async () => {
      try {
        const [preloader, cidade, fabrica] = await Promise.all([
          import("./preloader.js"), import("./Level1.js"), import("./Level1Parte2.js"),
        ]);
        if (!this.scene.isActive()) return;
        for (const [key, Scene] of [["preloader", preloader.default], ["Level1", cidade.default], ["Level1Parte2", fabrica.default]]) {
          if (!this.game.scene.keys[key]) this.game.scene.add(key, Scene);
        }
        cutscene.clearMessage();
        cutscene.release();
        this.scene.start("preloader", { ...data, cutscene });
      } catch (error) {
        if (!this.scene.isActive()) return;
        console.error("Erro ao preparar a partida:", error);
        cutscene.showLoadError("Não foi possível preparar a partida.", () => { void carregar(); });
      }
    };
    void carregar();
  }
}
