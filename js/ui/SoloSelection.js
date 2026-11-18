import {
  createOperatorSelection, decodeSelectionArt, labeledButton, operatorArt,
} from "./OperatorSelection.js";

export function createSoloSelection({ onStart, onBack }) {
  const root = document.createElement("section");
  root.className = "solo-selection";
  root.setAttribute("aria-label", "Selecione seu operador");
  root.tabIndex = -1;

  const prompt = operatorArt("faixa.png", "SELECIONE SEU OPERADOR");
  prompt.className = "solo-selection-prompt";

  const start = labeledButton("solo-selection-start", "INICIAR SOLO");
  start.append(operatorArt("iniciar.png"));
  start.disabled = true;

  const back = labeledButton("solo-selection-back", "VOLTAR");
  back.append(operatorArt("voltar.png"));
  back.addEventListener("click", onBack);

  let selected = null;
  const operators = createOperatorSelection({
    detailPrefix: "solo",
    onSelect: id => {
      selected = selected === id ? null : id;
      operators.setSelected(selected);
      start.disabled = selected === null;
    },
    onDetailsChange: anyOpen => { prompt.hidden = anyOpen; },
  });
  start.addEventListener("click", () => {
    if (!selected || start.disabled) return;
    start.disabled = true;
    back.disabled = true;
    onStart(selected);
  });
  root.append(operators.root, prompt, start, back);
  return { root, decodeArt: () => decodeSelectionArt(root) };
}
