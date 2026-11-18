import { formatarTempoPartida } from "../core/RelogioPartida.js";

const FORMULARIO = "https://docs.google.com/forms/d/e/1FAIpQLSeeleFRJ3PbTeX9nmxFtfqF_3VMD6bBGixNGFODEtqjbHGK9A/viewform?entry.52413313=NULLBORNS";

const MENSAGENS_PAGAMENTO = {
  pendente: "Pendente de confirmação",
  autenticacao: "Entre com o Google para receber a recompensa.",
  processando: "Processando recompensa…",
  falha: "Falha ao receber a recompensa.",
  inelegivel: "Recompensa indisponível para este participante.",
};

export function atualizarPagamentoConclusao(tela, estado) {
  tela.querySelector(".run-completion-payment").textContent = estado.tipo === "confirmado"
    ? `Você recebeu ${estado.quantidade.toLocaleString("pt-BR")} tijolinhos`
    : MENSAGENS_PAGAMENTO[estado.tipo];
  const acesso = tela.querySelector(".run-completion-login");
  if (estado.renderizar && !acesso.firstChild) estado.renderizar(acesso);
  if (!estado.renderizar) acesso.replaceChildren();
}

export function mostrarTelaConclusao(resultado, pagamento) {
  const tela = document.createElement("section");
  tela.className = "hacking-victory";
  tela.setAttribute("aria-labelledby", "run-completion-title");
  tela.innerHTML = `
    <div class="run-completion">
      <h1 id="run-completion-title">Parabéns! Você concluiu NULLBORNS!</h1>
      <p>Hack final concluído com sucesso.</p>
      <p>Tempo de jogo: <strong class="run-completion-time"></strong></p>
      <p>Pagamento em tijolinhos: <strong class="run-completion-payment" role="status"></strong></p>
      <div class="run-completion-login"></div>
      <div class="run-completion-actions">
        <a class="run-completion-review" href="${FORMULARIO}" target="_blank" rel="noopener noreferrer">Avaliar NULLBORNS</a>
        <button type="button">Jogar novamente</button>
      </div>
    </div>`;
  tela.querySelector(".run-completion-time").textContent = formatarTempoPartida(resultado.tempoMs);
  tela.querySelector("button").addEventListener("click", () => window.location.reload());
  document.body.append(tela);
  atualizarPagamentoConclusao(tela, pagamento);
  return tela;
}
