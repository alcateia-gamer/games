import { MATRIX_NODES as N, MATRIX_LINKS as LINKS } from '../puzzles/HackingConfig.js';
import { MatrixPuzzle } from '../puzzles/MatrixPuzzle.js';
import { criarInterfaceMatrix } from '../ui/MatrixPuzzleUI.js';

/** Espaço digital jogável; a simulação permanece no controlador autoritativo da fábrica. */
export default class MatrixHacking extends Phaser.Scene {
  constructor() { super('MatrixHacking'); }
  init(data) { this.controller = data.controller; this.lastInput = -Infinity; this.ultimaDirecao = null; this.conclusaoCamera = false; }
  create() {
    this.cameras.main.setBackgroundColor('#030915');
    this.graphics = this.add.graphics();
    this.labels = Object.fromEntries(Object.entries(N).map(([key, n]) => [key,
      this.add.text(n.x, n.y + 34, n.label, { fontFamily: 'monospace', fontSize: '10px', color: '#8bcbc7', resolution: 2,
        align: 'center', wordWrap: { width: 144 } }).setOrigin(.5, 0)]));
    this.fragmentos = ['04::NULL', 'TOKEN-E9', 'EDEN.LIFE'].map((code, i) =>
      this.add.text(205 + i * 48, 108 + i * 17, code, { fontFamily: 'monospace', fontSize: '10px', color: '#b394db' }).setAlpha(.55));
    this.pet = this.add.sprite(N.entrada.x, N.entrada.y, 'robo-pet', 0).setScale(.14).setOrigin(.5, .65).setDepth(3);
    for (const [dir, [start, end]] of Object.entries({ down: [0, 12], left: [13, 25], right: [26, 38], up: [39, 51] })) {
      const key = `companion-pet-walk-${dir}`;
      if (!this.anims.exists(key)) this.anims.create({ key, frames: this.anims.generateFrameNumbers('robo-pet', { start, end }), frameRate: 12, repeat: -1 });
    }
    this.keys = this.input.keyboard.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,E,ESC');
    this.ui = criarInterfaceMatrix(command => this.controller.enviar(command));
    this.resize = () => {
      const c = this.cameras.main, density = this.game.canvas.getBoundingClientRect().width / this.scale.gameSize.width;
      const mobile = window.innerWidth <= 900 || window.innerHeight <= 500;
      if (mobile && !this.conclusaoCamera) c.setBounds(-80, -140, 960, 700).setZoom(1.05 / density).startFollow(this.pet, false, .15, .15);
      else c.stopFollow().removeBounds().setZoom(Math.min(this.scale.gameSize.width / 810,
        (this.scale.gameSize.height - 60) / 430)).centerOn(405, 200);
      for (const label of Object.values(this.labels)) label.setFontSize(Math.max(10, Math.round(11 / (density * c.zoom))));
    };
    this.scale.on('resize', this.resize); this.resize();
    this.events.once('shutdown', () => {
      this.scale.off('resize', this.resize); this.ui.destruir();
      for (const key of Object.values(this.keys)) key.destroy();
      this.controller = null;
    });
  }
  update(time, delta) {
    const s = this.controller?.estadoLocal()?.model;
    if (!s) return;
    const touch = this.ui.direcao(), k = this.keys;
    const x = touch.x + Number(k.D.isDown || k.RIGHT.isDown) - Number(k.A.isDown || k.LEFT.isDown);
    const y = touch.y + Number(k.S.isDown || k.DOWN.isDown) - Number(k.W.isDown || k.UP.isDown);
    const direcao = `${x}:${y}`;
    if (direcao !== this.ultimaDirecao || time - this.lastInput >= 100) {
      this.controller.enviar({ op: 'mover', x, y }); this.lastInput = time; this.ultimaDirecao = direcao;
    }
    if (Phaser.Input.Keyboard.JustDown(k.E)) this.controller.enviar({ op: 'interagir' });
    if (Phaser.Input.Keyboard.JustDown(k.ESC)) this.controller.enviar({ op: 'cancelar' });
    if (s.estado === 'executando' && !this.conclusaoCamera) {
      this.conclusaoCamera = true;
      this.cameras.main.stopFollow().removeBounds().zoomTo(Math.min(this.scale.gameSize.width / 810,
        (this.scale.gameSize.height - 60) / 430), 650).pan(405, 200, 650);
    }
    this.ui.atualizar(s); this.desenhar(s, delta);
  }
  desenhar(s, delta = 33) {
    const g = this.graphics; g.clear();
    const model = Object.assign(Object.create(MatrixPuzzle.prototype), s);
    g.lineStyle(1, 0x347582, .11);
    for (let x = 0; x < 810; x += 24) g.lineBetween(x, 0, x, 420);
    for (let y = 0; y < 420; y += 24) g.lineBetween(0, y, 810, y);
    for (const [index, [a, b, tipo]] of LINKS.entries()) {
      const estado = model.estadoLigacao(a, b, tipo), na = N[a], nb = N[b];
      let color = estado === 'livre' ? 0x1c757f : estado === 'alerta' ? 0xf5c96b : 0xb64b73;
      if (s.conclusao > (LINKS.length - index - 1) / LINKS.length) color = 0x78edba;
      if (tipo === 'nucleo' && s.conclusao > 0) color = 0x7bffca;
      if (a === 'roteador' && b === 'vidaA') color = s.vida.A ? 0x60b8a2 : 0xe78b65;
      g.lineStyle(32, 0x071b2c, estado === 'oculta' ? .08 : .9).lineBetween(na.x, na.y, nb.x, nb.y);
      if (!['oculta', 'instavel', 'bloqueada'].includes(estado)) g.lineStyle(22, color, .44).lineBetween(na.x, na.y, nb.x, nb.y);
      g.lineStyle(1, color, estado === 'oculta' ? .1 : .85).lineBetween(na.x, na.y - 15, nb.x, nb.y - 15);
      if (['instavel', 'bloqueada'].includes(estado)) {
        const cx = (na.x + nb.x) / 2, cy = (na.y + nb.y) / 2;
        g.lineStyle(3, color, .9).strokeRect(cx - 12, cy - 20, 24, 40);
      }
    }
    for (const [index, [key, n]] of Object.entries(N).entries()) {
      const protegido = key === 'vidaA' ? s.vida.A : key === 'vidaB' ? s.vida.B : false;
      const color = n.tipo === 'vida' ? protegido ? 0x7effbe : 0xe5b96b : s.conclusao > index / 10 ? 0x78edba : key === 'anomalia' ? 0xb294f2 : 0x58d6d3;
      const glitch = key === 'anomalia' && !s.anomalia ? Math.floor(s.tempo / 120) % 3 - 1 : 0;
      g.fillStyle(0x071925, 1).fillRect(n.x - 29 + glitch, n.y - 25, 58, 50);
      g.lineStyle(2, color, .9).strokeRect(n.x - 29 + glitch, n.y - 25, 58, 50);
      g.fillStyle(color, .3).fillRect(n.x - 21, n.y + 17, 42, 4);
      if (key === 'nucleo') {
        g.lineStyle(2, s.conclusao > 0 ? 0x85ffcf : 0xff8392, .8).strokeCircle(n.x, n.y, 14 + Math.sin(s.tempo / 300) * 2);
        if (s.conclusao > 0) g.fillStyle(0x91ffdc, .2 + s.conclusao * .6).fillCircle(n.x, n.y, 22 * s.conclusao);
      }
    }
    for (const [i, text] of this.fragmentos.entries()) text.setY(108 + i * 17 + Math.sin(s.tempo / 250 + i) * 2)
      .setAlpha(s.conclusao > .7 ? .2 : .45 + Math.sin(s.tempo / 180 + i) * .15);
    if (s.virus.liberado) {
      const v = s.virus; g.fillStyle(0xbd91ff, .25).fillCircle(v.x, v.y, 14);
      g.fillStyle(0xf4daff, 1).fillRect(v.x - 5, v.y - 5, 10, 10);
      if (s.tempo >= s.ice.pausadoAte) {
        const ice = s.ice; g.lineStyle(2, 0xff657d, .4).strokeCircle(ice.x, ice.y, 26);
        g.fillStyle(0xf35a79, .95).fillTriangle(ice.x, ice.y - 12, ice.x - 10, ice.y + 10, ice.x + 10, ice.y + 10);
      }
    }
    const dx = s.avatar.x - this.pet.x, dy = s.avatar.y - this.pet.y;
    if (Math.hypot(dx, dy) > .4) this.pet.anims.play(`companion-pet-walk-${Math.abs(dx) > Math.abs(dy) ? dx > 0 ? 'right' : 'left' : dy > 0 ? 'down' : 'up'}`, true);
    else this.pet.anims.stop();
    const alpha = Math.hypot(dx, dy) > 140 ? 1 : 1 - Math.exp(-Math.max(0, delta) / 45);
    this.pet.setPosition(this.pet.x + dx * alpha, this.pet.y + dy * alpha);
  }
}
