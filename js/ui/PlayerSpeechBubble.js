/** Fala temporária no mundo, acompanhando a cabeça do personagem sem bloquear controles. */
import { obterTemaPersonagem } from "./CharacterTheme.js";

export function criarFalaFlutuante(scene, nome = "player-speech-bubble") {
  const tema = obterTemaPersonagem(scene.personagemSelecionada);
  const texto = scene.add.text(0, 0, "", {
    fontFamily: "monospace", fontSize: "12px", fontStyle: "bold", color: tema.label, resolution: 3,
    backgroundColor: tema.accentCss, align: "center", padding: { x: 6, y: 4 },
    wordWrap: { width: 160, useAdvancedWrap: true },
  }).setOrigin(0, 1).setDepth(501).setName(nome).setVisible(false);
  const ponta = scene.add.graphics().setDepth(500).setVisible(false);
  ponta.fillStyle(tema.accent, 1).fillTriangle(1, -7, 1, -2, -5, 2);
  const nativo = criarTextoNitido(scene, texto, ponta, nome);
  let visivel = false, destruido = false, timer = null;
  let ultimaFrase = "", ultimaEm = -Infinity;
  const ultimasPorGrupo = new WeakMap();
  const ocultar = () => {
    timer?.remove(false); timer = null;
    visivel = false;
    if (!destruido) { texto.setVisible(false); ponta.setVisible(false); nativo?.setVisible(false); }
  };
  const atualizar = () => {
    if (!visivel || destruido) return;
    const player = scene.player;
    if (!player?.active || player.visible === false || scene.morteEmAndamento ||
        scene.generatorMenuOpen || scene.devItemMenuOpen) { ocultar(); return; }
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
      const agora = scene.time.now ?? performance.now();
      if (visivel && agora - ultimaEm < 500) return;
      const opcoes = Array.isArray(frases) ? frases : [frases];
      const anterior = ultimasPorGrupo.get(opcoes) ?? ultimaFrase;
      ultimaFrase = opcoes[(opcoes.indexOf(anterior) + 1) % opcoes.length];
      ultimasPorGrupo.set(opcoes, ultimaFrase);
      ultimaEm = agora;
      texto.setText(ultimaFrase);
      if (nativo) {
        nativo.node.firstChild.textContent = texto.getWrappedText().join("\n");
        nativo.node.style.display = "block";
        nativo.updateSize();
      }
      ocultar(); visivel = true;
      atualizar();
      if (visivel) timer = scene.time.delayedCall(3200, ocultar);
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

/** O navegador mantém as letras nítidas na escala FIT, no zoom e em telas de alta densidade. */
function criarTextoNitido(scene, texto, ponta, nome) {
  if (!scene.add.dom) return null;
  const caixa = document.createElement("div");
  caixa.setAttribute(`data-${nome}`, "");
  Object.assign(caixa.style, {
    background: texto.style.backgroundColor, color: texto.style.color,
    font: `${texto.style.fontStyle} ${texto.style.fontSize} ${texto.style.fontFamily}`,
    lineHeight: "16px", textAlign: "center", whiteSpace: "pre", padding: "4px 6px",
    pointerEvents: "none", textRendering: "optimizeLegibility",
  });
  caixa.appendChild(document.createElement("span"));
  const cauda = document.createElement("span");
  Object.assign(cauda.style, {
    position: "absolute", left: "-5px", bottom: "-2px", width: "6px", height: "9px",
    background: texto.style.backgroundColor, clipPath: "polygon(100% 0, 100% 55%, 0 100%)",
  });
  caixa.appendChild(cauda);
  const nativo = scene.add.dom(0, 0, caixa).setOrigin(0, 1).setDepth(501)
    .setName(`${nome}-native`).setVisible(false);
  nativo.pointerEvents = "none";
  // O texto Phaser continua medindo e quebrando as linhas, sem duplicar o desenho.
  texto.setAlpha(0); ponta.setAlpha(0);
  return nativo;
}
