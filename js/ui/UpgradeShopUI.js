import { upgradeDefinitions, CHARACTER_NAMES } from '../systems/UpgradeDefinitions.js';
import { accountFor, modifiers, maximumHealth, cooldownWithModifiers } from '../systems/UpgradeSystem.js';
import { obterBalanceamento } from '../combat/CharacterBalance.js';
import { canUseShop } from '../systems/ScrapSystem.js';

const categories = { cyber: 'CIBERNÉTICAS', weapon: 'ARMAMENTO', special: 'HABILIDADES' };
const percent = value => `${Math.round(value * 100)}%`;
const textureFor = character => ({ 'kai-mercer': 'walk', 'magnus-force': 'personagem2-walk',
  'aria-kade': 'personagem3-walk', nyx: 'personagem4-walk' })[character] || 'walk';

/** DOM nativo como o HUD de status; uma instância, atualizada só por eventos. */
export class UpgradeShopUI {
  constructor(scene) {
    this.scene = scene; this.category = 'cyber'; this.region = null; this.selected = 'muscle';
    this.refresh = () => { if (scene.upgradeMenuOpen) this.render(); };
    this.result = result => {
      if (!scene.upgradeMenuOpen) return;
      this.message = result.reason; this.pending = false;
      clearTimeout(this.timer);
      this.timer = setTimeout(() => { this.busy = false; this.refresh(); }, 350);
      this.refresh();
    };
    this.onKey = event => {
      if (!scene.upgradeMenuOpen) return;
      event.stopImmediatePropagation();
      if (event.type === 'keydown' && event.code === 'Tab') {
        const buttons = [...this.root.querySelectorAll('button:not(:disabled)')];
        const first = buttons[0], last = buttons.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
      if (event.type === 'keydown' && (event.code === 'Escape' || event.code === 'KeyE')) { event.preventDefault(); if (!event.repeat) this.close(); }
    };
    scene.events.on('upgradesChanged', this.refresh); scene.events.on('upgradeResult', this.result);
    scene.events.once('shutdown', () => this.destroy());
  }
  create() {
    const root = this.root = document.createElement('div');
    root.className = 'upgrade-terminal'; root.hidden = true;
    root.innerHTML = `<section class="upgrade-shell" role="dialog" aria-modal="true" aria-label="Sistema de aprimoramento">
      <header><span class="upgrade-brand">N</span><div><strong>NULLBORNS</strong><small>THE HOLLOW // SISTEMA DE APRIMORAMENTO</small></div><button data-close aria-label="Fechar loja">FECHAR [ESC]</button></header>
      <nav aria-label="Categorias">${Object.entries(categories).map(([id, name]) => `<button data-category="${id}">${name}</button>`).join('')}</nav>
      <div class="upgrade-grid"><aside><h2 data-character></h2><p class="upgrade-balance" data-balance></p><p class="upgrade-muted" data-filter></p><div data-list></div></aside>
      <section class="upgrade-body"><p class="upgrade-muted">INTERFACE SOMÁTICA // AXIOM</p><div class="upgrade-scan"><img data-portrait alt="Personagem selecionado"><div class="upgrade-regions">${['Cabeça','Tronco','Braços','Pernas','Sistema neural'].map((r,i) => `<button data-region="${r}"><span>0${i+1} ◇</span> ${r}</button>`).join('')}</div></div><button data-all>EXIBIR TODOS OS MÓDULOS</button><p class="upgrade-muted">STATUS: COMPATÍVEL<br>TECNOLOGIA RECUPERADA</p></section>
      <section class="upgrade-details"><small>MÓDULO SELECIONADO</small><h2 data-name></h2><p data-description></p><dl data-stats></dl><div class="upgrade-progress" role="img" aria-label="Nível instalado"><span></span></div><button class="upgrade-install" data-install></button><p class="upgrade-message" role="status" aria-live="polite"></p></section></div>
      <footer>SISTEMA DE APRIMORAMENTO NEURAL <span>TECNOLOGIA RECUPERADA DA AXIOM</span></footer></section>`;
    document.getElementById('game-container').append(root);
    this.click = e => {
      const button = e.target.closest('button'); if (!button || button.disabled) return;
      if (button.hasAttribute('data-close')) return this.close();
      if (button.dataset.category) { this.category = button.dataset.category; this.region = null; }
      if (button.dataset.region) { this.region = button.dataset.region; this.category = null; }
      if (button.hasAttribute('data-all')) { this.region = null; this.category = null; }
      if (button.dataset.upgrade) this.selected = button.dataset.upgrade;
      if (button.hasAttribute('data-install')) {
        if (this.busy || this.pending) return;
        const d = this.definitions().find(d => d.id === this.selected), level = this.level(d.id);
        this.busy = this.pending = true; this.message = 'SINCRONIZANDO INSTALAÇÃO...'; this.render();
        const sent = this.scene.scrapSystem.requestPurchase(d.id, level);
        if (!sent && this.pending) this.result({ reason: 'INSTALAÇÃO INDISPONÍVEL. APROXIME-SE DO COMERCIANTE.' });
        return;
      }
      this.message = ''; this.render();
    };
    root.addEventListener('click', this.click);
    // Impede eventos DOM de chegarem ao canvas/atalhos de combate.
    root.addEventListener('pointerdown', e => e.stopPropagation());
    window.addEventListener('keydown', this.onKey, true);
    window.addEventListener('keyup', this.onKey, true);
  }
  definitions() { return upgradeDefinitions(this.scene.personagemSelecionada); }
  level(id) { return accountFor(this.scene).characters[this.scene.personagemSelecionada][id] || 0; }
  portrait() {
    const scene = this.scene, frame = scene.textures.getFrame(textureFor(scene.personagemSelecionada), 18);
    if (!frame) return;
    const canvas = document.createElement('canvas'); canvas.width = frame.cutWidth; canvas.height = frame.cutHeight;
    canvas.getContext('2d').drawImage(frame.source.image, frame.cutX, frame.cutY, frame.cutWidth, frame.cutHeight, 0, 0, canvas.width, canvas.height);
    this.root.querySelector('[data-portrait]').src = canvas.toDataURL();
  }
  preview(d, value) {
    const s = this.scene, base = obterBalanceamento(s.personagemSelecionada, s.multiplayer), levels = { ...accountFor(s).characters[s.personagemSelecionada], [d.id]: value };
    const m = modifiers(s.personagemSelecionada, levels);
    const n = number => Number(number.toFixed(1));
    if (d.stat === 'health') return `${n(maximumHealth(s.personagemSelecionada, m.health))} PV`;
    if (d.stat === 'speed') return `${n((s.speed || 200) * (1 + m.speed))} px/s`;
    if (d.stat === 'armor') return `${percent(m.armor)} absorção`;
    if (d.stat === 'weapon' || d.stat === 'melee') return `${n(base.dano * (1 + (m.weapon || 0) + (s.personagemSelecionada === 'aria-kade' ? 0 : m.melee || 0)))} dano${s.personagemSelecionada === 'aria-kade' ? ' base / flecha' : ''}`;
    if (d.stat === 'healing') return `${n(5 * (1 + m.healing))}% PV / pulso`;
    if (d.stat === 'clone') return `${n(4.5 * (1 + m.clone))} s de holograma`;
    if (d.stat === 'impact') return `${Math.round(90 * (1 + m.impact))} dano central`;
    if (d.stat === 'cooldown' || d.stat === 'recovery') {
      const base = s.personagemSelecionada === 'aria-kade' ? 9600 : s.personagemSelecionada === 'nyx' ? 20000 : 8000;
      const cooldown = n(cooldownWithModifiers(s.personagemSelecionada, base, m) / 1000);
      return `${cooldown} s de recarga${s.personagemSelecionada === 'kai-mercer' && d.id === 'special' ? ` / ${n(30 * (1 + (m.recovery || 0) * 2))} dano refletido` : ''}`;
    }
    return percent(d.values[value]);
  }
  render() {
    const q = selector => this.root.querySelector(selector), defs = this.definitions();
    const visible = defs.filter(d => (!this.category || d.category === this.category) && (!this.region || d.region === this.region));
    if (!visible.some(d => d.id === this.selected)) this.selected = visible[0]?.id;
    const d = defs.find(d => d.id === this.selected), account = accountFor(this.scene);
    q('[data-character]').textContent = CHARACTER_NAMES[this.scene.personagemSelecionada];
    q('[data-balance]').textContent = `SUCATAS DISPONÍVEIS: ${account.scrap}`;
    q('[data-filter]').textContent = this.region || categories[this.category] || 'TODOS OS COMPONENTES';
    q('[data-list]').innerHTML = visible.map(d => {
      const level = this.level(d.id);
      return `<button class="upgrade-row ${d.id === this.selected ? 'selected' : ''}" data-upgrade="${d.id}"><strong>◇ ${d.name}</strong><small>NÍVEL ${level}/3 <span>${level < 3 ? `${d.prices[level]} SUCATAS` : 'MÁXIMO'}</span></small></button>`;
    }).join('');
    for (const b of this.root.querySelectorAll('[data-category]')) b.setAttribute('aria-pressed', String(b.dataset.category === this.category));
    for (const b of this.root.querySelectorAll('[data-region]')) b.setAttribute('aria-pressed', String(b.dataset.region === (this.region || d?.region)));
    if (!d) return;
    const level = this.level(d.id), max = level >= d.max, cost = d.prices[level], insufficient = account.scrap < cost;
    q('[data-name]').textContent = d.name;
    q('[data-description]').textContent = d.description;
    q('[data-stats]').innerHTML = `<dt>CATEGORIA</dt><dd>${categories[d.category]}</dd><dt>NÍVEL INSTALADO</dt><dd>${level} / ${d.max}</dd><dt>ESTATÍSTICA ATUAL</dt><dd>${this.preview(d, level)}</dd><dt>APÓS INSTALAÇÃO</dt><dd>${max ? 'MÁXIMO' : this.preview(d, level + 1)}</dd><dt>BÔNUS ACUMULADO</dt><dd>${percent(d.values[level])}${max ? '' : ` → ${percent(d.values[level + 1])}`}</dd><dt>CUSTO</dt><dd>${max ? '—' : `${cost} SUCATAS`}</dd>`;
    q('.upgrade-progress span').style.width = `${level / d.max * 100}%`;
    const install = q('[data-install]');
    install.disabled = max || insufficient || this.pending || this.busy;
    install.textContent = max ? '[ NÍVEL MÁXIMO ]' : insufficient ? '[ SUCATAS INSUFICIENTES ]' : this.pending ? '[ SINCRONIZANDO... ]' : '[ INSTALAR MELHORIA ]';
    q('.upgrade-message').textContent = this.message || 'SISTEMA NEURAL SINCRONIZADO';
    q('.upgrade-message').classList.toggle('success', this.message === 'MELHORIA INSTALADA COM SUCESSO');
  }
  open() {
    const s = this.scene;
    if (s.upgradeMenuOpen || !canUseShop(s, s.sys.settings.key) || s.movimentoBloqueado || s.atacando || s.estadoDash?.ativo || s.generatorMenuOpen || s.devItemMenuOpen) return false;
    if (!this.root) this.create();
    this.previous = { input: s.input.enabled, keyboard: s.input.keyboard.enabled, lock: s.movimentoBloqueado };
    this.focused = document.activeElement;
    s.upgradeMenuOpen = true; s.movimentoBloqueado = true; s.player.setVelocity(0,0);
    s.joystick?.reset?.(); s.input.keyboard.resetKeys(); s.input.enabled = false; s.input.keyboard.enabled = false;
    this.root.hidden = false; this.message = ''; this.portrait(); this.render();
    this.root.querySelector('[data-close]').focus();
    return true;
  }
  close() {
    const s = this.scene;
    if (!s.upgradeMenuOpen) return;
    s.upgradeMenuOpen = false; this.root.hidden = true;
    clearTimeout(this.timer); this.busy = this.pending = false;
    s.input.enabled = this.previous.input;
    s.input.keyboard.resetKeys(); s.input.keyboard.enabled = this.previous.keyboard;
    if (!s.morteEmAndamento && !s.transicaoEmAndamento && !s.cenaEntradaBossAtiva) s.movimentoBloqueado = this.previous.lock;
    this.focused?.focus?.();
  }
  destroy() {
    this.close(); clearTimeout(this.timer);
    this.scene.events.off('upgradesChanged', this.refresh); this.scene.events.off('upgradeResult', this.result);
    window.removeEventListener('keydown', this.onKey, true); window.removeEventListener('keyup', this.onKey, true);
    this.root?.remove();
  }
}
