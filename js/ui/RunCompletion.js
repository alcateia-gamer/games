import { formatarTempoPartida } from "../core/RelogioPartida.js";

const FORMULARIO = "https://docs.google.com/forms/d/e/1FAIpQLSeeleFRJ3PbTeX9nmxFtfqF_3VMD6bBGixNGFODEtqjbHGK9A/viewform?entry.52413313=NULLBORNS";

export function mostrarTelaConclusao(resultado) {
  const tela = document.createElement("section");
  tela.className = "hacking-victory";
  tela.setAttribute("aria-labelledby", "run-completion-title");
  tela.innerHTML = `
    <div class="run-completion">
      <h1 id="run-completion-title">Parabéns! Você concluiu NULLBORNS!</h1>
      <p>Hack final concluído com sucesso.</p>
      <p>Tempo de jogo: <strong class="run-completion-time"></strong></p>
      <p>Pagamento em tijolinhos: <strong class="run-completion-payment"></strong></p>
      <div class="run-completion-actions">
        <a class="run-completion-review" href="${FORMULARIO}" target="_blank" rel="noopener noreferrer">Avaliar NULLBORNS</a>
        <button type="button">Jogar novamente</button>
      </div>
    </div>`;
  tela.querySelector(".run-completion-time").textContent = formatarTempoPartida(resultado.tempoMs);
  tela.querySelector(".run-completion-payment").textContent = resultado.tijolinhos?.toLocaleString("pt-BR") ?? "Pendente";
  tela.querySelector("button").addEventListener("click", () => window.location.reload());
  document.body.append(tela);
  return tela;
}
