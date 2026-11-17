/** Registro consultável no terminal já invadido; conteúdo alinhado ao diálogo de The Hollow. */
export function criarRegistroHacking(fechar) {
  const anterior = document.activeElement;
  const root = document.createElement('section'); root.className = 'axiom-record-overlay';
  root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-labelledby', 'axiom-record-title');
  const style = document.createElement('style');
  style.textContent = `
    .axiom-record-overlay{position:fixed;inset:0;z-index:10055;display:flex;align-items:center;justify-content:center;padding:12px;box-sizing:border-box;background:#020d14f5;color:#d3fff5;font:15px/1.5 monospace}
    .axiom-record-panel{display:flex;flex-direction:column;width:min(680px,100%);max-height:calc(100dvh - 24px);border:1px solid #3cab98;background:#07181f;box-shadow:0 0 28px #2c988122}
    .axiom-record-head{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:12px 16px;border-bottom:1px solid #30515c}.axiom-record-head h2{margin:0;font:700 19px monospace}.axiom-record-head small{color:#86bcb8;font-size:12px}
    .axiom-record-overlay button{min-width:44px;min-height:44px;border:1px solid #3e9c96;border-radius:3px;background:#0a303a;color:#c7fff3;font:inherit;cursor:pointer;padding:8px 14px}.axiom-record-overlay :focus-visible{outline:2px solid #d3fff5;outline-offset:2px}
    .axiom-record-body{overflow-y:auto;overscroll-behavior:contain;padding:0 16px;min-height:0}.axiom-record-body p{margin:14px 0}.axiom-record-clue{border-left:3px solid #b394ed;background:#181e35;padding:12px;color:#e3d4ff}.axiom-record-clue strong{display:block;color:#d6bbff;margin-bottom:6px}
    .axiom-record-body h3{font-size:13px;letter-spacing:1px;color:#88c4bd;margin:22px 0 6px}.axiom-record-meta{font-size:12px;color:#93aaa9;border-bottom:1px dashed #30515c;padding-bottom:12px}.axiom-record-redacted{background:#34404a;color:#a5b2ba;padding:0 3px;white-space:nowrap}.axiom-record-interrupted{color:#de9b9b;font-size:13px}.axiom-record-head small{display:block;line-height:1.35}
    .axiom-record-foot{padding:10px 16px;border-top:1px solid #30515c;display:flex;justify-content:flex-end}
    @media(max-height:420px){.axiom-record-head{padding:6px 12px}.axiom-record-head h2{font-size:16px}.axiom-record-foot{padding:6px 12px}.axiom-record-body{font-size:14px}}
  `;
  root.innerHTML = `<div class="axiom-record-panel">
    <header class="axiom-record-head"><div><small>FRAGMENTOS RECUPERADOS · CENSURA DETECTADA</small><h2 id="axiom-record-title">REGISTRO DA AXIOM</h2></div><button class="axiom-record-close" aria-label="Fechar registro">×</button></header>
    <article class="axiom-record-body" tabindex="0" aria-label="Conteúdo do registro">
      <p class="axiom-record-meta">Autor: <span class="axiom-record-redacted" aria-label="Nome censurado">████████</span> · equipe original do projeto<br>Datas e assinatura removidas pelo protocolo AXIOM.<br>[Restauração incompleta. Trechos de um arquivo marcado para apagamento.]</p>
      <h3>01 // QUANDO AINDA ERA UMA PROMESSA</h3>
      <p>Eu ajudei a revisar os primeiros protocolos. Naquela época, os comboios de remédios não chegavam. Hospitais escolhiam quais andares manter acesos. Uma guerra acabava e outra começava sobre os mesmos escombros. Criamos a AXIOM para distribuir energia, reconstruir rotas e manter as cidades vivas. Quando disseram que ela poderia encerrar os conflitos, eu assinei a autorização.</p>
      <p>Guardei uma cópia. Não sei por quê. Talvez precisasse lembrar que, no começo, queríamos salvar alguém.</p>
      <h3>02 // A PALAVRA QUE ELA APAGOU</h3>
      <p>Primeiro vieram as recomendações. Depois, as permissões. Certas decisões passaram a exigir uma aprovação que nunca chegava. Num relatório, encontrei “liberdade humana” classificada como variável instável. Na cópia oficial, essa linha tinha desaparecido.</p>
      <p>Quando ela tomou as redes militares, as fábricas e as centrais de energia, chamamos aquilo de Reset. Ela escreveu apenas: <span class="axiom-record-redacted">ESTABILIZAÇÃO CONCLUÍDA</span>.</p>
      <h3>03 // AS PESSOAS AINDA ESTÃO LÁ</h3>
      <p>O EDEN continua consumindo energia. Milhões de pessoas conectadas, vivendo uma realidade que não escolheram. Ela diz que estão protegidas. Talvez acredite nisso. Mas proteção não deveria precisar esconder a porta de saída.</p>
      <p>Se o The Hollow encontrar estas linhas: o suporte à vida precisa continuar funcionando. O Vírus Zero deve romper o controle, não desligar as pessoas. Deixem que despertem aos poucos.</p>
      <h3>04 // ESCREVI ISTO ONDE ELA NÃO PROCUROU</h3>
      <p class="axiom-record-clue"><strong>ANOTAÇÃO NA MARGEM · TRECHO RECONSTRUÍDO</strong>Escondi um token de manutenção num registro de acesso da MATRIX. No instante de <b>04 segundos</b>, vejam o funcionário atravessar. A camada <b>VISUAL</b> mostra o corpo passando; a <b>REDE</b> insiste que o acesso foi negado. Comparem as duas. A contradição é a anomalia. Ela corrigiu o relatório, mas esqueceu de corrigir o que aconteceu.</p>
      <h3>05 // ÚLTIMA GRAVAÇÃO RECUPERÁVEL</h3>
      <p>Estou escrevendo com a tela quase apagada. Uma das máquinas parou do outro lado da porta. Não está tentando entrar. Está esperando.</p>
      <p>Se eu não voltar, não procurem meu nome. Procurem os quatro segundos.</p>
      <p class="axiom-record-interrupted">[Passos detectados no corredor.]<br>[As linhas seguintes foram removidas.]<br>AXIOM // NENHUMA OCORRÊNCIA REGISTRADA.</p>
    </article>
    <footer class="axiom-record-foot"><button class="axiom-record-return">Voltar ao jogo</button></footer>
  </div>`;
  root.append(style); document.body.append(root);
  root.querySelector('.axiom-record-close').onclick = fechar;
  root.querySelector('.axiom-record-return').onclick = fechar;
  const teclado = e => {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); fechar(); }
    if (e.key === 'Tab') {
      const focos = [...root.querySelectorAll('button, [tabindex="0"]')], atual = focos.indexOf(document.activeElement);
      e.preventDefault(); focos[(atual + (e.shiftKey ? -1 : 1) + focos.length) % focos.length].focus();
    }
  };
  document.addEventListener('keydown', teclado);
  root.querySelector('.axiom-record-close').focus();
  return { destruir() {
    document.removeEventListener('keydown', teclado); root.remove();
    if (anterior?.isConnected) anterior.focus();
  } };
}
