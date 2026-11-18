/** Phaser/Arcade reais; isola a leitura dos assets pesados do combate.
 * O progresso inicial e a conexão são fixtures, sem simular transporte de rede. */
import { criarHackingFabrica } from '../js/interactions/FactoryHacking.js';
import { INTELLIGENCE_KEY, gerarMissao } from '../js/puzzles/MissionIntelligence.js';
import { HACKING_KEYS as K } from '../js/puzzles/HackingConfig.js';

export async function criarFixtureRegistro(mode = 'solo') {
  let scene;
  const parent = document.createElement('div'); document.body.append(parent);
  const game = await new Promise(resolve => {
    const g = new Phaser.Game({ type: Phaser.CANVAS, parent, width: 640, height: 400,
      banner: false, audio: { noAudio: true }, backgroundColor: '#122331',
      dom: { createContainer: true }, physics: { default: 'arcade', arcade: { gravity: { y: 0 } } },
      scene: { key: 'RegistroFixture',
        create() {
          scene = this; this.vida = 100; this.personagemSelecionada = 'kai-mercer';
          this.movimentoBloqueado = false; this.generatorMenuOpen = false; this.mundoTicks = 0;
          const art = this.add.graphics().fillStyle(0x78ddcc).fillRect(0, 0, 16, 24);
          art.generateTexture('ator-registro', 16, 24); art.destroy();
          this.player = this.physics.add.sprite(1032, -1894, 'ator-registro');
          this.cameras.main.centerOn(1032, -1954);
          this.multiplayer = mode !== 'solo';
          if (this.multiplayer) this.coopRuntime = { host: mode === 'host',
            manager: { playerId: mode, room: { hostId: 'host' }, mqtt: { connected: true }, sendCoopAction() {} },
            localContext: this, players: { remotes: new Map() } };
          this.game.registry.set(INTELLIGENCE_KEY, { config: gerarMissao(41), checkpoint: {} });
          this.game.registry.set(K.fabrica, false);
          this.e = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E);
          criarHackingFabrica(this); resolve(g);
        },
        update(time, delta) {
          if (this.hackingTerminals?.atualizar(time, delta)) return;
          this.mundoTicks++;
          if (Phaser.Input.Keyboard.JustDown(this.e)) this.interacaoHackingProxima?.interact();
        },
      } });
  });
  return {
    concluir() { game.registry.set(K.fabrica, true); game.registry.set(K.registro, true); },
    morrer() { scene.vida = 0; scene.morteEmAndamento = true; },
    recuperar() { scene.vida = 100; scene.morteEmAndamento = false; },
    desconectar() { scene.coopRuntime.manager.room = null; scene.coopRuntime.manager.mqtt.connected = false; },
    parar() { scene.scene.stop(); },
    estado() {
      return { ativo: scene.sys.isActive(), movimento: scene.movimentoBloqueado, menu: scene.generatorMenuOpen,
        input: scene.input.enabled, teclado: scene.input.keyboard?.enabled, moves: scene.player.body?.moves,
        pausado: scene.physics.world?.isPaused, ticks: scene.mundoTicks, candidato: !!scene.interacaoHackingProxima,
        snapshot: scene.hackingTerminals?.snapshot() };
    },
    destruir() { game.destroy(true); parent.remove(); },
  };
}
