/** Prepara a segunda fase com um ponto de vida, exclusivamente para testes em DEV. */
import { jogadorNaArenaNovoBoss } from '../enemies/novoBoss/NovoBossConfig.js';
import { HACKING_KEYS } from '../puzzles/HackingConfig.js';

export function prepararBossDevFase2(scene, context = scene) {
  const boss = scene.novoBoss;
  if (!context.developerMode || scene.sys.settings.key !== 'Level1Parte2' ||
      !context.player?.active || context.morteEmAndamento || context.vida <= 0 ||
      context.generatorMenuOpen || context.upgradeMenuOpen || context.devItemMenuOpen ||
      scene.transicaoEmAndamento || scene.transicaoRetornoEmAndamento || scene.cenaEntradaBossAtiva ||
      !boss?.combateInicializado || !boss.sprite?.active || boss.active === false || boss.encerrado || boss.morto ||
      typeof boss.verificarFase !== 'function' ||
      !jogadorNaArenaNovoBoss(context.player, boss.config.arena)) return false;
  const anterior = boss.vida;
  boss.vida = 1;
  boss.danoAdiadoPrologo = 0;
  scene.events?.emit('novo-boss:vida', { encontro: boss, anterior, vida: 1, vidaMaxima: boss.vidaMaxima });
  // Conserva os pontos das torres e o controlador, evitando recriar escudo/prólogo.
  for (const gerador of boss.geradores ?? []) {
    gerador.recolher?.();
    gerador.suspenderColisao?.();
    gerador.ligado = false; gerador.morto = true; gerador.vida = 0;
    if (gerador.body) gerador.body.enable = false;
  }
  boss.sistemaGeradores?.controlarEscudo(0, false, false);
  boss.barreiraAtiva = false;
  boss.jogadorNaArena = true;
  boss.prologo?.concluirAntecipado?.();
  boss.verificarFase();
  // O acesso DEV pode pular a fábrica. Conservar o pré-requisito da saída e
  // do terminal final, sem conceder os objetivos opcionais ou a vitória.
  if (scene.game.registry.get(HACKING_KEYS.fabrica) !== true) scene.game.registry.set(HACKING_KEYS.fabrica, true);
  return true;
}

export function criarAtalhoDevFase2Boss(scene) {
  if (scene.sys?.settings?.key !== 'Level1Parte2') return;
  const tecla = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.M);
  const preparar = () => {
    if (!scene.developerMode || scene.morteEmAndamento || scene.generatorMenuOpen ||
        scene.upgradeMenuOpen || scene.devItemMenuOpen || !scene.player?.active) return;
    if (scene.coopRuntime) return scene.coopRuntime.manager.sendCoopAction('devBossPhase2');
    return prepararBossDevFase2(scene);
  };
  tecla.on('down', preparar);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => tecla.off('down', preparar));
}
