import { CHARACTER_NAMES } from '../systems/UpgradeDefinitions.js';
import { NPC_NAME } from '../narrative/NPCDialogues.js';
const textures = { 'kai-mercer': 'walk', 'magnus-force': 'personagem2-walk', 'aria-kade': 'personagem3-walk', nyx: 'personagem4-walk' };
const portraits = new WeakMap();
/** Recorta a cabeça no topo da área opaca do frame original. Cache por TextureManager. */
export function headPortrait(scene, key, index) {
  let cache = portraits.get(scene.textures);
  if (!cache) portraits.set(scene.textures, cache = new Map());
  const id = `${key}:${index}`;
  if (cache.has(id)) return cache.get(id);
  const f = scene.textures.getFrame(key, index);
  if (!f) return '';
  const source = document.createElement('canvas'); source.width = f.cutWidth; source.height = f.cutHeight;
  const ctx = source.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(f.source.image, f.cutX, f.cutY, f.cutWidth, f.cutHeight, 0, 0, source.width, source.height);
  const pixels = ctx.getImageData(0, 0, source.width, source.height).data;
  let left = source.width, right = 0, top = source.height, bottom = 0;
  for (let y = 0; y < source.height; y++) for (let x = 0; x < source.width; x++) if (pixels[(y * source.width + x) * 4 + 3] > 32) {
    left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y);
  }
  if (left > right) return '';
  const height = Math.max(1, Math.ceil((bottom - top + 1) * (key === 'personagem3-walk' ? .56 : .43)));
  left = source.width; right = 0;
  for (let y = top; y < top + height; y++) for (let x = 0; x < source.width; x++) if (pixels[(y * source.width + x) * 4 + 3] > 32) {
    left = Math.min(left, x); right = Math.max(right, x);
  }
  const width = right - left + 1;
  const head = document.createElement('canvas'); head.width = width; head.height = height;
  head.getContext('2d').drawImage(source, left, top, width, height, 0, 0, width, height);
  const url = head.toDataURL(); cache.set(id, url); return url;
}
export class DialogueUI {
  constructor(scene, advance, close) {
    this.root = document.createElement('div'); this.root.className = 'npc-dialogue';
    this.root.innerHTML = `<section role="dialog" aria-modal="true" aria-label="Conversa com o sucateiro" class="npc-dialogue-shell">
      <div class="npc-portraits"><figure data-speaker="npc"><img alt="Retrato do sucateiro"><figcaption></figcaption></figure><span>CANAL LOCAL // ENCRIPTADO</span><figure data-speaker="player"><img alt="Retrato do personagem"><figcaption></figcaption></figure></div>
      <div class="npc-dialogue-box"><strong data-name></strong><p data-text></p><small>Clique / toque / E: revelar ou avançar · avanço automático</small><button type="button" data-cancel>SAIR [ESC]</button></div></section>`;
    document.getElementById('game-container').append(this.root);
    const character = scene.personagemSelecionada;
    this.names = { npc: NPC_NAME, player: CHARACTER_NAMES[character] };
    for (const role of ['npc', 'player']) {
      const figure = this.root.querySelector(`[data-speaker="${role}"]`);
      figure.querySelector('figcaption').textContent = this.names[role];
      figure.querySelector('img').src = headPortrait(scene, role === 'npc' ? 'upgrade-npc' : textures[character], role === 'npc' ? 180 : 18);
    }
    this.text = this.root.querySelector('[data-text]');
    this.root.addEventListener('pointerdown', e => e.stopPropagation());
    this.root.addEventListener('click', e => { e.stopPropagation(); if (e.target.closest('[data-cancel]')) close(); else advance(); });
    this.root.querySelector('button').focus();
  }
  line(line) {
    this.root.querySelector('[data-name]').textContent = this.names[line.speaker];
    for (const figure of this.root.querySelectorAll('figure')) figure.classList.toggle('speaking', figure.dataset.speaker === line.speaker);
    this.setText('');
  }
  setText(value) { if (this.text.textContent !== value) this.text.textContent = value; }
  destroy() { this.root.remove(); }
}
