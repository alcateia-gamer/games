import { jogadorNaArenaNovoBoss } from "./NovoBossConfig.js";

// O PNG contém 12 × 8 monitores de 144px; cada mensagem usa três quadros adjacentes.
const MENSAGENS = {
  aguardando: [7, 9], calculando: [1, 9], intruso: [1, 3],
  iniciandoTorres: [7, 3], protocolo: [2, 3], preparando: [3, 3], atacando: [0, 6],
  acerto: [1, 6], falha: [2, 6], avaria: [0, 9], capacidadeEsgotada: [3, 6],
  fim: [4, 6], desligando: [7, 6], apagado: [0, 0], gameOver: [3, 0],
};
const ETAPAS_ENTRADA = {
  aguardando: "aguardando", indo: "calculando", mostrando: "intruso",
  "indo-torre": "iniciandoTorres", "invocando-torre": "iniciandoTorres",
  "mostrando-choque-torre": "iniciandoTorres", enquadrando: "protocolo",
  "carregando-escudo": "protocolo", "dissipando-raios": "preparando",
  voltando: "preparando", fechando: "preparando",
};
// Conserva o quadro legível na maior parte do tempo, com pequenas oscilações do PNG original.
const ANIMACAO = [1, 1, 1, 0, 1, 1, 1, 2];
const FRAME_MS = 120;

export function localizarTelasSupercomputador(map, arena) {
  const tileset = map?.tilesets?.find(t => t.name === "Supercomputer");
  if (!tileset || map.tileWidth !== 48 || map.tileHeight !== 48) return [];
  const columns = tileset.columns || 36, telas = [];
  for (const dados of map.layers ?? []) {
    const layer = dados.tilemapLayer;
    if (!layer?.forEachTile || !layer.tileToWorldXY || layer.visible === false) continue;
    const grupos = new Map();
    layer.forEachTile(tile => {
      if (!tile) return;
      const local = tile.index - tileset.firstgid;
      if (local < 0 || local >= (tileset.total ?? tileset.tilecount ?? 864)) return;
      const coluna = local % columns, linha = Math.floor(local / columns);
      const dx = coluna % 3, dy = linha % 3;
      const x = tile.x - dx, y = tile.y - dy;
      const chave = `${x}:${y}:${Math.floor(coluna / 3)}:${Math.floor(linha / 3)}`;
      if (!grupos.has(chave)) grupos.set(chave, { x, y, celulas: [] });
      grupos.get(chave).celulas.push({ tile, dx, dy, original: tile.index });
    });
    for (const grupo of grupos.values()) {
      if (grupo.celulas.length !== 9) continue;
      const ponto = layer.tileToWorldXY(grupo.x, grupo.y);
      const x = ponto.x + 72 * (layer.scaleX ?? 1), y = ponto.y + 72 * (layer.scaleY ?? 1);
      if (!jogadorNaArenaNovoBoss({ active: true, x, y }, arena)) continue;
      telas.push({ x, y, celulas: grupo.celulas, firstgid: tileset.firstgid, columns });
    }
  }
  return telas;
}

/** Anima os tiles existentes: nenhuma textura, sprite ou luz adicional durante a batalha. */
export function prepararSupercomputadorNovoBoss(scene, encontro) {
  const telas = localizarTelasSupercomputador(scene.map, encontro.config.arena);
  if (!telas.length) return null;
  let destruido = false, tempo = 0, inicioMensagem = 0, derrotaEm = null;
  let mensagem = null, frameAnterior = -1, aviso = null, ultimaVida = scene.vida;
  const eventos = [];
  function ouvir(nome, callback) {
    const listener = evento => { if (!destruido && evento?.encontro === encontro) callback(evento); };
    scene.events.on(nome, listener); eventos.push([nome, listener]);
  }
  function avisar(nome, duracao, prioridade) {
    if (aviso && aviso.ate > tempo && aviso.prioridade > prioridade) return;
    aviso = { nome, ate: tempo + duracao, prioridade };
  }
  ouvir("novo-boss:vida", e => { if (e.anterior > e.vida && e.vida > 0) avisar("avaria", 850, 40); });
  ouvir("novo-boss:gerador-desativado", () => avisar("avaria", 1000, 50));
  ouvir("novo-boss:barreira-desativada", () => avisar("capacidadeEsgotada", 1600, 60));
  ouvir("novo-boss:fase-alterada", () => avisar("protocolo", 1800, 80));
  ouvir("novo-boss:ataque-iniciado", () => avisar("atacando", 700, 20));
  ouvir("novo-boss:derrotada", () => { derrotaEm ??= tempo; aviso = null; });

  function escolherMensagem() {
    if (scene.morteEmAndamento || scene.player?.morto || (scene.vida ?? 1) <= 0) return "gameOver";
    if (encontro.morto) {
      derrotaEm ??= tempo;
      const idade = tempo - derrotaEm;
      return idade < 2200 ? "fim" : idade < 4000 ? "desligando" : "apagado";
    }
    if (scene.multiplayer || encontro.suspenso || !encontro.jogadorNaArena || !encontro.sprite) return "aguardando";
    const intro = encontro.introducao?.snapshot();
    if (intro && !intro.concluida) return ETAPAS_ENTRADA[intro.etapa] ?? "aguardando";
    if (aviso?.ate > tempo) return aviso.nome;
    if (encontro.ataqueAtual || encontro.ataquePendente) return "atacando";
    if (encontro.estado === "vulneravel") return "falha";
    return encontro.barreiraAtiva ? "preparando" : "calculando";
  }

  const sistema = {
    atualizar(delta = 0) {
      if (destruido) return;
      if (Number.isFinite(delta) && delta > 0) tempo += delta;
      const vida = scene.vida;
      if (Number.isFinite(vida) && Number.isFinite(ultimaVida) && vida < ultimaVida &&
          encontro.active && encontro.jogadorNaArena && vida > 0) avisar("acerto", 900, 70);
      ultimaVida = vida;
      const proxima = escolherMensagem();
      if (proxima !== mensagem) { mensagem = proxima; inicioMensagem = tempo; frameAnterior = -1; }
      const frame = mensagem === "apagado" ? 1 : ANIMACAO[Math.floor((tempo - inicioMensagem) / FRAME_MS) % ANIMACAO.length];
      if (frame === frameAnterior) return;
      frameAnterior = frame;
      const [linha, coluna] = MENSAGENS[mensagem];
      for (const tela of telas) for (const { tile, dx, dy } of tela.celulas) {
        tile.index = tela.firstgid + (linha * 3 + dy) * tela.columns + (coluna + frame) * 3 + dx;
      }
    },
    destruir() {
      if (destruido) return;
      destruido = true;
      for (const [nome, listener] of eventos) scene.events.off(nome, listener);
      for (const tela of telas) for (const { tile, original } of tela.celulas) tile.index = original;
      telas.length = 0;
    },
    snapshot() { return { mensagem, frame: frameAnterior, telas: telas.map(t => ({ x: t.x, y: t.y })), destruido }; },
  };
  sistema.atualizar(0);
  return sistema;
}
