const artDirectory = "assets/solo-selection/";

const operators = [
  {
    id: "kai-mercer", name: "Kai Mercer — 404", portrait: "kai.jpeg",
    description: "Lutador ágil que usa a katana para atacar de perto e se reposicionar rápido. Seu especial cria um domo protetor por 4 segundos, que repele robôs, reflete seus disparos e absorve projéteis de chefes. Um disparo refletido causa 30 de dano ao acertar um robô. A recarga é de 12 segundos.",
    stats: ["Vida: 100", "Estamina: 140 no solo · 120 no cooperativo", "Dano básico: 25 por golpe"],
  },
  {
    id: "magnus-force", name: "Magnus Force", portrait: "magnus.webp",
    description: "O mais resistente da equipe, Magnus luta de perto com a marreta Atlas. No especial, bate a marreta no chão e gera uma onda de choque que empurra e atordoa robôs. A onda causa 90 de dano perto do impacto e cai até 20 na borda. A recarga é de 8 segundos.",
    stats: ["Vida: 115", "Estamina: 120 no solo · 100 no cooperativo", "Dano básico: 33,3 por golpe"],
  },
  {
    id: "aria-kade", name: "Aria Kade — Valkyrie", portrait: "aria.jpeg",
    description: "Arqueira que luta à distância e usa distrações para mudar de posição. Seu especial projeta um clone holográfico que atrai ataques por até 4,5 segundos. Enquanto o clone estiver ativo, Aria pode reativar a habilidade para se teletransportar até ele. A recarga é de 9,6 segundos.",
    stats: ["Vida: 85", "Estamina: 160 no solo · 140 no cooperativo", "Dano básico: 25 com uma flecha rápida ou até 62,5 com a carga completa de 1,2 segundo"],
  },
  {
    id: "nyx", name: "Nyx-07 — Reaper", portrait: "nyx.jpeg",
    description: "Combatente de curta distância que usa a foice Eclipse e ajuda a equipe a se recuperar. Seu especial libera uma aura de cura. Nyx e os aliados dentro da área ao fim da animação recuperam 5% da própria vida máxima por segundo durante 10 segundos, mesmo depois de saírem da área. A recarga é de 20 segundos.",
    stats: ["Vida: 95", "Estamina: 160 no solo · 120 no cooperativo", "Dano básico: 28 por golpe"],
  },
];

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function art(file, alt = "") {
  const image = element("img");
  image.src = artDirectory + file;
  image.alt = alt;
  image.draggable = false;
  return image;
}

function button(className, label) {
  const node = element("button", className);
  node.type = "button";
  node.setAttribute("aria-label", label);
  return node;
}

export function createSoloSelection({ onStart, onBack }) {
  const root = element("section", "solo-selection");
  root.setAttribute("aria-label", "Selecione seu operador");
  root.tabIndex = -1;

  const prompt = art("faixa.png", "SELECIONE SEU OPERADOR");
  prompt.className = "solo-selection-prompt";

  const start = button("solo-selection-start", "INICIAR SOLO");
  start.append(art("iniciar.png"));
  start.disabled = true;

  const back = button("solo-selection-back", "VOLTAR");
  back.append(art("voltar.png"));
  back.addEventListener("click", onBack);

  let selected = null;
  const columns = operators.map(({ id, name, portrait, description, stats }) => {
    const column = element("div", "solo-selection-column");
    column.dataset.operator = id;
    const choose = button("solo-selection-portrait", name);
    choose.setAttribute("aria-pressed", "false");
    const crop = element("span", "solo-selection-crop");
    crop.append(art(portrait));
    choose.append(crop);

    const details = element("section", "solo-selection-details");
    details.id = `solo-details-${id}`;
    details.hidden = true;
    details.tabIndex = 0;
    const title = element("h2", null, name);
    title.id = `${details.id}-title`;
    details.setAttribute("aria-labelledby", title.id);
    const list = element("ul");
    for (const stat of stats) list.append(element("li", null, stat));
    details.append(title, element("p", null, description), list);

    const info = button("solo-selection-info", `Ficha de ${name}`);
    info.append(art("interrogacao.png"));
    info.setAttribute("aria-expanded", "false");
    info.setAttribute("aria-controls", details.id);
    info.addEventListener("click", () => {
      details.hidden = !details.hidden;
      info.setAttribute("aria-expanded", String(!details.hidden));
      prompt.hidden = columns.some(view => !view.details.hidden);
    });

    choose.addEventListener("click", () => {
      selected = selected === id ? null : id;
      for (const view of columns) {
        view.choose.setAttribute("aria-pressed", String(view.id === selected));
        view.choose.classList.toggle("solo-selection-muted", selected !== null && view.id !== selected);
      }
      start.disabled = selected === null;
    });

    column.append(choose, info, details);
    root.append(column);
    return { id, choose, details };
  });

  start.addEventListener("click", () => {
    if (!selected || start.disabled) return;
    start.disabled = true;
    back.disabled = true;
    onStart(selected);
  });
  root.append(prompt, start, back);
  const images = Array.from(root.querySelectorAll("img"));
  return {
    root,
    decodeArt: () => Promise.all(images.map(image => image.decode())),
  };
}
