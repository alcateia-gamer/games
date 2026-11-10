/** Catálogo de coletáveis para testes, disponível somente com DEV ativo. */
import { listInventoryItems } from "../inventory/InventoryItems.js";
import { prepareInventoryIcon } from "../inventory/InventoryUI.js";

export function criarMenuColetaveisDev(scene) {
  const tecla = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.I);
  const escape = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
  let modal = null;
  let movimentoAnterior;
  let cancelarAssinatura;
  let itens = [];
  let pagina = 0;
  let capacidade = 4;
  let dimensoes = "";
  let mensagem = "";
  let feedback;
  let contadores = [];
  scene.devItemMenuOpen = false;

  const autorizado = () => !!scene.developerMode && !!scene.player?.active &&
    !scene.morteEmAndamento && !scene.transicaoEmAndamento &&
    !scene.transicaoRetornoEmAndamento && !scene.generatorMenuOpen && !!scene.inventory;

  const atualizarContadores = () => {
    for (const { item, texto } of contadores) {
      texto.setText(`No inventário: ${scene.inventory.getQuantity(item.id)}`);
    }
  };

  const fechar = () => {
    if (!scene.devItemMenuOpen) return;
    scene.devItemMenuOpen = false;
    if (!scene.morteEmAndamento && !scene.generatorMenuOpen) {
      scene.movimentoBloqueado = movimentoAnterior;
    }
    cancelarAssinatura?.();
    cancelarAssinatura = null;
    modal?.destroy();
    modal = null;
    contadores = [];
  };

  const adicionar = (item, quantidade, combustivel = 0) => {
    if (!scene.devItemMenuOpen || !autorizado()) { fechar(); return false; }
    const adicionado = scene.inventory.addItem(item.id, quantidade, { fuel: combustivel });
    const estado = item.id === "gasolina" ? combustivel === 1 ? " (cheio)" : " (vazio)" : "";
    mensagem = adicionado ? `+${quantidade} ${item.name}${estado}` : "Inventário cheio. Libere espaço para pegar o item.";
    feedback.setText(mensagem).setColor(adicionado ? "#86efac" : "#fca5a5");
    return adicionado;
  };

  const construir = () => {
    modal?.destroy();
    contadores = [];
    const camera = scene.cameras.main;
    const largura = Math.min(620, camera.width - 24);
    const altura = Math.min(390, camera.height - 24);
    capacidade = Math.max(1, Math.floor((altura - 150) / 54));
    const paginas = Math.max(1, Math.ceil(itens.length / capacidade));
    pagina = Math.min(pagina, paginas - 1);
    modal = scene.add.container(0, 0).setScrollFactor(0).setDepth(10000);
    const texto = (x, y, label, tamanho = 14, cor = "#e5e7eb") => {
      const visual = scene.add.text(x, y, label, {
        fontFamily: "monospace", fontSize: `${tamanho}px`, color: cor,
      }).setScrollFactor(0);
      modal.add(visual);
      return visual;
    };
    const retangulo = (x, y, w, h, cor, alpha = 1) => {
      const visual = scene.add.rectangle(x, y, w, h, cor, alpha).setScrollFactor(0);
      modal.add(visual);
      return visual;
    };
    const botao = (x, y, w, label, acao, nome) => {
      const visual = retangulo(x, y, w, 32, 0x07505a).setName(nome)
        .setStrokeStyle(1, 0x29c9d8).setInteractive({ useHandCursor: true });
      texto(x, y, label).setOrigin(0.5);
      visual.on("pointerdown", (pointer, localX, localY, event) => {
        event?.stopPropagation();
        if (scene.devItemMenuOpen && autorizado()) acao();
        else fechar();
      });
      return visual;
    };
    retangulo(0, 0, camera.width, camera.height, 0x02070b, 0.88)
      .setInteractive().on("pointerdown", (pointer, x, y, event) => event?.stopPropagation());
    retangulo(0, 0, largura, altura, 0x08131b).setStrokeStyle(2, 0x29c9d8);
    texto(-largura / 2 + 18, -altura / 2 + 16, "COLETÁVEIS · DEV", 20);
    botao(largura / 2 - 43, -altura / 2 + 30, 62, "Fechar", fechar, "dev-items-close");
    texto(-largura / 2 + 18, -altura / 2 + 46, "I / Esc para fechar", 12, "#94a3b8");

    itens.slice(pagina * capacidade, (pagina + 1) * capacidade).forEach((item, index) => {
      const y = -altura / 2 + 97 + index * 54;
      const icon = scene.add.image(-largura / 2 + 32, y, prepareInventoryIcon(scene, item))
        .setDisplaySize(30, 30).setScrollFactor(0);
      modal.add(icon);
      texto(-largura / 2 + 58, y - 17, item.name, 14).setWordWrapWidth(Math.max(70, largura - 225));
      contadores.push({ item, texto: texto(-largura / 2 + 58, y + 5, "", 11, "#94a3b8") });
      if (item.id === "gasolina") {
        botao(largura / 2 - 153, y, 86, "+1 vazio", () => adicionar(item, 1), `dev-item:${item.id}:1`);
        botao(largura / 2 - 57, y, 86, "+1 cheio", () => adicionar(item, 1, 1), `dev-item:${item.id}:1:cheio`);
      } else {
        botao(largura / 2 - 108, y, 56, "+1", () => adicionar(item, 1), `dev-item:${item.id}:1`);
      }
      if (item.maxStack > 1) {
        botao(largura / 2 - 42, y, 56, "+10", () => adicionar(item, 10), `dev-item:${item.id}:10`);
      }
    });
    feedback = texto(-largura / 2 + 18, altura / 2 - 68, mensagem, 12, "#86efac")
      .setWordWrapWidth(largura - 36);
    texto(0, altura / 2 - 22, `${pagina + 1} / ${paginas}`, 12).setOrigin(0.5);
    if (pagina > 0) botao(-largura / 2 + 55, altura / 2 - 24, 78, "Anterior", () => {
      pagina--; construir(); posicionar();
    }, "dev-items-prev");
    if (pagina < paginas - 1) botao(largura / 2 - 55, altura / 2 - 24, 78, "Próxima", () => {
      pagina++; construir(); posicionar();
    }, "dev-items-next");
    dimensoes = `${camera.width}:${camera.height}`;
    atualizarContadores();
  };

  const posicionar = () => {
    if (!scene.devItemMenuOpen) return;
    if (!autorizado()) { fechar(); return; }
    const camera = scene.cameras.main;
    if (dimensoes !== `${camera.width}:${camera.height}`) construir();
    const zoomX = camera.zoomX || camera.zoom || 1;
    const zoomY = camera.zoomY || camera.zoom || 1;
    const origemX = camera.width * camera.originX;
    const origemY = camera.height * camera.originY;
    modal.setPosition(origemX + (camera.width / 2 - origemX) / zoomX,
      origemY + (camera.height / 2 - origemY) / zoomY).setScale(1 / zoomX, 1 / zoomY);
  };

  const alternar = () => {
    if (scene.devItemMenuOpen) { fechar(); return; }
    if (!autorizado()) return;
    itens = listInventoryItems();
    for (const item of itens) scene.inventoryItems.set(item.id, item);
    pagina = 0;
    mensagem = "Escolha um item para adicionar ao inventário.";
    movimentoAnterior = scene.movimentoBloqueado;
    scene.movimentoBloqueado = true;
    scene.devItemMenuOpen = true;
    scene.player.setVelocity(0, 0);
    if (scene.estadoDash) scene.estadoDash.ativo = false;
    construir();
    cancelarAssinatura = scene.inventory.onChange(atualizarContadores);
    posicionar();
  };

  scene.fecharMenuColetaveisDev = fechar;
  tecla.on("down", alternar);
  escape.on("down", fechar);
  scene.events.on(Phaser.Scenes.Events.PRE_RENDER, posicionar);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    fechar();
    tecla.off("down", alternar);
    escape.off("down", fechar);
    scene.events.off(Phaser.Scenes.Events.PRE_RENDER, posicionar);
    scene.fecharMenuColetaveisDev = null;
  });
}
