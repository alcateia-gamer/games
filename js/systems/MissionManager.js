import { HACKING_KEYS as H } from "../puzzles/HackingConfig.js";

export const MISSION_FACTS_KEY = "nullborns:mission-facts";
export const MISSION_POWER_KEY = "factoryGeneratorPowered";
export const MISSION_DOOR_KEYS = ["factoryDoorOpen:porta02", "factoryDoorOpen:porta03"];
const RESOURCE_MAP = { bateria: "Level1", gasolina: "Level1", card: "Level1Parte2" };
const FLAG_KEYS = [MISSION_POWER_KEY, "fabricaVisitada", ...MISSION_DOOR_KEYS,
  H.fabrica, H.bruteforce, H.registro, H.cartao, H.final];

const task = (id, title, prerequisites = [], optional = false) => ({ id, title, prerequisites, optional });
const missions = [
  { id: "recursos", title: "Recupere os recursos", phase: 1, tasks: [
    task("bateria", "Encontre e colete a bateria"),
    task("gasolina", "Encontre e colete o galão"),
    task("galaoCheio", "Encha o galão", ["gasolina"]),
  ] },
  { id: "travessia", title: "Vá ao setor industrial", phase: 1, tasks: [
    task("galaoCheio", "Encha o galão", ["gasolina"]),
    task("fabrica", "Entre na fábrica", ["bateria", "gasolina", "galaoCheio"]),
  ] },
  { id: "energia", title: "Ligue o gerador", phase: 2, tasks: [
    task("gerador", "Localize o gerador"),
    task("encaixeBateria", "Instale a bateria", ["gerador"]),
    task("encaixeGasolina", "Conecte o galão cheio", ["gerador"]),
    task("energia", "Ative a energia da fábrica", ["encaixeBateria", "encaixeGasolina"]),
  ] },
  { id: "seguranca", title: "Infiltre a rede AXIOM", phase: 2, tasks: [
    task("terminalFabrica", "Acesse o terminal de segurança"),
    task("breach", "Conclua o Breach Protocol", ["terminalFabrica"]),
    task("card", "Colete o cartão de acesso"),
  ] },
  { id: "acesso", title: "Desbloqueie o núcleo", phase: 2, tasks: [
    task("terminalIndustrial", "Acesse o computador EV-041"),
    task("bruteforce", "Conclua o BruteForce", ["terminalIndustrial"]),
    task("autenticado", "Autentique o cartão", ["card"]),
    task("porta", "Aguarde a abertura da porta", ["bruteforce", "autenticado"]),
    task("card", "Colete o cartão de acesso"),
  ] },
  { id: "sentinel", title: "Neutralize o SENTINEL", phase: 2, tasks: [
    task("boss", "Derrote o guardião", ["porta"]),
  ] },
  { id: "virus", title: "Execute o Protocolo Zero", phase: 2, tasks: [
    task("terminalCentral", "Acesse o terminal central", ["boss"]),
    task("virus", "Instale o Vírus Zero", ["terminalCentral"]),
  ] },
];
const registro = task("registro", "Recupere o Registro da AXIOM", [], true);
const lerRegistro = task("lerRegistro", "Consulte o registro no NULLNET", ["registro"], true);

/** Deriva a etapa a partir de confirmações das mecânicas e dos checkpoints existentes. */
export function objetivosDaPartida(facts, flags = {}, slots = {}, mapa) {
  const fase2 = mapa === "Level1Parte2";
  const completed = { ...facts, fabrica: fase2 || flags.fabricaVisitada === true, energia: flags[MISSION_POWER_KEY] === true,
    breach: flags[H.fabrica] === true, bruteforce: flags[H.bruteforce] === true,
    registro: flags[H.registro] === true, autenticado: flags[H.cartao] === true,
    porta: MISSION_DOOR_KEYS.some(key => flags[key] === true), virus: flags[H.final] === true };
  completed.boss ||= completed.virus;
  completed.card ||= completed.autenticado;
  completed.gerador ||= completed.energia || !!(slots.bateria || slots.gasolina);
  completed.encaixeBateria = completed.energia || !!slots.bateria;
  completed.encaixeGasolina = completed.energia || !!slots.gasolina;
  completed.terminalFabrica ||= completed.breach;
  completed.terminalIndustrial ||= completed.bruteforce;
  completed.terminalCentral ||= completed.virus;
  const id = completed.virus ? "final" : completed.boss ? "virus" : completed.porta ? "sentinel"
    : completed.breach ? "acesso" : completed.energia ? "seguranca" : fase2 ? "energia"
      : completed.bateria && completed.gasolina ? "travessia" : "recursos";
  const mission = missions.find(entry => entry.id === id);
  const tasks = (mission?.tasks ?? []).map(item => ({
    ...item, phase: mission.phase,
    status: completed[item.id] ? "completed" : item.prerequisites.some(dep => !completed[dep]) ? "locked" : "available",
  }));
  if (id === "acesso") {
    const optional = completed.registro ? lerRegistro : registro;
    tasks.push({ ...optional, phase: 2, status: completed[optional.id] ? "completed" : "available" });
  }
  const primeiro = tasks.find(item => item.id === "galaoCheio" && item.status === "available") ??
    tasks.find(item => item.status === "available" && !item.optional);
  if (primeiro) primeiro.status = "active";
  return { id, title: mission?.title ?? "MISSÃO CONCLUÍDA", sector: fase2 ? "FÁBRICA" : "NIGHT CITY",
    tasks: tasks.filter(item => item.status !== "locked").sort((a, b) => Number(a.optional) - Number(b.optional)).slice(0, 4),
    completed };
}

