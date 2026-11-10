/** Fala temporária no mundo, acompanhando a cabeça do personagem sem bloquear controles. */
import { obterTemaPersonagem } from "./CharacterTheme.js";

const INTERVALO_LETRA_MS = 30;
const TEMPO_LEITURA_MS = 3200;
const OPACIDADE_FUNDO = 0.78;
const RAIO_CAIXA = 9;

export function criarFalaFlutuante(scene, nome = "player-speech-bubble") {
  const tema = obterTemaPersonagem(scene.personagemSelecionada);
  const texto = scene.add.text(0, 0, "", {
    fontFamily: "monospace", fontSize: "12px", fontStyle: "bold", color: tema.label, resolution: 3,
    align: "left", padding: { x: 9, y: 6 },
    wordWrap: { width: 160, useAdvancedWrap: true },
  }).setOrigin(0, 1).setDepth(501).setName(nome).setVisible(false);
  const ponta = scene.add.graphics().setDepth(500).setVisible(false);
  const nativo = criarTextoNitido(scene, texto, ponta, nome, tema);
  let visivel = false, destruido = false, timer = null;
  let ultimaFrase = "", ultimaEm = -Infinity;
  let letras = [], reveladas = 0, largura = 0, altura = 0;
  const segmentador = typeof Intl.Segmenter === "function"
    ? new Intl.Segmenter("pt-BR", { granularity: "grapheme" }) : null;
  const agora = () => scene.time.now ?? performance.now();
  const ultimasPorGrupo = new WeakMap();
  const ocultar = () => {
    timer?.remove(false); timer = null;
    visivel = false;
    if (!destruido) { texto.setVisible(false); ponta.setVisible(false); nativo?.setVisible(false); }
  };
  const revelar = () => {
    const quantidade = Math.min(letras.length, 1 + Math.floor((agora() - ultimaEm) / INTERVALO_LETRA_MS));
    if (quantidade <= reveladas) return;
    reveladas = quantidade;
    texto.setFixedSize(0, 0).setText(letras.slice(0, reveladas).join(""));
    // Quebrar uma palavra para a próxima linha não deve encolher a caixa já formada.
    largura = Math.max(largura, texto.width);
    altura = Math.max(altura, texto.height);
    texto.setFixedSize(largura, altura);
    if (nativo) {
      nativo.node.firstChild.textContent = texto.getWrappedText().join("\n");
      nativo.node.style.display = "block";
      nativo.updateSize();
      // Inclui a borda no mínimo para a caixa não encolher ao quebrar linhas.
      nativo.node.style.minWidth = `${nativo.node.offsetWidth}px`;
      nativo.node.style.minHeight = `${nativo.node.offsetHeight}px`;
      nativo.updateSize();
    } else {
      ponta.clear();
      ponta.fillStyle(0x000000, 0.15).fillRoundedRect(0, -altura + 2, largura, altura, RAIO_CAIXA);
      ponta.fillStyle(tema.accent, OPACIDADE_FUNDO)
        .fillRoundedRect(0, -altura, largura, altura, RAIO_CAIXA)
        .fillTriangle(8, 0, 14, 0, 5, 5);
      ponta.lineStyle(1, 0xffffff, 0.32).strokeRoundedRect(0, -altura, largura, altura, RAIO_CAIXA);
    }
    // O tempo para ler começa depois que a última letra aparece.
    if (reveladas === letras.length) timer = scene.time.delayedCall(TEMPO_LEITURA_MS, ocultar);
  };
  const atualizar = () => {
    if (!visivel || destruido) return;
    const player = scene.player;
    if (!player?.active || player.visible === false || scene.morteEmAndamento ||
        scene.generatorMenuOpen || scene.devItemMenuOpen) { ocultar(); return; }
    revelar();
    const topo = player.getTopCenter?.();
    const x = player.x + 16;
    // A área de dano acompanha o corpo; o frame pode ter grandes margens transparentes.
    const y = (scene.hitboxDanoPlayer?.y ?? topo?.y ??
      player.y - (player.displayHeight ?? 48) * (player.originY ?? 0.5)) + 10;
    texto.setPosition(x, y).setVisible(true);
    ponta.setPosition(x, y).setVisible(true);
    nativo?.setPosition(x, y).setVisible(true);
  };
  return {
    texto,
    mostrar(frases) {
      if (destruido) return;
      const instante = agora();
      if (visivel && instante - ultimaEm < 500) return;
      const opcoes = Array.isArray(frases) ? frases : [frases];
      if (!opcoes.length) return;
      const anterior = ultimasPorGrupo.get(opcoes) ?? ultimaFrase;
      ultimaFrase = opcoes[(opcoes.indexOf(anterior) + 1) % opcoes.length];
      ultimasPorGrupo.set(opcoes, ultimaFrase);
      ocultar();
      ultimaEm = instante;
      letras = segmentador ? [...segmentador.segment(ultimaFrase)].map(p => p.segment) : Array.from(ultimaFrase);
      reveladas = 0; largura = 0; altura = 0;
      if (nativo) {
        nativo.node.style.minWidth = "0px";
        nativo.node.style.minHeight = "0px";
      }
      visivel = letras.length > 0;
      atualizar();
    },
    atualizar,
    ocultar,
    destroy() {
      if (destruido) return;
      ocultar(); destruido = true;
      texto.destroy(); ponta.destroy(); nativo?.destroy();
    },
  };
}

/** O navegador mantém as letras nítidas no zoom e em telas de alta densidade. */
function criarTextoNitido(scene, texto, ponta, nome, tema) {
  if (!scene.add.dom) return null;
  const fundo = `${tema.accentCss}${Math.round(OPACIDADE_FUNDO * 255).toString(16).padStart(2, "0")}`;
  const caixa = document.createElement("div");
  caixa.setAttribute(`data-${nome}`, "");
  Object.assign(caixa.style, {
    background: fundo, color: texto.style.color,
    font: `${texto.style.fontStyle} ${texto.style.fontSize} ${texto.style.fontFamily}`,
    lineHeight: "16px", textAlign: "left", whiteSpace: "pre", padding: "5px 8px",
    boxSizing: "border-box", borderRadius: `${RAIO_CAIXA}px`,
    border: "1px solid rgba(255,255,255,0.32)", boxShadow: "0 2px 6px rgba(0,0,0,0.2)",
    pointerEvents: "none", textRendering: "optimizeLegibility",
  });
  caixa.appendChild(document.createElement("span"));
  const cauda = document.createElement("span");
  Object.assign(cauda.style, {
    position: "absolute", left: "4px", bottom: "-6px", width: "9px", height: "5px",
    background: fundo, clipPath: "polygon(33% 0, 100% 0, 0 100%)",
  });
  caixa.appendChild(cauda);
  const nativo = scene.add.dom(0, 0, caixa).setOrigin(0, 1).setDepth(501)
    .setName(`${nome}-native`).setVisible(false);
  nativo.pointerEvents = "none";
  // O texto Phaser continua medindo e quebrando as linhas, sem duplicar o desenho.
  texto.setAlpha(0); ponta.setAlpha(0);
  return nativo;
}
