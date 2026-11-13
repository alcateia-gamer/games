/** Atalho de desenvolvimento para chegar à entrada da arena do boss na fábrica. */
import { limparGrupoRobos } from "../enemies/EnemyTest.js";

const DESTINO_BOSS = Object.freeze({ x: -1085, y: -5169 });

export function criarTeleporteDevBoss(scene) {
  const tecla = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.O);
  const teleportar = () => {
    if (!scene.developerMode || scene.morteEmAndamento ||
        scene.transicaoEmAndamento || scene.transicaoRetornoEmAndamento ||
        !scene.player?.active || (scene.generatorMenuOpen || scene.upgradeMenuOpen) || scene.devItemMenuOpen ||
        scene.cenaEntradaBossAtiva) return;

    if (scene.sys.settings.key === "Level1Parte2") {
      if (scene.estadoDash) scene.estadoDash.ativo = false;
      scene.player.body.reset(DESTINO_BOSS.x, DESTINO_BOSS.y);
      scene.companionPet?.setPosition(DESTINO_BOSS.x - 45, DESTINO_BOSS.y + 35);
      return;
    }

    if (scene.coopRuntime) {
      scene.coopRuntime.world.requestMap("Level1Parte2", { boss: true, developer: true });
      return;
    }

    scene.transicaoEmAndamento = true;
    scene.physics.pause();
    limparGrupoRobos(scene);
    scene.scene.start("Level1Parte2", {
      spawnX: DESTINO_BOSS.x,
      spawnY: DESTINO_BOSS.y,
      personagem: scene.personagemSelecionada,
      multiplayer: scene.multiplayer === true,
      developerMode: true,
    });
  };

  scene.teleportarDevBoss = teleportar;
  tecla.on("down", teleportar);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    tecla.off("down", teleportar);
    if (scene.teleportarDevBoss === teleportar) scene.teleportarDevBoss = null;
  });
}