export function criarMissionManager(scene, onChange) {
  const { game: { registry }, events } = scene;
  const mapa = scene.sys.settings.key;
  let transientSlots = {}, previous = "", facts = registry.get(MISSION_FACTS_KEY) ?? {};
  const registryFlags = new Map(FLAG_KEYS.map(key => [key, registry.get(key) === true]));
  const coop = scene.coopRuntime?.manager;
  const roomProgress = () => coop?.room?.coopProgress;
  const temGalaoCheio = () => scene.inventory?.getQuantity("gasolina", { minFuel: 1 }) > 0 ||
    !!coop?.room?.players?.some(player => player.id !== coop.playerId && player.coop?.fuelReady === true);
  let galaoCheio = temGalaoCheio();
  function atualizarCombustivel() {
    const cheio = temGalaoCheio();
    if (cheio === galaoCheio) return;
    galaoCheio = cheio;
    atualizar();
  }
  function atualizar() {
    const progress = roomProgress();
    const flags = Object.fromEntries(FLAG_KEYS.map(key => [key,
      registryFlags.get(key) || progress?.flags?.[key] === true]));
    const shared = { ...facts, galaoCheio };
    for (const { itemId, uid } of Object.values(progress?.collected ?? {})) {
      if (RESOURCE_MAP[itemId] && uid?.startsWith(RESOURCE_MAP[itemId] + ":")) shared[itemId] = true;
    }
    if (scene.inventory?.getQuantity("card") > 0) shared.card = true;
    const next = objetivosDaPartida(shared, flags, progress?.generator?.slots ?? transientSlots, mapa);
    const signature = JSON.stringify(next);
    if (signature === previous) return;
    previous = signature;
    onChange(next);
  }
  function marcar(id) {
    if (facts[id]) return;
    facts = { ...facts, [id]: true };
    registry.set(MISSION_FACTS_KEY, facts);
  }
  const coletou = ({ itemId, uid }) => {
    if (RESOURCE_MAP[itemId] && uid?.startsWith(RESOURCE_MAP[itemId] + ":")) marcar(itemId);
  };
  const descoberta = tipo => {
    const id = { fabrica: "terminalFabrica", bruteforce: "terminalIndustrial", matrix: "terminalCentral" }[tipo];
    if (id) marcar(id);
  };
  const encaixes = slots => { transientSlots = slots; atualizar(); };
  const registryChanged = (_parent, key) => {
    if (key === MISSION_FACTS_KEY) {
      facts = registry.get(key) ?? {};
    } else {
      if (!registryFlags.has(key)) return;
      const next = registry.get(key) === true;
      if (registryFlags.get(key) === next) return;
      registryFlags.set(key, next);
    }
    atualizar();
  };
  const listeners = [
    ["inventario:coleta-confirmada", coletou], ["gerador:aberto", () => marcar("gerador")],
    ["gerador:encaixes", encaixes], ["hacking:terminal-aberto", descoberta],
    ["hacking:registro-aberto", () => marcar("lerRegistro")],
    ["novo-boss:derrotada", () => marcar("boss")], ["missao:progresso-coop", atualizar],
  ];
  for (const [name, listener] of listeners) events.on(name, listener);
  for (const name of ["setdata", "changedata", "removedata"]) registry.events.on(name, registryChanged);
  const cancelarInventario = mapa === "Level1" ? scene.inventory?.onChange(atualizarCombustivel) : undefined;
  if (mapa === "Level1") coop?.on?.("roomUpdated", atualizarCombustivel);
  events.once("shutdown", () => {
    cancelarInventario?.();
    if (mapa === "Level1") coop?.off?.("roomUpdated", atualizarCombustivel);
    for (const [name, listener] of listeners) events.off(name, listener);
    for (const name of ["setdata", "changedata", "removedata"]) registry.events.off(name, registryChanged);
  });
  if (scene.novoBoss?.morto) marcar("boss");
  atualizar();
}
