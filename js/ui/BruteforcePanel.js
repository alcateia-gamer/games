import { anexarTutorialPuzzle } from './PuzzleTutorial.js';
import { criarPainelNullnet } from './NullnetPanel.js';
import { criarAnimacaoHacking } from './HackingAnimation.js';
import { deslocamentoLetra, BRUTEFORCE_WINDOW } from '../puzzles/BruteforcePuzzle.js';

export function criarPainelBruteforce(enviar) {
  const panel = criarPainelNullnet('AXIOM // BRUTEFORCE', () => enviar({ op: 'cancelar' }), { width: 820 });
  panel.root.classList.add('bruteforce-overlay');
  panel.root.style.setProperty('--brute-window', String(BRUTEFORCE_WINDOW * 2));
  const style = document.createElement('style'); style.textContent = `
.brute-meta{color:#77bfa6;font-size:12px}.brute-heading{margin:4px 0!important}.brute-reels{position:relative;display:grid;grid-template-columns:repeat(8,minmax(0,1fr));height:280px;background:#010906;border:1px solid #376c59;border-radius:6px;overflow:hidden;isolation:isolate}.bruteforce-body{display:grid;grid-template-columns:minmax(0,1fr);align-content:start;gap:4px;min-height:0}.bruteforce-body>p{margin:2px 0;line-height:1.2}.brute-column{position:relative;overflow:hidden!important;padding:0!important;min-width:0!important;height:100%;border:0!important;border-right:1px solid #1c4637!important;border-radius:0!important;background:#020d08!important;color:#528d68!important;touch-action:manipulation}.brute-column.active{background:#0e2822!important;box-shadow:inset 0 0 0 2px #76f6ed}.brute-column.locked{background:#0e2e19!important}.brute-column.error{background:#4a1318!important}.brute-letter{position:absolute;left:0;top:50%;width:100%;height:var(--brute-step,54px);display:grid;place-items:center;font-size:30px;font-weight:bold;will-change:transform;pointer-events:none}.brute-letter.target{color:#b4ff8c;text-shadow:1px 1px 0 #001b0c,0 0 4px #72ff8d44}.brute-column.locked .brute-letter.target{color:#e6ffbc}.brute-index{position:absolute;z-index:3;left:0;right:0;top:0;padding:4px 0;background:#06140fee;font-size:12px;color:#8bc1ae;pointer-events:none}.brute-band{box-sizing:border-box;position:absolute;z-index:2;left:0;right:0;top:50%;height:calc(var(--brute-step,54px) * var(--brute-window));transform:translateY(-50%);border-top:2px solid #76ffff;border-bottom:2px solid #76ffff;background:#7cffff09;pointer-events:none}.brute-password{display:grid;grid-template-columns:repeat(8,minmax(0,1fr));gap:4px;margin:4px 0}.brute-password span{display:grid;place-items:center;min-height:44px;background:#082218;border:1px solid #326649;font-size:22px;color:#a9ffc8}.brute-password span.done{background:#17442d;border-color:#8dffac}.brute-confirm{width:100%;min-height:48px!important;margin:2px 0;border-color:#6aeae3!important;font-weight:bold!important}.brute-legend{display:flex;justify-content:space-between;gap:8px;font-size:12px;color:#92c6ad;margin:2px 0}.brute-hint{color:#a2ff96}
`;
  style.textContent += `
/* Compacte o conteúdo antes do fallback proporcional de ResponsivePanel. */
.bruteforce-overlay .nullnet-panel header h2{flex:1;min-width:0}
.bruteforce-overlay .nullnet-panel header .puzzle-help{order:1}
.bruteforce-overlay .nullnet-panel header>button:not(.puzzle-help){order:2}
@media(max-width:600px){.brute-reels{height:264px}.brute-letter{font-size:30px}.brute-password span{font-size:17px}}
@media(max-height:600px) and (orientation:landscape){
  .bruteforce-overlay .nullnet-panel{padding:10px;line-height:1.25}
  .bruteforce-overlay .nullnet-panel header{gap:6px}
  .bruteforce-overlay .nullnet-panel header h2{font-size:16px}
  .bruteforce-overlay .nullnet-panel header>button{min-height:44px;padding:4px 8px;font-size:12px}
  .bruteforce-body{grid-template-columns:minmax(0,1.7fr) minmax(0,1fr);column-gap:10px;row-gap:4px}
  .brute-meta,.brute-heading,.brute-legend{grid-column:1/-1}
  .brute-meta{font-size:10px;line-height:1.2}
  .brute-heading{font-size:12px!important;margin:0!important}
  .brute-legend{font-size:11px;line-height:1.2}
  .brute-reels{grid-column:1;grid-row:4/span 4;height:clamp(164px,calc(100dvh - 142px - env(safe-area-inset-top) - env(safe-area-inset-bottom)),320px);--brute-step:54px}
  .brute-letter{font-size:32px;line-height:1}
  .brute-password,.brute-progress,.brute-confirm,.bruteforce-body>.nullnet-message{grid-column:2;min-width:0}
  .brute-password{gap:2px;margin:0}.brute-password span{min-height:28px;font-size:17px}
  .bruteforce-body>.brute-progress{font-size:11px;line-height:1.2;margin:0}
  .bruteforce-body>.nullnet-message{font-size:12px;line-height:1.3;padding:6px;margin:0;align-self:start}
  .brute-confirm{align-self:start;font-size:12px!important;min-height:44px!important;margin:0}
}
@media(max-height:380px) and (orientation:landscape){
  .bruteforce-overlay .nullnet-panel{padding:7px}
  .bruteforce-body{column-gap:8px;row-gap:3px}
  .bruteforce-body>.nullnet-message{font-size:11px;line-height:1.2;padding:5px}
}

`;
  panel.root.append(style);
  panel.body.classList.add('bruteforce-body');
  const meta = document.createElement('p'); meta.className = 'brute-meta'; meta.textContent = 'EMPLOYEE ID: EV-041 · ACCOUNT: REVOKED · LOCAL ARCHIVE: ENCRYPTED';
  const heading = document.createElement('h3'); heading.className = 'brute-heading'; heading.textContent = 'PASSWORD DECRYPTION';
  const legend = document.createElement('div'); legend.className = 'brute-legend'; legend.innerHTML = '<span>↓ Letras descendo</span><span class="brute-hint">VERDE = LETRA DA SENHA</span>';
  const reels = document.createElement('div'); reels.className = 'brute-reels';
  const band = document.createElement('div'); band.className = 'brute-band';
  const password = document.createElement('div'); password.className = 'brute-password'; password.setAttribute('aria-label', 'Senha recuperada');
  const slots = Array.from({ length: 8 }, () => { const v = document.createElement('span'); v.textContent = '_'; password.append(v); return v; });
  const progress = document.createElement('p'), message = document.createElement('p'); message.className = 'nullnet-message'; message.setAttribute('aria-live', 'polite');
  progress.className = 'brute-progress';
  panel.body.append(meta, heading, legend, reels, password, progress);
  let last = null, built = false, layoutReady = false; const columns = [], chars = [];
  function confirmar(coluna = last?.ativa) {
    if (!last || last.tutorial || last.estado !== 'ativo') return;
    enviar({ op: 'congelar', valor: { coluna, tempo: animation.tempo() } });
  }
  const confirm = panel.button('CONGELAR LETRA', () => confirmar()); confirm.className = 'brute-confirm'; panel.body.append(message);
  const tutorial = anexarTutorialPuzzle(panel.root, panel.root.querySelector('header'), enviar);
  const animation = criarAnimacaoHacking((s, tempo) => {
    if (!built) return;
    s.colunas.forEach((c, i) => {
      chars[i].forEach((el, j) => { el.style.transform = `translateY(${(deslocamentoLetra(c, j, tempo) - .5) * 100}%)`; });
      columns[i].classList.toggle('error', c.falhaAte > tempo);
    });
  });
  const key = e => {
    if (last?.tutorial || last?.estado !== 'ativo') return;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault(); const index = columns.indexOf(document.activeElement), delta = e.key === 'ArrowRight' ? 1 : -1;
      columns[Math.max(0, Math.min(7, (index < 0 ? last.ativa : index) + delta))]?.focus();
    } else if ((e.code === 'Space' || e.key === 'Enter') && document.activeElement?.tagName !== 'BUTTON') { e.preventDefault(); confirmar(); }
  };
  panel.root.addEventListener('keydown', key);
  return { atualizar(s) {
    last = s; animation.atualizar(s); tutorial.atualizar(s, 'bruteforce');
    if (!built) {
      s.colunas.forEach((c, i) => {
        const column = panel.button('', () => i === last.ativa ? confirmar(i) : enviar({ op: 'selecionarColuna', valor: { coluna: i } }), reels);
        column.className = 'brute-column'; column.dataset.coluna = i;
        const index = document.createElement('span'); index.className = 'brute-index'; index.textContent = `${i + 1} ↓`; column.append(index);
        chars[i] = c.letras.map(char => { const el = document.createElement('span'); el.className = 'brute-letter'; el.classList.toggle('target', char === c.alvo); el.textContent = char; column.append(el); return el; }); columns.push(column);
      }); reels.append(band); built = true;
    }
    columns.forEach((col, i) => {
      const c = s.colunas[i]; col.classList.toggle('active', s.ativa === i); col.classList.toggle('locked', c.fixada);
      col.setAttribute('aria-label', `Coluna ${i + 1}${c.fixada ? ' confirmada' : s.ativa === i ? ' ativa: congelar letra' : ': aguarde sua vez'}`);
      col.disabled = s.estado !== 'ativo' || c.fixada || c.falhaAte > s.tempo;
      slots[i].textContent = s.confirmadas[i] ?? '_'; slots[i].classList.toggle('done', c.fixada);
    });
    progress.textContent = `PASSWORD: ${s.confirmadas.map(v => v ?? '_').join(' ')} · ${s.confirmadas.filter(Boolean).length}/8`;
    confirm.textContent = s.estado === 'sucesso' ? 'PASSWORD ACCEPTED' : `CONGELAR COLUNA ${s.ativa + 1}`;
    confirm.disabled = s.estado !== 'ativo' || s.tutorial || s.colunas[s.ativa]?.falhaAte > s.tempo;
    message.textContent = s.mensagem;
    if (!layoutReady) { panel.responsive.update(); layoutReady = true; }
  }, destruir() { animation.destruir(); tutorial.destruir(); panel.root.removeEventListener('keydown', key); panel.destruir(); } };
}
