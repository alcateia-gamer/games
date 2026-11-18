const artDirectory = "assets/solo-selection/";

const operators = [
  {
    id: "kai-mercer", callsign: "KAI", name: "Kai Mercer — 404", portrait: "kai.jpeg",
    description: "Lutador ágil que usa a katana para atacar de perto e se reposicionar rápido. Seu especial cria um domo protetor por 4 segundos, que repele robôs, reflete seus disparos e absorve projéteis de chefes. Um disparo refletido causa 30 de dano ao acertar um robô. A recarga é de 12 segundos.",
    stats: ["Vida: 100", "Estamina: 140 no solo · 120 no cooperativo", "Dano básico: 25 por golpe"],
  },
  {
    id: "magnus-force", callsign: "MAGNUS", name: "Magnus Force", portrait: "magnus.webp",
    description: "O mais resistente da equipe, Magnus luta de perto com a marreta Atlas. No especial, bate a marreta no chão e gera uma onda de choque que empurra e atordoa robôs. A onda causa 90 de dano perto do impacto e cai até 20 na borda. A recarga é de 8 segundos.",
    stats: ["Vida: 115", "Estamina: 120 no solo · 100 no cooperativo", "Dano básico: 33,3 por golpe"],
  },
  {
    id: "aria-kade", callsign: "ARIA", name: "Aria Kade — Valkyrie", portrait: "aria.jpeg",
    description: "Arqueira que luta à distância e usa distrações para mudar de posição. Seu especial projeta um clone holográfico que atrai ataques por até 4,5 segundos. Enquanto o clone estiver ativo, Aria pode reativar a habilidade para se teletransportar até ele. A recarga é de 9,6 segundos.",
    stats: ["Vida: 85", "Estamina: 160 no solo · 140 no cooperativo", "Dano básico: 25 com uma flecha rápida ou até 62,5 com a carga completa de 1,2 segundo"],
  },
  {
    id: "nyx", callsign: "NYX", name: "Nyx-07 — Reaper", portrait: "nyx.jpeg",
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

export function operatorArt(file, alt = "") {
  const image = element("img");
  image.src = artDirectory + file;
  image.alt = alt;
  image.draggable = false;
  return image;
}

export function labeledButton(className, label) {
  const node = element("button", className);
  node.type = "button";
  node.setAttribute("aria-label", label);
  return node;
}

export function operatorCallsign(id) {
  return operators.find(operator => operator.id === id)?.callsign;
}

export function decodeSelectionArt(root) {
  return Promise.all(Array.from(root.querySelectorAll("img"), image => image.decode()));
}

export function createOperatorSelection({ onSelect, onDetailsChange, detailPrefix, showNames = false }) {
  const root = element("section", "operator-selection");
  root.setAttribute("aria-label", "Operadores");

  const columns = operators.map(({ id, name, portrait, description, stats }) => {
    const column = element("div", "operator-selection-column");
    column.dataset.operator = id;
    const choose = labeledButton("operator-selection-portrait", name);
    choose.setAttribute("aria-pressed", "false");
    const crop = element("span", "operator-selection-crop");
    crop.append(operatorArt(portrait));
    choose.append(crop);
    let ownerBadge;
    if (showNames) {
      const caption = element("span", "operator-selection-caption");
      ownerBadge = element("span", "operator-selection-owner");
      ownerBadge.id = `${detailPrefix}-owner-${id}`;
      ownerBadge.hidden = true;
      choose.setAttribute("aria-describedby", ownerBadge.id);
      caption.append(ownerBadge, element("span", "operator-selection-name", name));
      choose.append(caption);
    }

    const details = element("section", "operator-selection-details");
    details.id = `${detailPrefix}-details-${id}`;
    details.hidden = true;
    details.tabIndex = 0;
    const title = element("h2", null, name);
    title.id = `${details.id}-title`;
    details.setAttribute("aria-labelledby", title.id);
    const list = element("ul");
    for (const stat of stats) list.append(element("li", null, stat));
    details.append(title, element("p", null, description), list);

    const info = labeledButton("operator-selection-info", `Ficha de ${name}`);
    info.append(operatorArt("interrogacao.png"));
    info.setAttribute("aria-expanded", "false");
    info.setAttribute("aria-controls", details.id);
    info.addEventListener("click", () => {
      details.hidden = !details.hidden;
      info.setAttribute("aria-expanded", String(!details.hidden));
      onDetailsChange?.(columns.some(view => !view.details.hidden));
    });

    choose.addEventListener("click", () => onSelect(id));

    column.append(choose, info, details);
    root.append(column);
    return { id, choose, details, ownerBadge };
  });

  return {
    root,
    setSelected(selected, owners) {
      for (const { id, choose, ownerBadge } of columns) {
        const owner = owners?.get(id) || "";
        const isLocal = id === selected;
        choose.setAttribute("aria-pressed", String(isLocal));
        choose.classList.toggle("operator-selection-muted", !isLocal && Boolean(selected || owner));
        if (ownerBadge && ownerBadge.textContent !== owner) {
          ownerBadge.textContent = owner;
          ownerBadge.hidden = !owner;
        }
      }
    },
  };
}
