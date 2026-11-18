import { criarPainelNullnet } from './NullnetPanel.js';
import { documentosMissao, gerarMissao } from '../puzzles/MissionIntelligence.js';

function dividirTexto(texto, limite) {
  const paginas = [];
  let trecho = '';
  for (const parte of texto.match(/\S+\s*/g) ?? []) {
    if (trecho && trecho.length + parte.length > limite) {
      paginas.push(trecho.trimEnd());
      trecho = '';
    }
    trecho += parte;
  }
  if (trecho) paginas.push(trecho.trimEnd());
  return paginas;
}

/** Banco consultável também durante a invasão, sem perder a tentativa. */
export function criarRegistroHacking(fechar, config = gerarMissao(1), progress = () => ({}), categoriaInicial = 'REGISTROS') {
  const panel = criarPainelNullnet('NULLNET // INTELLIGENCE DATABASE', fechar, { width: 980 });
  panel.root.classList.add('axiom-record-overlay'); panel.root.style.zIndex = '10065';
  const nav = document.createElement('nav'); nav.className = 'nullnet-actions';
  const content = document.createElement('div'); content.className = 'axiom-record-content';
  const controls = document.createElement('div'); controls.className = 'nullnet-actions';
  const indicator = document.createElement('span'); indicator.setAttribute('aria-live', 'polite');
  const style = document.createElement('style');
  style.textContent = `
    .axiom-record-content article{min-width:0;overflow-wrap:anywhere}
    .axiom-record-content article h3,.axiom-record-content article p{margin:4px 0}
    .axiom-record-overlay .nullnet-actions{align-items:center}
    @media(max-width:600px),(max-height:650px){
      .axiom-record-content article{padding:4px 0;font-size:13px}
    }
    @media(max-height:500px) and (orientation:landscape){
      .axiom-record-overlay .nullnet-actions button{min-height:38px}
      .axiom-record-content article{font-size:12px}
      .axiom-record-overlay header button{min-height:48px}
    }
  `;
  panel.root.append(style); panel.body.append(nav, content, controls);
  const progressoAtual = () => typeof progress === 'function' ? progress() : progress;
  const compacto = window.matchMedia('(max-width:600px),(max-height:650px)');
  const paisagemBaixa = window.matchMedia('(max-height:500px) and (orientation:landscape)');
  let categoria = categoriaInicial, pagina = 0;
  const anterior = panel.button('Anterior', () => { pagina--; mostrar(); }, controls);
  controls.append(indicator);
  const proxima = panel.button('Próxima', () => { pagina++; mostrar(); }, controls);
  panel.button('Voltar', fechar, controls);

  function mostrar() {
    content.replaceChildren();
    const docs = documentosMissao(config, progressoAtual()).filter(d => d[0] === categoria);
    const paginas = compacto.matches
      ? docs.flatMap(([cat, title, text]) => dividirTexto(text, paisagemBaixa.matches ? 330 : 460)
        .map(trecho => [[cat, title, trecho]]))
      : [docs];
    pagina = Math.min(Math.max(pagina, 0), Math.max(0, paginas.length - 1));
    for (const [, title, text] of paginas[pagina] ?? []) {
      const article = document.createElement('article'), h = document.createElement('h3'), p = document.createElement('p');
      h.textContent = title; p.textContent = text; article.append(h, p); content.append(article);
    }
    if (!content.children.length) { const p = document.createElement('p'); p.textContent = 'Nenhum arquivo recuperado nesta categoria.'; content.append(p); }
    for (const b of nav.children) b.setAttribute('aria-pressed', b.textContent === categoria);
    anterior.hidden = proxima.hidden = indicator.hidden = paginas.length <= 1;
    anterior.disabled = pagina === 0;
    proxima.disabled = pagina >= paginas.length - 1;
    indicator.textContent = `${pagina + 1} / ${paginas.length}`;
    panel.responsive.update();
  }
  for (const cat of ['REGISTROS', 'TOPOLOGIA', 'PROTOCOLOS', 'AUTENTICAÇÃO']) {
    panel.button(cat, () => { categoria = cat; pagina = 0; mostrar(); }, nav);
  }
  const reflow = () => { pagina = 0; mostrar(); };
  compacto.addEventListener('change', reflow);
  paisagemBaixa.addEventListener('change', reflow);
  const destruir = panel.destruir;
  panel.destruir = () => {
    compacto.removeEventListener('change', reflow);
    paisagemBaixa.removeEventListener('change', reflow);
    destruir();
  };
  mostrar();
  return panel;
}
