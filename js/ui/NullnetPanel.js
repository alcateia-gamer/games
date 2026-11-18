import { createResponsivePanel } from './ResponsivePanel.js';

/** Moldura compartilhada: toque, foco, teclado e dimensionamento responsivo. */
export function criarPainelNullnet(titulo, fechar, { width = 980, height = null } = {}) {
  const anterior = document.activeElement, root = document.createElement('section');
  root.className = 'nullnet-overlay'; root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true'); root.setAttribute('aria-label', titulo);
  const style = document.createElement('style');
  style.textContent = `
.nullnet-overlay{position:fixed;inset:0;z-index:10060;background:#020d12f5;color:#caffdf;font:14px/1.5 monospace;display:flex;align-items:center;justify-content:center;overflow:hidden;padding:max(4px,env(safe-area-inset-top)) max(4px,env(safe-area-inset-right)) max(4px,env(safe-area-inset-bottom)) max(4px,env(safe-area-inset-left));box-sizing:border-box;touch-action:manipulation;overscroll-behavior:contain}
.nullnet-panel{width:980px;margin:auto;border:1px solid #388e70;background:#071912;padding:16px;box-sizing:border-box;min-width:0;min-height:0;display:flex;flex-direction:column}
.nullnet-panel header{position:sticky;top:0;z-index:2;background:#071912;display:flex;justify-content:space-between;align-items:center;gap:8px;flex-shrink:0}.nullnet-panel>div{flex:1 1 auto;min-height:0}.nullnet-panel h2{font-size:19px;margin:0}.nullnet-panel h3{font-size:16px;color:#67e8df}.nullnet-panel p{white-space:pre-line;overflow-wrap:anywhere}
.nullnet-panel button,.nullnet-panel select{font:inherit;min-height:46px;min-width:46px;padding:8px 12px;background:#10372c;color:#d6ffec;border:1px solid #479a78;cursor:pointer;border-radius:3px}.nullnet-panel header>button{flex-shrink:0}.nullnet-panel button:disabled{opacity:.45;cursor:default}.nullnet-panel :focus-visible{outline:3px solid #83ffff;outline-offset:2px}.nullnet-actions{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0}.nullnet-message{padding:10px;border-left:3px solid #ddbe64;background:#19271a;min-height:42px}.nullnet-panel pre{font:inherit;white-space:pre-wrap;overflow-wrap:anywhere}.nullnet-panel article{border-top:1px solid #28583f;padding:8px 0}.nullnet-panel progress{width:100%;height:22px;accent-color:#65ff9e}
.nullnet-docs{display:flex;gap:8px;flex-wrap:wrap}
.nullnet-transmitting .nullnet-panel{border-color:#85ffb8;box-shadow:0 0 32px #32ff7c33}.nullnet-transmitting progress{accent-color:#8bffff}
.bruteforce-overlay .brute-meta{overflow-wrap:anywhere}
@media(max-width:600px),(max-height:500px){
  .nullnet-panel{padding:9px;line-height:1.3}
  .nullnet-panel h2{font-size:16px}
  .nullnet-panel h3{font-size:14px;margin:6px 0}
  .nullnet-panel p{margin:6px 0}
  .nullnet-panel button,.nullnet-panel select{padding:5px 8px}
  .nullnet-actions{margin:6px 0;gap:5px}
  .nullnet-message{padding:6px;min-height:0}
}

`;
  const panel = document.createElement('div'); panel.className = 'nullnet-panel';
  const responsive = createResponsivePanel(root, panel, width, height, { reflow: true });
  const head = document.createElement('header'), title = document.createElement('h2'), close = document.createElement('button');
  title.textContent = titulo; close.textContent = '×'; close.setAttribute('aria-label', 'Fechar terminal'); close.onclick = fechar;
  head.append(title, close); const body = document.createElement('div'); panel.append(head, body); root.append(style, panel); document.body.append(root);
  responsive.update();
  const key = e => {
    if (root !== document.querySelector('.nullnet-overlay:last-of-type')) return;
    if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); fechar(); }
    if (e.key === 'Tab') {
      const els = [...root.querySelectorAll('button:not(:disabled),select,[tabindex="0"]')].filter(b => !b.hidden);
      const i = els.indexOf(document.activeElement); e.preventDefault(); els[(i + (e.shiftKey ? -1 : 1) + els.length) % els.length]?.focus({ preventScroll: true });
    }
  };
  document.addEventListener('keydown', key, true); close.focus({ preventScroll: true });
  return { root, body, responsive, button(label, click, parent = body) { const b = document.createElement('button'); b.textContent = label; b.onclick = click; parent.append(b); return b; },
    destruir() { responsive.destroy(); document.removeEventListener('keydown', key, true); root.remove(); if (anterior?.isConnected) anterior.focus(); } };
}
