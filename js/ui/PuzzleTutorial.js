import { criarPainelNullnet } from './NullnetPanel.js';

// Diagramas vetoriais locais: exemplos didáticos, sem revelar a solução da partida.
const box = (x, y, w, h, text, color = 'cyan') => `<g class="guide-${color}"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="9"/><text x="${x + w / 2}" y="${y + h / 2 + 6}" text-anchor="middle">${text}</text></g>`;
const line = (x1, y1, x2, y2, color = 'cyan') => `<path class="guide-line guide-${color}" d="M${x1} ${y1} L${x2} ${y2}"/>`;
const label = (x, y, text, cls = '') => `<text class="${cls}" x="${x}" y="${y}" text-anchor="middle">${text}</text>`;
const finger = (x, y) => `<g transform="translate(${x} ${y})"><g class="guide-finger"><circle r="17"/><path d="M0 12 V-9 Q0-16 6-16 Q12-16 12-9 V0 L20 3 Q24 5 22 13 L17 25 H2 L-8 13 Q-11 8-6 6 Z"/></g></g>`;
const svg = (body, name) => `<svg viewBox="0 0 600 260" role="img" aria-label="${name}">${body}</svg>`;
function breachGrid() {
  const path = [1, 16, 18, 8], codes = ['1C', '55', 'E9', 'BD']; let result = '';
  for (let row = 0; row < 5; row++) for (let col = 0; col < 5; col++) {
    const i = row * 5 + col, step = path.indexOf(i), x = 44 + col * 53, y = 15 + row * 44;
    result += `<g class="${row === 0 ? 'guide-row' : col === 1 ? 'guide-column' : 'guide-muted'}">${box(x, y, 47, 38, step >= 0 ? codes[step] : '7A', step >= 0 ? 'green' : 'muted')}</g>`;
    if (step >= 0) result += `<circle class="guide-step" cx="${x + 5}" cy="${y + 3}" r="10"/><text class="guide-number" x="${x + 5}" y="${y + 7}" text-anchor="middle">${step + 1}</text>`;
  }
  return svg('<rect x="40" y="12" width="270" height="44" fill="#4dfedb" opacity=".2"/><rect x="94" y="12" width="53" height="224" fill="#6cb8ff" opacity=".16"/>' + result + label(442, 55, '1  LINHA', 'guide-bright') + label(442, 100, '2  COLUNA') + label(442, 145, '3  LINHA') + label(442, 190, '4  COLUNA') + finger(114, 40), 'Matriz: primeira escolha na linha superior; depois coluna, linha e coluna. Células numeradas de um a quatro.');
}
function reelsGuide(capture) {
  const word = 'OVERRIDE'; let art = '<defs><clipPath id="guide-reels-clip"><rect x="24" y="20" width="552" height="162"/></clipPath></defs>';
  art += '<g clip-path="url(#guide-reels-clip)">';
  for (let i = 0; i < 8; i++) {
    const x = 28 + i * 69;
    art += `<rect x="${x}" y="20" width="62" height="162" rx="7"/>`;
    const chars = capture && i === 0 ? box(x + 2, 78, 58, 46, 'O', 'green') : `<g class="guide-reel-drop" style="animation-delay:-${i * .25}s">${label(x + 31, 35, 'A')}${box(x + 2, 60, 58, 46, word[i], 'green')}${label(x + 31, 140, 'X')}${label(x + 31, 190, 'B')}</g>`;
    art += chars;
  }
  art += '</g><rect class="guide-window" x="23" y="78" width="554" height="46" rx="4"/>';
  return svg(art + (capture ? box(145, 198, 310, 46, 'CONGELAR COLUNA 2', 'green') + finger(450, 217) : label(300, 227, '↓ ↓ ↓ ↓ ↓ ↓ ↓ ↓')), 'Oito colunas de letras descem por uma faixa central ciano; letras verdes são as letras da senha.');
}
function matrixGuide() {
  const rows = ['78 34 92 11 46 81 20 65', '25 67 90 44 22 77 98 31', '82 73 14 63 29 55 70 12', '91 20 35 76 18 42 65 88'];
  const art = label(300, 27, 'TARGET HOST: 44.22.77.98', 'guide-bright') + rows.map((r, i) => label(285, 65 + i * 32, r)).join('')
    + '<path class="guide-line guide-cyan" d="M60 178 H525 V145 H535 M520 140 L525 145 L520 150 M60 82 V50 H75 M70 45 L75 50 L70 55"/>'
    + label(300, 207, '→ UMA CASA A CADA 1 s · ↑ PRÓXIMA LINHA') + label(300, 243, 'FIM DO TOPO ↻ VOLTA PELA LINHA DE BAIXO');
  return svg(art + '<rect class="guide-window" x="245" y="77" width="195" height="30"/>' + finger(445, 104), 'Números avançam para a direita a cada segundo, sobem ao final da linha e retornam pela base depois da linha superior. Selecione quatro números juntos.');
}

