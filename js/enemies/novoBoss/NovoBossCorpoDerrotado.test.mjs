import test from 'node:test';
import assert from 'node:assert/strict';
import { criarColisaoCorpoDerrotado, destruirColisaoCorpoDerrotado } from './NovoBossCorpoDerrotado.js';
import { assetsNovoBoss } from './NovoBossAssets.js';
import { retanguloLivreDoMapa } from '../EnemyPathfinding.js';

test('cadáver bloqueia apenas a base da túnica, espelha o pivô e libera o obstáculo na limpeza', () => {
  for (const flipX of [false, true]) {
    const objetos = [];
    const scene = { collisionGroup: { getChildren: () => objetos,
      create(x, y) {
        const objeto = { active: true, x, y,
          setName(name) { this.name = name; return this; },
          setVisible(visible) { this.visible = visible; return this; },
          setDisplaySize(width, height) { this.body.setSize(width, height); return this; },
          destroy() { this.active = false; this.body.enable = false; objetos.splice(objetos.indexOf(this), 1); },
          body: { enable: true, setSize(width, height) { Object.assign(this, { width, height }); },
            updateFromGameObject() { this.x = x - this.width/2; this.y = y - this.height/2; } },
        };
        objetos.push(objeto); return objeto;
      } } };
    const encontro = { sprite: { x: -1080, y: -5810, scaleX: .55, scaleY: .55, flipX,
      originX: flipX ? 1-assetsNovoBoss.morte.origemX : assetsNovoBoss.morte.origemX,
      originY: assetsNovoBoss.morte.origemY, texture: { key: assetsNovoBoss.morte.chave } } };
    criarColisaoCorpoDerrotado(scene, encontro); criarColisaoCorpoDerrotado(scene, encontro);
    assert.equal(objetos.length, 1);
    const corpo = encontro.colisaoCadaver, b = corpo.body;
    assert.ok(Math.abs(b.width - 35.2) < 1e-8);
    assert.ok(Math.abs(b.height - 15.4) < 1e-8);
    assert.ok(Math.abs(b.x - (-1080 + (flipX ? -50 : -14)*.55)) < 1e-8);
    assert.ok(Math.abs(b.y - (-5810 + 91*.55)) < 1e-8);
    assert.equal(corpo.visible, false);
    assert.equal(retanguloLivreDoMapa(scene, b), false);
    destruirColisaoCorpoDerrotado(scene, encontro); destruirColisaoCorpoDerrotado(scene, encontro);
    assert.equal(encontro.colisaoCadaver, null);
    assert.equal(corpo.active, false);
    assert.equal(retanguloLivreDoMapa(scene, b), true);
  }
});
