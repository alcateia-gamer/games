const instrucoes = {
  identificacao: 'Selecione o servidor central.',
  integridade: 'Isole os dois sistemas de segurança. Preserve LIFE e BIO.',
  autorizacao: 'Organize os fragmentos na ordem dos registros.',
};
/** Um objetivo por tela; seleção por toque, sem arrastar nem manipular conexões. */
export function criarPainelMemoria(parent, command) {
  const root = document.createElement('div'); root.className = 'memory-decryption';
  const style = document.createElement('style'); style.textContent = `
.memory-decryption{min-width:0}
.memory-modules,.memory-options,.memory-fragments,.memory-selection{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}
.memory-modules{margin:6px 0}.memory-module{padding:6px;border:1px solid #28583f;overflow-wrap:anywhere}
.memory-module small,.memory-option small{display:block}.memory-module.current,.memory-module.recovered{border-color:#72dca4}
.memory-options.systems{grid-template-columns:repeat(5,minmax(0,1fr))}
.memory-option{min-width:0!important;text-align:left;overflow-wrap:anywhere}
.memory-option[aria-pressed="true"]{border-color:#8effcf;background:#17553d}
.memory-selection,.memory-controls{margin-top:6px}
.memory-controls{display:flex;gap:6px}.memory-controls button{flex:1;min-width:0}
@media(max-width:600px){.memory-options.systems{grid-template-columns:repeat(2,minmax(0,1fr))}.memory-module{font-size:11px}}
@media(max-height:500px) and (orientation:landscape){
  .memory-count{display:inline}.memory-decryption>.memory-progress{width:45%;height:10px;margin-left:10px}
  .memory-module{padding:3px;font-size:11px}
  .memory-option{font-size:12px!important}
  .memory-options.systems{grid-template-columns:repeat(4,minmax(0,1fr))}
  .memory-authorization{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:5px 8px}
  .memory-authorization .memory-selection,.memory-authorization .memory-controls{margin:0}
  .memory-authorization .memory-tip,.memory-authorization .memory-controls{grid-column:1/-1}
}
`;
  const count = document.createElement('p'); count.className = 'memory-count';
  const progress = document.createElement('progress'); progress.className = 'memory-progress'; progress.max = 3; progress.setAttribute('aria-label', 'Arquivos recuperados');
  const modules = document.createElement('div'); modules.className = 'memory-modules';
  const cards = Array.from({ length: 3 }, () => { const card = document.createElement('div'), name = document.createElement('strong'), status = document.createElement('small'); card.className = 'memory-module'; card.append(name, status); modules.append(card); return { card, name, status }; });
  const objective = document.createElement('h3'); objective.className = 'memory-objective'; objective.tabIndex = -1;
  const nova = document.createElement('p'); nova.className = 'memory-nova';
  const content = document.createElement('div'); root.append(style, count, progress, modules, objective, nova, content); parent.append(root);
  let key = '', moduloAnterior = null;
  function button(label, handler, container = content) { const b = document.createElement('button'); b.textContent = label; b.onclick = handler; container.append(b); return b; }
  function option(n, handler, container) {
    const b = button('', handler, container); b.className = 'memory-option'; b.dataset.server = n.id;
    const title = document.createElement('strong'), desc = document.createElement('small');
    title.textContent = `${n.tipo} // ${n.id}`; desc.textContent = n.descricao; b.append(title, desc); return b;
  }
  return { atualizar(s) {
    content.classList.toggle('memory-authorization', s.modulo === 'autorizacao');
    count.textContent = `ARQUIVOS RECUPERADOS: ${s.recuperados}/3`; progress.value = s.recuperados;
    cards.forEach(({ card, name, status }, i) => {
      name.textContent = `${String(i + 1).padStart(2, '0')} — ${s.modulos[i].nome}`; status.textContent = `STATUS: ${s.modulos[i].status}`;
      card.classList.toggle('current', i === s.recuperados); card.classList.toggle('recovered', i < s.recuperados);
      card.setAttribute('aria-current', i === s.recuperados ? 'step' : 'false');
    });
    objective.textContent = instrucoes[s.modulo] ?? 'MEMORY DECRYPTION COMPLETE'; nova.textContent = s.orientacao;
    const current = JSON.stringify([s.modulo, s.identificacoes, s.isolamento, s.sequencia, s.fragmentos]);
    if (key !== current) {
      const mudouModulo = moduloAnterior !== null && moduloAnterior !== s.modulo; moduloAnterior = s.modulo;
      key = current; const focus = document.activeElement?.dataset; content.replaceChildren();
      if (s.modulo === 'identificacao') {
        const choices = document.createElement('div'); choices.className = 'memory-options'; content.append(choices);
        for (const n of s.identificacoes) option(n, () => command('identificar', n.id), choices);
      } else if (s.modulo === 'integridade') {
        const choices = document.createElement('div'); choices.className = 'memory-options systems'; content.append(choices);
        for (const n of s.sistemas) { const b = option(n, () => command('alternarIsolamento', n.id), choices); b.setAttribute('aria-pressed', s.isolamento.includes(n.id)); }
        const controls = document.createElement('div'); controls.className = 'memory-controls'; content.append(controls);
        const confirm = button('EXECUTAR ISOLAMENTO', () => command('executarIsolamento'), controls); confirm.className = 'memory-confirm';
      } else if (s.modulo === 'autorizacao') {
        const available = document.createElement('div'); available.className = 'memory-fragments'; available.setAttribute('aria-label', 'Fragmentos disponíveis'); content.append(available);
        for (const part of s.fragmentos) { const b = button(part, () => command('adicionarFragmento', part), available); b.dataset.fragment = part; b.disabled = s.sequencia.includes(part); }
        const slots = document.createElement('div'); slots.className = 'memory-selection'; slots.setAttribute('aria-label', 'Sequência de autorização'); content.append(slots);
        for (let i = 0; i < 3; i++) { const b = button(s.sequencia[i] ?? '__', () => command('removerFragmento', i), slots); b.dataset.slot = i; b.disabled = !s.sequencia[i]; b.setAttribute('aria-label', `Posição ${i + 1}${s.sequencia[i] ? `: ${s.sequencia[i]}, remover` : ': vazia'}`); }
        const tip = document.createElement('p'); tip.className = 'memory-tip'; tip.textContent = 'Toque numa posição preenchida para remover o fragmento.'; content.append(tip);
        const controls = document.createElement('div'); controls.className = 'memory-controls'; content.append(controls);
        button('LIMPAR SEQUÊNCIA', () => command('limparFragmentos'), controls);
        const confirm = button('VALIDAR AUTORIZAÇÃO', () => command('validarAutorizacao'), controls); confirm.className = 'memory-confirm'; confirm.disabled = s.sequencia.length !== 3;
      } else {
        const transition = document.createElement('div'); transition.className = 'memory-transit';
        transition.textContent = 'INITIALIZING HOST CONNECTION...'; const bar = document.createElement('progress'); bar.max = 1; transition.append(bar); content.append(transition);
      }
      if (mudouModulo) {
        objective.focus({ preventScroll: true });
        root.closest('.nullnet-overlay')?.scrollTo({ top: 0 });
      }
      else if (focus?.server) [...content.querySelectorAll('[data-server]')].find(b => b.dataset.server === focus.server)?.focus({ preventScroll: true });
      else if (focus?.fragment) (content.querySelector('[data-fragment]:not(:disabled)') ?? content.querySelector('.memory-confirm'))?.focus({ preventScroll: true });
    }
    if (s.estado === 'transicao') { const bar = content.querySelector('progress'); if (bar) bar.value = s.transicao; }
  }, destruir() { root.remove(); } };
}
