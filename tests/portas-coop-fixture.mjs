/** Duas cenas Phaser reais; assets da porta do mapa 2 e transporte local com atraso. */
import { criarInteracaoPortaFabrica } from '../js/interactions/FactoryDoor.js';
import { CoopWorld } from '../js/multiplayer/CoopWorld.js';

export async function criarFixturePortas() {
  const raw = await (await fetch('/assets/map/parte2-fase1.json')).json();
  const interacoes = raw.layers.find(l => l.objects?.some(o => o.name === 'porta01'));
  const area = interacoes.objects.find(o => o.name === 'porta01');
  const atlas = raw.tilesets.find(t => t.name === 'A5_SciFi_Industrial_Rasak');
  const tiles = raw.layers.find(l => l.name === 'Portas');
  const peers = [], games = [], roots = [], pendentes = new Set();
  const enviar = callback => {
    const timer = setTimeout(() => { pendentes.delete(timer); callback(); }, 50);
    pendentes.add(timer);
  };
  for (let i = 0; i < 2; i++) {
    const root = document.createElement('div'); root.id = `porta-peer-${i}`;
    root.style.cssText = 'display:inline-block;margin:8px;border:1px solid #788498';
    document.body.append(root); roots.push(root);
    await new Promise(resolve => {
      const game = new Phaser.Game({ type: Phaser.CANVAS, parent: root, width: 440, height: 300,
        banner: false, backgroundColor: '#202831', pixelArt: true, audio: { noAudio: true },
        dom: { createContainer: true },
        physics: { default: 'arcade', arcade: { gravity: { y: 0 } } }, scene: {
          key: 'Level1Parte2',
          preload() { this.load.image('door-atlas', '/Tilesets/Industrial/A5_SciFi_Industrial_Rasak.png'); },
          create() {
            const map = this.make.tilemap({ tileWidth: 48, tileHeight: 48, width: 3, height: 2 });
            const set = map.addTilesetImage(atlas.name, 'door-atlas', 48, 48, 0, 0, atlas.firstgid);
            const layer = map.createBlankLayer('Portas', set, area.x, area.y, 3, 2, 48, 48);
            for (const chunk of tiles.chunks) {
              const bytes = Uint8Array.from(atob(chunk.data), c => c.charCodeAt(0));
              const data = new DataView(bytes.buffer);
              for (let row = 0; row < 2; row++) for (let col = 0; col < 3; col++) {
                const x = area.x / 48 + col - chunk.x, y = area.y / 48 + row - chunk.y;
                if (x >= 0 && x < chunk.width && y >= 0 && y < chunk.height)
                  map.putTileAt(data.getUint32((y * chunk.width + x) * 4, true), col, row, false, layer);
              }
            }
            map.objects = [{ name: interacoes.name, objects: [{ ...area }] }];
            this.map = map; this.multiplayer = true; this.luzFabricaAcesa = true;
            this.personagemSelecionada = 'kai-mercer';
            this.inventory = { getQuantity: () => 0 };
            this.player = this.add.rectangle(area.x + 72, area.y + area.height + 28, 18, 24, 0x77dcee);
            this.collisionGroup = this.physics.add.staticGroup();
            this.cameras.main.setZoom(2).centerOn(area.x + 72, area.y + 65);
            criarInteracaoPortaFabrica(this);
            this.add.text(area.x - 24, area.y - 14, i ? 'CLIENTE' : 'HOST', { fontSize: '12px' }).setDepth(300);
            peers.push(this); resolve();
          },
        } }); games.push(game);
    });
  }
  for (const [i, scene] of peers.entries()) {
    const manager = { playerId: i ? 'client' : 'host', room: { coopProgress: { flags: {}, collected: {} } },
      publishState() {}, sendCoopAction(kind, payload, options = {}) {
        const action = structuredClone({ kind, payload, playerId: this.playerId, ...options });
        enviar(() => peers[options.authority ? 1 : 0].coopRuntime.world.receive(action));
        return true;
      } };
    const runtime = scene.coopRuntime = { scene, manager, host: !i, mapKey: 'Level1Parte2',
      players: { remotes: new Map() } };
    runtime.world = new CoopWorld(runtime);
  }
  peers[0].coopRuntime.players.remotes.set('client', { actor: peers[1].player, data: {} });
  const snapshots = setInterval(() => {
    const frame = structuredClone(peers[0].coopRuntime.world.snapshot());
    enviar(() => peers[1].coopRuntime.world.receiveFrame(frame));
  }, 1000 / 12);
  const button = document.createElement('button'); button.id = 'abrir-porta-cliente';
  button.textContent = 'ABRIR PELO CLIENTE'; button.style.cssText = 'display:block;margin:12px;padding:12px';
  button.onclick = () => peers[1].interacaoMundoProxima?.interact(); document.body.append(button);
  return {
    peers,
    estado: () => peers.map(s => ({ estado: s.portaFabrica.estado, progresso: s.portaFabrica.progresso,
      y: s.portaFabrica.visual.y, visivel: s.portaFabrica.visual.visible,
      colisao: !!s.portaFabrica.colisao, aberta: s.registry.get('factoryDoorOpen') === true })),
    destroy() {
      clearInterval(snapshots); for (const t of pendentes) clearTimeout(t);
      for (const s of peers) s.coopRuntime.world.destroy();
      for (const g of games) g.destroy(true);
      for (const r of roots) r.remove(); button.remove();
    },
  };
}
