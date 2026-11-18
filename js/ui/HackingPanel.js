import { anexarTutorialPuzzle } from './PuzzleTutorial.js';
import { createResponsivePanel } from './ResponsivePanel.js';
/** Interface por toque/teclado, em pixels CSS legíveis, sem depender do zoom do mapa. */
export function criarPainelHacking(enviar, som) {
  const root = document.createElement('section'); root.className = 'hacking-overlay';
  root.setAttribute('role', 'dialog'); root.setAttribute('aria-label', 'Terminal de segurança AXIOM');
  const style = document.createElement('style');
  style.textContent = `
    .hacking-overlay{position:fixed;inset:0;z-index:10050;background:#020d14f5;color:#d3fff5;font:14px monospace;display:flex;align-items:center;justify-content:center;padding:max(4px,env(safe-area-inset-top)) max(4px,env(safe-area-inset-right)) max(4px,env(safe-area-inset-bottom)) max(4px,env(safe-area-inset-left));box-sizing:border-box;overflow:hidden;touch-action:manipulation;overscroll-behavior:contain}
    .hacking-panel{width:840px;margin:auto;border:1px solid #3cab98;background:#07181f;padding:16px;box-sizing:border-box}
    .hacking-panel h2{font-size:20px;margin:0 0 6px}.hacking-panel p{margin:6px 0;line-height:1.4}
    .hacking-head{display:flex;justify-content:space-between;align-items:center;gap:8px}.hacking-columns{display:grid;grid-template-columns:minmax(240px,1fr) minmax(200px,1fr);gap:18px;margin-top:12px}
    .hacking-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:5px}.hacking-overlay button{font:inherit;min-height:44px;border:1px solid #3e9c96;color:#c7fff3;background:#0a303a;cursor:pointer;border-radius:3px;padding:7px}
    .hacking-overlay button:focus-visible{outline:3px solid #fff}.hacking-grid button{font-size:18px;font-weight:bold;min-width:40px}
    .hacking-grid button:disabled{opacity:.35;cursor:default}.hacking-grid button.selected{background:#49bda2;color:#001712;opacity:1}.hacking-overlay .ready{background:#124d3f;border-color:#82ffd1}
    .hacking-target{border:1px solid #30515c;padding:9px;margin:8px 0}.hacking-target.done{border-color:#69fbb7;background:#124135}.hacking-target strong{display:block;font-size:14px;margin-bottom:7px}.hacking-target code{font-size:20px;letter-spacing:3px;white-space:nowrap}
    .hacking-buffer{letter-spacing:3px;min-height:30px;color:#6cf7dd;word-break:break-word;font-size:18px}.hacking-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}.hacking-message{min-height:40px;color:#b8cdd8}.hacking-error{color:#ffb1a9}.hacking-close{min-width:44px}
    @media(max-width:600px),(max-height:500px){
      .hacking-panel{padding:8px;font-size:13px}.hacking-panel h2{font-size:17px}
      .hacking-panel p{margin:3px 0;line-height:1.25}
      .hacking-columns{grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:10px;margin-top:5px}
      .hacking-grid{gap:3px}.hacking-grid button{min-width:0;padding:2px;font-size:16px}
      .hacking-target{padding:4px;margin:4px 0}.hacking-target strong{font-size:12px;margin-bottom:2px}
      .hacking-target code{font-size:15px;letter-spacing:1px;white-space:normal}
      .hacking-buffer{min-height:18px;font-size:15px}.hacking-message{min-height:0}
      .hacking-actions{margin-top:4px;gap:5px}.hacking-actions button{padding:4px}
    }
    @media(max-width:520px) and (orientation:portrait){
      .hacking-columns{grid-template-columns:minmax(0,1fr)}
      .hacking-targets{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:4px}
      .hacking-target{margin:0}.hacking-target strong{overflow-wrap:anywhere}
    }
    @media(max-height:420px) and (orientation:landscape){
      .hacking-grid button{min-height:34px}
    }
  `;
  root.innerHTML = `<div class="hacking-panel"><div class="hacking-head"><h2>N.O.V.A. / INVASÃO AXIOM</h2><button class="hacking-close" aria-label="Cancelar hacking">×</button></div>
    <p>Comece na primeira linha. Alterne coluna e linha. Cada célula só pode ser usada uma vez.</p>
    <div class="hacking-columns"><div><p class="hacking-rule"></p><div class="hacking-grid"></div><p>BUFFER <span class="hacking-count"></span></p><div class="hacking-buffer"></div></div>
    <div><p class="hacking-objectives"></p><div class="hacking-targets"></div><p class="hacking-clock"></p><p class="hacking-message" aria-live="polite"></p>
    <div class="hacking-actions"><button class="hacking-confirm" disabled>Confirmar acesso</button><button class="hacking-retry" hidden>Nova tentativa</button></div></div></div></div>`;
  root.append(style); document.body.append(root);
  const responsive = createResponsivePanel(root, root.querySelector('.hacking-panel'), 840, null, { reflow: true });
  const q = s => root.querySelector(s), grid = q('.hacking-grid'), cells = [];
  for (let i = 0; i < 25; i++) {
    const b = document.createElement('button'); b.dataset.cell = i; b.setAttribute('aria-label', `Código linha ${Math.floor(i / 5) + 1}, coluna ${i % 5 + 1}`);
    b.onclick = () => { enviar({ op: 'selecionar', valor: i }); som?.tocar('passagem', 80); }; grid.append(b); cells.push(b);
  }
  q('.hacking-close').onclick = () => enviar({ op: 'cancelar' });
  q('.hacking-retry').onclick = () => enviar({ op: 'reiniciar' });
  q('.hacking-confirm').onclick = () => enviar({ op: 'confirmar' });
  const escape = e => { if (e.key === 'Escape') { e.preventDefault(); enviar({ op: 'cancelar' }); } };
  document.addEventListener('keydown', escape);
  const tutorial = anexarTutorialPuzzle(root, q('.hacking-head'), enviar);
  let targetsKey = '';
  return {
    atualizar(s) {
      if (!s) return;
      tutorial.atualizar(s, 'fabrica');
      q('.hacking-rule').textContent = `${s.eixo.toUpperCase()} ${s.faixa + 1}`;
      for (const [i, cell] of cells.entries()) {
        cell.textContent = s.grade[i]; cell.classList.toggle('selected', s.selecoes.includes(i));
        cell.disabled = s.estado !== 'ativo' || s.selecoes.includes(i) || (s.eixo === 'linha' ? Math.floor(i / 5) !== s.faixa : i % 5 !== s.faixa);
      }
      const recuperados = s.recuperados ?? [];
      const portasAbertas = recuperados.includes('portas');
      const podeConfirmar = s.podeConfirmar ?? (s.estado === 'ativo' && s.concluidos.includes('portas'));
      q('.hacking-objectives').textContent = portasAbertas
        ? 'Portas liberadas. Selecione a sequência de um objetivo pendente.'
        : 'Portas obrigatórias. Demais objetivos opcionais.';
      const key = JSON.stringify([s.alvos, s.concluidos, recuperados]);
      if (key !== targetsKey) {
        targetsKey = key; q('.hacking-targets').replaceChildren();
        for (const target of s.alvos) {
          const node = document.createElement('div'); node.className = 'hacking-target';
          const salvo = recuperados.includes(target.id);
          const concluido = salvo || s.concluidos.includes(target.id);
          node.classList.toggle('done', concluido);
          const label = document.createElement('strong'), code = document.createElement('code');
          label.textContent = `${concluido ? '✓ ' : ''}${target.nome}`;
          code.textContent = salvo ? 'Já concluído' : target.codigo.join(' ');
          node.append(label, code); q('.hacking-targets').append(node);
        }
      }
      q('.hacking-count').textContent = `${s.selecoes.length}/${s.buffer}`;
      q('.hacking-buffer').textContent = s.selecoes.map(i => s.grade[i]).join(' ') || '— — — —';
      q('.hacking-clock').textContent = s.selecoes.length ? `Rastreamento: ${Math.ceil(s.restante / 1000)} s` : '90 s após a primeira seleção.';
      q('.hacking-clock').dataset.buffer = `${s.selecoes.length}/${s.buffer} · ${s.selecoes.map(i => s.grade[i]).join(' ') || 'BUFFER VAZIO'}`;
      q('.hacking-retry').hidden = s.estado !== 'falha';
      q('.hacking-confirm').disabled = !podeConfirmar;
      q('.hacking-confirm').classList.toggle('ready', podeConfirmar);
      q('.hacking-message').classList.toggle('hacking-error', s.estado === 'falha');
      q('.hacking-message').textContent = s.estado === 'falha' ? 'Canal encerrado. Tente outra sequência.'
        : s.estado === 'sucesso' ? 'ACESSO LIBERADO. Sistemas selecionados comprometidos.'
          : podeConfirmar ? 'Objetivo concluído. Confirme agora ou continue a tentativa.' : 'Encontre a sequência de acesso no buffer. Planeje antes de selecionar.';
    },
    destruir() { tutorial.destruir(); responsive.destroy(); document.removeEventListener('keydown', escape); root.remove(); },
  };
}