const guides = {
  fabrica: { nome: 'BREACH PROTOCOL', pages: [
    ['Siga a faixa iluminada', 'Toque em um código da primeira linha. Depois, siga a coluna dele. Alterne coluna e linha, sem repetir células.', breachGrid()],
    ['Monte o código de PORTAS', 'Cada toque entra no buffer. Procure o código de um objetivo pendente, com todos os valores juntos e na ordem mostrada.', svg(label(300, 35, 'EXEMPLO · SEQUÊNCIA DE PORTAS') + ['1C', '55', 'E9', 'BD'].map((c, i) => box(96 + i * 104, 57, 92, 56, c, 'green')).join('') + label(300, 153, 'SEUS TOQUES → BUFFER') + ['1C', '55', 'E9', 'BD'].map((c, i) => box(96 + i * 104, 173, 92, 56, c)).join('') + line(300, 115, 300, 137), 'A sequência alvo 1C, 55, E9, BD é formada pelos quatro toques no buffer.')],
    ['PORTAS verde? Pode confirmar', 'Na primeira tentativa, conclua PORTAS para confirmar. Se as portas já estiverem abertas, conclua um objetivo pendente. O relógio começa no primeiro código.', svg(box(70, 30, 460, 52, '✓ PORTAS · SEQUÊNCIA COMPLETA', 'green') + box(70, 97, 215, 45, 'ROBÔS · BÔNUS', 'muted') + box(300, 97, 230, 45, 'REGISTRO · BÔNUS', 'muted') + box(150, 176, 300, 58, 'CONFIRMAR ACESSO', 'green') + finger(430, 198), 'Objetivo PORTAS concluído em verde e botão Confirmar acesso destacado.')],
  ] },
  bruteforce: { nome: 'AXIOM // BRUTEFORCE', pages: [
    ['Oito colunas. Uma palavra.', 'As letras descem sem parar. Em cada coluna, a letra verde pertence à senha. Comece pela coluna 1 e siga para a direita.', reelsGuide(false)],
    ['Congele a letra verde no centro', 'Espere a letra verde entrar na faixa ciano. Toque na coluna ativa ou em Congelar coluna. A letra correta fica parada.', reelsGuide(true)],
    ['Complete as oito letras', 'Congele as oito colunas para autenticar EV-041. Errou uma letra? A coluna pisca em vermelho e volta a girar; as anteriores continuam salvas.', svg([... 'OVERRIDE'].map((c, i) => box(28 + i * 69, 50, 62, 60, c, 'green')).join('') + label(300, 148, '✓ ✓ ✓ ✓ ✓ ✓ ✓ ✓', 'guide-bright') + box(100, 182, 400, 54, 'PASSWORD ACCEPTED', 'green'), 'As oito letras congeladas formam OVERRIDE e restauram a autorização digital.')],
  ] },
  'memory-identificacao': { nome: 'MEMORY // IDENTIFICAÇÃO', contextual: true, pages: [
    ['Selecione o servidor central', 'Consulte os registros para reconhecer as funções. Toque no servidor de processamento central.', svg(box(25, 55, 165, 80, 'SEC', 'muted') + box(217, 55, 165, 80, 'CORE', 'green') + box(410, 55, 165, 80, 'LIFE', 'muted') + label(300, 180, 'PROCESSAMENTO CENTRAL') + finger(340, 116), 'Três servidores; CORE representa processamento central.')],
  ] },
  'memory-integridade': { nome: 'MEMORY // INTEGRIDADE', contextual: true, pages: [
    ['Isole a segurança. Preserve as vidas.', 'Toque nos dois módulos SEC e em Executar isolamento. LIFE e BIO devem permanecer ativos.', svg(box(30, 30, 250, 60, 'SEC · ISOLAR') + box(320, 30, 250, 60, 'SEC · ISOLAR') + box(30, 120, 250, 60, 'LIFE · ONLINE', 'green') + box(320, 120, 250, 60, 'BIO · ONLINE', 'green') + label(300, 235, 'SOMENTE SEGURANÇA DEVE SER SELECIONADA'), 'Selecione os dois SEC; preserve LIFE e BIO online.')],
  ] },
  'memory-autorizacao': { nome: 'MEMORY // AUTORIZAÇÃO', contextual: true, pages: [
    ['Organize os três fragmentos', 'Veja a ordem em Consultar registros → Autenticação. Toque nos fragmentos nessa ordem. Toque numa posição preenchida para removê-la.', svg(label(300, 30, 'EXEMPLO DO REGISTRO: A7 → C2 → F9') + ['A7', 'C2', 'F9'].map((v, i) => box(65 + i * 165, 75, 140, 65, `${i + 1} · ${v}`, 'green')).join('') + box(125, 190, 350, 50, 'VALIDAR AUTORIZAÇÃO') + finger(470, 207), 'A ordem registrada orienta o preenchimento de três posições por toque, sem arrastar.')],
  ] },
  host: { nome: 'HOST CONNECTION // HACKCONNECT', contextual: true, pages: [
    ['Encontre a sequência em movimento', 'A cada 1 s, os números avançam uma casa, sobem no fim da linha e voltam pela base. Procure os quatro números do alvo juntos. Toque no primeiro e confirme em Selecionar sequência enquanto os quatro estiverem visíveis.', matrixGuide(true)],
  ] },
};

