import { criarPainelNullnet } from './NullnetPanel.js';
import { documentosMissao, gerarMissao } from '../puzzles/MissionIntelligence.js';
/** Banco consultável também durante a invasão, sem perder a tentativa. */
export function criarRegistroHacking(fechar, config = gerarMissao(1), progress = () => ({}), categoriaInicial = 'REGISTROS') {
  const panel = criarPainelNullnet('NULLNET // INTELLIGENCE DATABASE', fechar, { width: 980, height: 680 });
  panel.root.classList.add('axiom-record-overlay'); panel.root.style.zIndex = '10065';
  const nav = document.createElement('nav'); nav.className = 'nullnet-actions';
  const content = document.createElement('div'); panel.body.append(nav, content);
  const progressoAtual = () => typeof progress === 'function' ? progress() : progress;
  function mostrar(categoria) {
    content.replaceChildren();
    for (const [cat, title, text] of documentosMissao(config, progressoAtual()).filter(d => d[0] === categoria)) {
      const article = document.createElement('article'), h = document.createElement('h3'), p = document.createElement('p');
      h.textContent = title; p.textContent = text; article.append(h, p); content.append(article);
    }
    if (!content.children.length) { const p = document.createElement('p'); p.textContent = 'Nenhum arquivo recuperado nesta categoria.'; content.append(p); }
    for (const b of nav.children) b.setAttribute('aria-pressed', b.textContent === categoria);
  }
  for (const cat of ['REGISTROS', 'TOPOLOGIA', 'PROTOCOLOS', 'AUTENTICAÇÃO']) panel.button(cat, () => mostrar(cat), nav);
  mostrar(categoriaInicial); panel.button('Voltar', fechar); panel.responsive.update(); return panel;
}
