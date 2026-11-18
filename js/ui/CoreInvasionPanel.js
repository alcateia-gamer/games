import { criarHackConnectPanel } from './HackConnectPanel.js';
import { criarPainelMemoria } from './MemoryDecryptionPanel.js';
import { anexarTutorialPuzzle } from './PuzzleTutorial.js';
import { criarPainelNullnet } from './NullnetPanel.js';
import { criarRegistroHacking } from './HackingRecordPanel.js';
export function criarPainelInvasao(enviar, config, progresso) {
  const panel = criarPainelNullnet('AXIOM // MEMORY DECRYPTION', () => enviar({ op: 'cancelar' }));
  panel.root.classList.add('core-invasion-overlay');
  const style = document.createElement('style');
  style.textContent = `
    @media(max-height:500px) and (orientation:landscape){
      .core-invasion-overlay .nullnet-panel>div{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:5px 8px}
      .core-invasion-content,.core-invasion-info{grid-column:1/-1}
      .core-invasion-overlay .nullnet-message{grid-column:1;min-width:0;margin:4px 0}
      .core-invasion-overlay .nullnet-actions{grid-column:2;align-self:start;margin:4px 0}
      .core-invasion-overlay .nullnet-actions button{font-size:12px}
    }
  `;
  panel.root.append(style);
  const title = panel.root.querySelector('h2');
  const tutorial = anexarTutorialPuzzle(panel.root, panel.root.querySelector('header'), enviar);
  const info = document.createElement('p'), content = document.createElement('div');
  info.className = 'core-invasion-info'; content.className = 'core-invasion-content';
  const message = document.createElement('p'); message.className = 'nullnet-message'; message.setAttribute('aria-live', 'polite');
  const actions = document.createElement('div'); actions.className = 'nullnet-actions'; panel.body.append(info, content, message, actions);
  let db = null, mode = '', last = null, memory = null, hackConnect = null, panelLayoutReady = false;
  const records = panel.button('CONSULTAR REGISTROS', () => {
    const cat = last?.modulo === 'autorizacao' || last?.etapaTipo === 'host' ? 'AUTENTICAÇÃO' : 'PROTOCOLOS';
    db ??= criarRegistroHacking(() => { db?.destruir(); db = null; }, config, progresso, cat);
  }, actions);
  const command = (op, valor) => { if (!db) enviar({ op, valor }); };
  const p = text => { const el = document.createElement('p'); el.textContent = text; return el; };
  return { atualizar(s) {
    last = s; tutorial.atualizar(s, s.etapaTipo === 'memory' ? `memory-${s.modulo}` : 'host');
    const next = s.etapaTipo === 'memory' ? 'memory' : ['executando', 'sucesso'].includes(s.estado) ? 'upload' : 'host';
    const layoutChanged = mode !== next;
    if (mode !== next) {
      memory?.destruir(); memory = null; hackConnect?.destruir(); hackConnect = null; content.replaceChildren(); mode = next;
      if (mode === 'memory') memory = criarPainelMemoria(content, command);
      if (mode === 'host') hackConnect = criarHackConnectPanel(content, command, () => !!db);
      if (mode === 'upload') { const bar = document.createElement('progress'); bar.max = 1; content.append(bar, p('')); panel.root.classList.add('nullnet-transmitting'); }
    }
    title.textContent = mode === 'memory' ? 'AXIOM // MEMORY DECRYPTION' : mode === 'host' ? 'AXIOM // HOST CONNECTION' : 'AXIOM // VÍRUS ZERO';
    panel.root.setAttribute('aria-label', title.textContent);
    info.hidden = mode === 'memory'; info.textContent = `RASTREAMENTO ${Math.floor(s.rastro ?? 0)}%`;
    if (message.textContent !== s.mensagem) message.textContent = s.mensagem;
    records.hidden = mode === 'upload';
    memory?.atualizar(s); hackConnect?.atualizar(s);
    if (mode === 'upload') {
      content.querySelector('progress').value = s.transmissao;
      const status = s.transmissao < .35 ? 'AXIOM // CONTROLE ATIVO' : s.transmissao < .75 ? 'AXIOM // CONTROLE EM QUARENTENA' : 'AXIOM // CONTROLE DO EDEN REVOGADO';
      content.querySelector('p').textContent = `VIRUS_ZERO: UPLOADING...\n${status}\nEDEN RELEASE PROTOCOL: ${s.transmissao < .75 ? 'PREPARING' : 'ACTIVE'}\nSUPORTE À VIDA: ONLINE`;
      info.textContent = `TRANSMISSÃO ${Math.floor(s.transmissao * 100)}% · despertar gradual preparado`;
    }
    if (layoutChanged || !panelLayoutReady) { panel.responsive.update(); panelLayoutReady = true; }
  }, destruir() { tutorial.destruir(); db?.destruir(); memory?.destruir(); hackConnect?.destruir(); panel.destruir(); } };
}