export function criarTutorialPuzzle(tipo, concluir) {
  const guide = guides[tipo];
  if (!guide) throw new Error(`Tutorial desconhecido: ${tipo}`);
  const panel = criarPainelNullnet('N.O.V.A. // GUIA POR TOQUE', concluir, { width: 780 });
  panel.root.classList.add('puzzle-tutorial-overlay'); panel.root.dataset.tutorial = tipo;
  panel.root.style.zIndex = '10068';
  const style = document.createElement('style');
  style.textContent = `
.puzzle-tutorial-overlay{background:#020e12f8;font-size:15px}.puzzle-tutorial-overlay .nullnet-panel{width:min(780px,100%);padding:18px;border-color:#6cf5c0;box-shadow:0 0 45px #42ffac15}.puzzle-tutorial-overlay h2{font-size:14px;letter-spacing:1px;color:#91d7b9}.puzzle-tutorial-overlay header>button{font-size:13px;width:auto}.guide-topline{color:#7dc5ad;margin:12px 0 0;font-size:12px;letter-spacing:1px}.guide-title{font-size:25px!important;color:#e5fff0!important;margin:6px 0}.guide-art{background:linear-gradient(145deg,#0b3025,#061b18);border:1px solid #285b4c;border-radius:12px;overflow:hidden}.guide-art svg{display:block;width:100%;height:auto;max-height:290px;font:17px monospace}.guide-art rect{fill:#0d2a27;stroke:#66d6d1;stroke-width:1.5}.guide-art text{fill:#b9eae0}.guide-art .guide-green rect{fill:#124633;stroke:#86ffc2}.guide-art .guide-green text,.guide-art .guide-bright{fill:#a5ffd1}.guide-art .guide-orange rect{stroke:#eab769;fill:#3d3020}.guide-art .guide-orange text{fill:#ffd395}.guide-art .guide-muted rect{stroke:#36534a;fill:#0c211a}.guide-art .guide-muted text{fill:#6a9584}.guide-art .guide-line{fill:none;stroke:#75e3da;stroke-width:4}.guide-art .guide-line.guide-green{stroke:#83ffaf}.guide-art .guide-line.guide-muted{stroke:#446050;stroke-dasharray:7 7}.guide-art .guide-step{fill:#d5fff0;stroke:#071c16;stroke-width:2}.guide-art .guide-number{font-size:12px;fill:#001d14;font-weight:bold}.guide-art .guide-finger{animation:guide-tap 1.8s ease-in-out infinite}.guide-finger circle{fill:none;stroke:#9ffff5;stroke-width:2;opacity:.4}.guide-finger path{fill:#d8fff4;stroke:#0b3025;stroke-width:2}.guide-window{fill:#78fff80a!important;stroke:#8bffff!important;stroke-width:3!important}.guide-moving{animation:guide-slide 5s ease-in-out infinite}.guide-row{filter:brightness(1.25)}.guide-text{font-size:16px;line-height:1.55;margin:14px 0!important;color:#e0ffef}.guide-bottom{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}.guide-pages{display:flex;gap:8px}.guide-pages span{width:8px;height:8px;border-radius:50%;background:#315a47}.guide-pages .current{width:24px;border-radius:5px;background:#82ffbd}.guide-nav{display:flex;gap:8px}.guide-next{background:#1b6246!important;border-color:#91ffbf!important;font-weight:bold!important;min-width:140px!important}.guide-note{font-size:12px!important;color:#86bda3!important;margin:6px 0 12px!important}
@keyframes guide-reel-drop{from{transform:translateY(-44px)}to{transform:translateY(56px)}}
@keyframes guide-matrix-flow{from{transform:translateX(20px)}to{transform:translateX(-90px)}}
.guide-reel-drop{animation:guide-reel-drop 2.4s linear infinite}.guide-matrix-flow{animation:guide-matrix-flow 6s linear infinite}
@keyframes guide-tap{0%,100%{opacity:.6}45%,70%{opacity:1;transform:translateY(3px)}}
@keyframes guide-slide{0%,12%{transform:translateX(180px);opacity:.25}40%,70%{transform:translateX(0);opacity:1}95%,100%{transform:translateX(-190px);opacity:.25}}
@media(prefers-reduced-motion:reduce){.guide-finger,.guide-moving,.guide-reel-drop,.guide-matrix-flow{animation:none!important}}
`;
  panel.root.append(style);
  const close = panel.root.querySelector('header>button'); close.textContent = guide.contextual ? 'Fechar' : 'Pular'; close.setAttribute('aria-label', guide.contextual ? 'Fechar ajuda' : 'Pular tutorial');
  const category = document.createElement('p'); category.className = 'guide-topline'; category.textContent = guide.nome;
  const heading = document.createElement('h3'); heading.className = 'guide-title';
  const layout = document.createElement('div'); layout.className = 'guide-layout';
  const art = document.createElement('div'); art.className = 'guide-art';
  const copy = document.createElement('div'), text = document.createElement('p'), note = document.createElement('p');
  text.className = 'guide-text'; note.className = 'guide-note'; note.textContent = guide.contextual ? 'Ajuda da etapa atual · seus acertos permanecem salvos.' : 'Exemplo de treino · o puzzle fica pausado enquanto você aprende.';
  copy.append(text, note); layout.append(art, copy);
  const bottom = document.createElement('div'); bottom.className = 'guide-bottom';
  const dots = document.createElement('div'); dots.className = 'guide-pages';
  const nav = document.createElement('div'); nav.className = 'guide-nav';
  bottom.append(dots, nav); panel.body.append(category, heading, layout, bottom);
  let page = 0;
  const prev = panel.button('Voltar', () => { page--; render(); }, nav);
  const next = panel.button('Próximo', () => { if (page === guide.pages.length - 1) concluir(); else { page++; render(); } }, nav); next.className = 'guide-next';
  function render() {
    const [title, caption, illustration] = guide.pages[page];
    heading.textContent = title; text.textContent = caption; art.innerHTML = illustration;
    prev.disabled = page === 0; next.textContent = page === guide.pages.length - 1 ? guide.contextual ? 'Voltar ao puzzle' : 'Começar puzzle' : 'Próximo';
    dots.replaceChildren(...guide.pages.map((_, i) => { const dot = document.createElement('span'); dot.className = i === page ? 'current' : ''; return dot; }));
    dots.setAttribute('aria-label', `Etapa ${page + 1} de ${guide.pages.length}`);
    panel.root.scrollTop = 0;
  }
  render(); panel.responsive.update(); next.focus(); return panel;
}

/** O host pausa o modelo; a UI apenas acompanha a flag replicada da sessão. */
export function anexarTutorialPuzzle(root, head, enviar) {
  let tutorial = null, tipoAtual = null;
  const help = document.createElement('button'); help.textContent = 'Como jogar'; help.className = 'puzzle-help';
  help.onclick = () => enviar({ op: 'tutorial', valor: true }); head.append(help);
  function limpar() { root.inert = false; tutorial?.destruir(); tutorial = null; }
  return {
    atualizar(state, tipo) {
      if (state.tutorial && (!tutorial || tipoAtual !== tipo)) {
        limpar(); tipoAtual = tipo; root.inert = true;
        tutorial = criarTutorialPuzzle(tipo, () => enviar({ op: 'tutorial', valor: false }));
      } else if (!state.tutorial && tutorial) limpar();
      help.hidden = state.estado !== 'ativo';
    },
    destruir() { limpar(); help.remove(); },
  };
}
