import { createOperatorSelection, decodeSelectionArt, operatorCallsign } from "./OperatorSelection.js";

export function createCoopLobby({ onSelect, onLeave, onReady, onStart }) {
  const root = document.createElement("section");
  root.className = "coop-lobby";
  root.setAttribute("aria-labelledby", "coop-lobby-title");
  root.tabIndex = -1;
  root.innerHTML = `
    <header class="coop-lobby-header">
      <h1 id="coop-lobby-title">LOBBY // SALA <strong></strong></h1>
      <ol class="coop-lobby-roster" aria-label="Vagas da sala">
        <li><span><strong>J1</strong> · VAGO</span></li>
        <li><span><strong>J2</strong> · VAGO</span></li>
        <li><span><strong>J3</strong> · VAGO</span></li>
        <li><span><strong>J4</strong> · VAGO</span></li>
      </ol>
    </header>
    <footer class="coop-lobby-footer">
      <p class="coop-lobby-status" role="status">AGUARDANDO OPERADORES...</p>
      <div class="coop-lobby-actions">
        <button type="button" data-action="leave">SAIR</button>
        <button type="button" data-action="ready" disabled>PRONTO</button>
        <button type="button" data-action="start" hidden disabled>INICIAR PARTIDA</button>
      </div>
    </footer>
  `;

  const code = root.querySelector("h1 strong");
  const slots = Array.from(root.querySelectorAll(".coop-lobby-roster li"));
  const status = root.querySelector(".coop-lobby-status");
  const leave = root.querySelector('[data-action="leave"]');
  const ready = root.querySelector('[data-action="ready"]');
  const start = root.querySelector('[data-action="start"]');
  leave.addEventListener("click", onLeave);
  ready.addEventListener("click", onReady);
  start.addEventListener("click", onStart);

  const operators = createOperatorSelection({ onSelect, detailPrefix: "coop", showNames: true });
  operators.root.classList.add("coop-lobby-loading");
  root.querySelector("footer").before(operators.root);

  return {
    root,
    async showArt() {
      await decodeSelectionArt(operators.root);
      operators.root.classList.remove("coop-lobby-loading");
    },
    setStatus(message) {
      if (status.textContent !== message) status.textContent = message;
    },
    renderRoom(room, { playerId, canStart, feedback }) {
      code.textContent = room.roomCode;
      const local = room.players.find(player => player.id === playerId);
      const owners = new Map();
      for (const [index, slot] of slots.entries()) {
        const player = room.players[index];
        const number = `J${index + 1}`;
        const isLocal = player?.id === playerId;
        const callsign = operatorCallsign(player?.character);
        const badges = [number];
        if (player) {
          if (isLocal) badges.push("VOCÊ");
          if (player.id === room.hostId) badges.push("HOST");
          badges.push(callsign || "ESCOLHENDO");
          if (player.ready) badges.push("PRONTO");
          if (callsign) owners.set(player.character, isLocal ? `${number} · VOCÊ` : number);
        } else {
          badges.push("VAGO");
        }
        if (slot.textContent !== badges.join(" · ")) {
          const label = slot.firstElementChild;
          label.replaceChildren(...badges.map((badge, position) => {
            const token = document.createElement(position === 0 || badge === callsign ? "strong" : "span");
            token.textContent = position === 0 ? badge : ` · ${badge}`;
            return token;
          }));
        }
        slot.toggleAttribute("data-occupied", Boolean(player));
        slot.toggleAttribute("data-ready", Boolean(player?.ready));
      }

      operators.setSelected(local?.character, owners);
      const waiting = room.status === "WAITING";
      ready.textContent = local?.ready ? "CANCELAR PRONTO" : "PRONTO";
      ready.disabled = !waiting || !local?.character;
      start.hidden = room.hostId !== playerId;
      start.disabled = !waiting || !canStart;
      this.setStatus(feedback || (room.players.every(player => player.character && player.ready)
        ? "TODOS PRONTOS" : "ESCOLHA UM OPERADOR E FIQUE PRONTO"));
    },
  };
}
