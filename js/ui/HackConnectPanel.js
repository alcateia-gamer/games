import { criarAnimacaoHacking } from './HackingAnimation.js';
import { posicaoNumero, origemNumero, indicesSequencia, sequenciaLinha } from '../puzzles/HostConnection.js';
import { modulo } from '../puzzles/HackingMotion.js';

/** Células estáveis avançam pela matriz em passos, inclusive entre linhas. */
export function criarHackConnectPanel(parent, command, bloqueado = () => false) {
  const style = document.createElement('style'); style.textContent = `
.hackconnect{background:#020b06;border:1px solid #225d3c;padding:12px;border-radius:5px;min-width:0}.hack-target-title{font-size:12px;color:#8ac79f;letter-spacing:2px}.hack-target{font-size:32px;font-weight:bold;letter-spacing:2px;color:#b5ffac;margin:4px 0 12px;overflow-wrap:anywhere}.hack-matrix{position:relative;height:224px;border:1px solid #2f7550;overflow:hidden;background:#000805}.hack-row{box-sizing:border-box;height:56px;overflow:hidden;border-bottom:1px solid #183c28;position:relative}.hack-row:last-child{border-bottom:0}.hack-cell{position:absolute;left:0;top:0;height:56px;box-sizing:border-box;width:12.5%;min-width:0!important;padding:0!important;border:0!important;border-radius:0!important;background:transparent!important;color:#76dd85!important;min-height:56px!important;line-height:56px;font-size:24px!important;touch-action:manipulation;white-space:nowrap}.hack-cell.marked{background:#14665a!important;color:#c3ffff!important;box-shadow:inset 0 2px #84ffff,inset 0 -2px #84ffff}.hack-cell.first{box-shadow:inset 2px 0 #84ffff,inset 0 2px #84ffff,inset 0 -2px #84ffff}.hack-selection{font-size:17px;color:#a8ffff;margin:10px 0;min-height:26px;overflow-wrap:anywhere}.hack-confirm{width:100%;min-height:50px!important;border-color:#76e1d4!important}.hack-instruction{color:#a2cbb2;font-size:13px;margin:8px 0}
`;
  style.textContent += `
.hackconnect{--hack-row-height:56px}
.hack-matrix{height:calc(4 * var(--hack-row-height))}
.hack-row,.hack-cell{height:var(--hack-row-height)}
.hack-cell{min-height:var(--hack-row-height)!important;line-height:var(--hack-row-height)}
@media(max-width:600px){.hackconnect{padding:6px;--hack-row-height:46px}.hack-cell{font-size:20px!important}.hack-target{font-size:24px}}
@media(max-height:500px) and (orientation:landscape){
  .hackconnect{--hack-row-height:38px;display:grid;grid-template-columns:minmax(0,1.3fr) minmax(0,1fr);gap:2px 10px;align-items:start}
  .hack-matrix{grid-column:1;grid-row:1/span 5}
  .hack-target-title,.hack-target,.hack-instruction,.hack-selection,.hack-confirm{grid-column:2}
  .hack-target,.hack-selection,.hack-instruction{margin:2px 0}
  .hack-target{font-size:20px}.hack-selection,.hack-instruction{font-size:12px;min-height:0}
  .hack-confirm{min-height:44px!important}
}
`;
  const root = document.createElement('div'); root.className = 'hackconnect'; root.tabIndex = 0; root.setAttribute('aria-label', 'Matriz móvel: setas para marcar quatro números, Enter para confirmar');
  const title = document.createElement('div'); title.className = 'hack-target-title';
  const target = document.createElement('div'); target.className = 'hack-target'; target.setAttribute('aria-label', 'Sequência alvo');
  const instruction = document.createElement('p'); instruction.className = 'hack-instruction'; instruction.textContent = 'A cada segundo, os números avançam e mudam de linha. Encontre os quatro na mesma linha, toque no primeiro e confirme antes que o grupo mude de linha.';
  const matrix = document.createElement('div'); matrix.className = 'hack-matrix';
  const selection = document.createElement('p'); selection.className = 'hack-selection';
  const confirm = document.createElement('button'); confirm.className = 'hack-confirm'; confirm.textContent = 'SELECIONAR SEQUÊNCIA';
  root.append(style, title, target, instruction, matrix, selection, confirm); parent.append(root);
  let last = null, passo = null, selected = null, cells = [];
  const animation = criarAnimacaoHacking((s, tempo) => {
    cells.forEach((row, linha) => row.forEach((cell, inicio) => {
      const pos = posicaoNumero(linha, inicio, tempo);
      const transform = `translate(${pos.coluna * 100}%,${pos.linha * 100}%)`;
      if (cell.style.transform !== transform) {
        cell.style.transform = transform;
        cell.setAttribute('aria-label', `Linha ${pos.linha + 1}, coluna ${pos.coluna + 1}: ${cell.textContent}`);
      }
    }));
    if (selected) {
      const pos = posicaoNumero(selected.linha, selected.inicio, tempo);
      selection.textContent = `LINHA ${pos.linha + 1}: ${sequenciaLinha(s.linhas, selected.linha, selected.inicio).join(' . ')}`;
    }
  });
  function marcar(linha, inicio) {
    if (!last || last.tutorial || bloqueado() || last.estado !== 'ativo') return;
    selected = { linha, inicio };
    const pos = posicaoNumero(linha, inicio, animation.tempo());
    selection.textContent = `LINHA ${pos.linha + 1}: ${sequenciaLinha(last.linhas, linha, inicio).join(' . ')}`;
    const group = indicesSequencia(linha, inicio);
    cells.forEach((row, r) => row.forEach((cell, j) => {
      cell.classList.toggle('marked', group.some(n => n.linha === r && n.inicio === j));
      cell.classList.toggle('first', r === linha && j === inicio);
    })); confirm.disabled = false;
  }
  function confirmar() {
    if (!selected || !last || last.tutorial || bloqueado()) return;
    command('selecionarSequencia', { ...selected, tempo: animation.tempo() });
  }
  confirm.onclick = confirmar;
  const key = e => {
    if (!last || last.tutorial || bloqueado()) return;
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
      e.preventDefault();
      const current = selected ? posicaoNumero(selected.linha, selected.inicio, animation.tempo()) : { linha: 0, coluna: 0 };
      const r = Math.max(0, Math.min(3, current.linha + (e.key === 'ArrowDown' ? 1 : e.key === 'ArrowUp' ? -1 : 0)));
      const col = modulo(current.coluna + (e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0), 8);
      const origin = origemNumero(r, col, animation.tempo()); marcar(origin.linha, origin.inicio);
    } else if ((e.key === 'Enter' || e.code === 'Space') && document.activeElement?.tagName !== 'BUTTON') { e.preventDefault(); confirmar(); }
  };
  root.addEventListener('keydown', key);
  return { atualizar(s) {
    last = s; animation.atualizar(s);
    title.textContent = 'TARGET HOST';
    target.textContent = s.alvo.join('.');
    if (passo !== s.passo) {
      passo = s.passo; selected = null; cells = []; matrix.replaceChildren(); selection.textContent = 'SEARCHING FOR HOST...'; confirm.disabled = true;
      s.linhas.forEach((line, r) => {
        const row = document.createElement('div'); row.className = 'hack-row'; row.dataset.linha = r; row.style.pointerEvents = 'none'; matrix.append(row);
        cells[r] = line.numeros.map((number, index) => {
          const cell = document.createElement('button'); cell.className = 'hack-cell'; cell.tabIndex = -1;
          cell.dataset.linha = r; cell.dataset.inicio = index; cell.textContent = number;
          cell.onclick = () => marcar(r, index); matrix.append(cell); return cell;
        });
      });
    }
    confirm.disabled = !selected || s.tutorial || s.estado !== 'ativo';
  }, destruir() { animation.destruir(); root.removeEventListener('keydown', key); root.remove(); } };
}
