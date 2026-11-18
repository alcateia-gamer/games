import { HACKING_KEYS as H } from "../puzzles/HackingConfig.js";
import { FACTORY_GENERATOR_STATE_KEY } from "../interactions/FactoryGenerator.js";

const FLAGS_ACESSO_FABRICA = {
  [FACTORY_GENERATOR_STATE_KEY]: true,
  [H.fabrica]: true,
  [H.registro]: true,
  [H.bruteforce]: true,
  [H.cartao]: true,
};

function podeValidar(scene, context) {
  return context.developerMode && scene.sys?.settings?.key === "Level1Parte2" &&
    context.player?.active && !context.morteEmAndamento && !(context.vida <= 0) &&
    !context.generatorMenuOpen && !context.upgradeMenuOpen && !context.devItemMenuOpen &&
    !scene.transicaoEmAndamento && !scene.transicaoRetornoEmAndamento && !scene.cenaEntradaBossAtiva &&
    !scene.hackingTerminals?.temSessao?.();
}

export function validarFabricaDev(scene, context = scene) {
  if (!podeValidar(scene, context)) return false;
  const runtime = scene.coopRuntime;
  if (runtime && !runtime.host) return false;
  if (runtime) {
    const room = runtime.manager.room;
    Object.assign(room.coopProgress.flags, FLAGS_ACESSO_FABRICA);
    room.coopDevLighting = null;
    runtime.world.generator.publish();
    runtime.world.bossLoading.releaseAccess();
  } else {
    scene.acenderLuzFabrica();
    for (const [key, value] of Object.entries(FLAGS_ACESSO_FABRICA)) {
      if (scene.game.registry.get(key) !== value) scene.game.registry.set(key, value);
    }
    scene.liberarPortasArenaAutorizadas?.();
  }
  return true;
}

export function criarAtalhoDevFabrica(scene) {
  if (scene.sys?.settings?.key !== "Level1Parte2") return;
  const tecla = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.H);
  const validar = () => {
    if (!podeValidar(scene, scene)) return;
    if (scene.coopRuntime) return scene.coopRuntime.manager.sendCoopAction("devFactoryAccess");
    return validarFabricaDev(scene);
  };
  tecla.on("down", validar);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => tecla.off("down", validar));
}
