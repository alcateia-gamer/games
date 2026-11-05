// Pacote revertido: controles preservados, mas não criados por nenhuma cena.
/** Atalhos de consumíveis exclusivos do protótipo; o estoque pertence ao inventário. */
import { personagemTesteAtivo } from "../player/PersonagemTeste.js";
import { ITENS_RECUPERACAO_TESTE, darItensIniciaisTeste,
  usarItemRecuperacaoTeste } from "../player/RecursosPersonagemTeste.js";
import { recuperarVida } from "../player/PlayerStatus.js";
import { posicionarBotaoFixo } from "./FixedActionButton.js";
import { prepareInventoryIcon } from "../inventory/InventoryUI.js";
import { getInventoryItem } from "../inventory/InventoryItems.js";

export function criarControlesRecuperacaoTeste(scene) {
  scene.limparRecuperacaoTeste?.();
  if (!personagemTesteAtivo(scene)) return;
  darItensIniciaisTeste(scene);
  const botoes = ITENS_RECUPERACAO_TESTE.map(item => {
    const botao = scene.add.rectangle(0, 0, 70, 48, 0x10202a, 0.95)
      .setStrokeStyle(2, item.cor).setDepth(230).setScrollFactor(0)
      .setInteractive({ useHandCursor: true }).setName(`usar-${item.id}`);
    const chave = prepareInventoryIcon(scene, getInventoryItem(item.id), 38);
    const icone = scene.add.image(0, 0, chave).setDepth(231).setScrollFactor(0);
    const quantidade = scene.add.text(0, 0, "", { fontFamily: "monospace", fontSize: "14px",
      fontStyle: "bold", color: "#ffffff" }).setOrigin(0.5).setDepth(232).setScrollFactor(0);
    const percentual = scene.add.text(0, 0, `+${item.fracao * 100}%`, { fontFamily: "monospace",
      fontSize: "10px", color: "#bde8eb" }).setOrigin(0.5).setDepth(232).setScrollFactor(0);
    botao.on("pointerdown", (_p, _x, _y, evento) => {
      evento?.stopPropagation();
      if (usarItemRecuperacaoTeste(scene, item.id)) recuperarVida(scene, 0);
      atualizar();
    });
    return { item, botao, icone, quantidade, percentual };
  });
  scene.botoesRecuperacaoTeste = botoes;
  function atualizar() {
    const camera = scene.cameras.main;
    const visivel = !!scene.player?.active && !scene.morteEmAndamento &&
      !scene.generatorMenuOpen && !scene.devItemMenuOpen;
    const yInicial = scene.minimap?.devScreenY ?? 147;
    botoes.forEach(({ item, botao, icone, quantidade, percentual }, i) => {
      const x = camera.width - 40, y = yInicial + i * 54;
      const n = scene.inventory?.getQuantity(item.id) ?? 0;
      const utilizavel = n > 0 && scene[item.atributo] < scene[item.maximo];
      botao.setVisible(visivel).setAlpha(utilizavel ? 1 : 0.55);
      icone.setVisible(visivel).setAlpha(n ? 1 : 0.4);
      quantidade.setVisible(visivel).setText(`×${n}`);
      percentual.setVisible(visivel);
      posicionarBotaoFixo(camera, botao, x, y);
      posicionarBotaoFixo(camera, icone, x - 14, y);
      posicionarBotaoFixo(camera, quantidade, x + 18, y - 6);
      posicionarBotaoFixo(camera, percentual, x + 17, y + 12);
    });
  }
  function limpar() {
    scene.events.off("prerender", atualizar);
    scene.events.off("shutdown", limpar);
    for (const { botao, icone, quantidade, percentual } of botoes) {
      botao.destroy(); icone.destroy(); quantidade.destroy(); percentual.destroy();
    }
    scene.botoesRecuperacaoTeste = null;
    scene.limparRecuperacaoTeste = null;
  }
  scene.limparRecuperacaoTeste = limpar;
  scene.events.on("prerender", atualizar);
  scene.events.once("shutdown", limpar);
  atualizar();
}
