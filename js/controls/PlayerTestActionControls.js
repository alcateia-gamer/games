/** Botão contextual e troca de armas, exclusivos do personagem de teste. */
import { PERSONAGEM_TESTE, personagemTesteAtivo, obterArmaPersonagemTeste,
  obterArmasPersonagemTeste } from "../player/PersonagemTeste.js";
import { trocarArmaPersonagemTeste } from "../player/ArmaPersonagemTeste.js";
import { posicionarBotaoFixo } from "./FixedActionButton.js";

export const POSICAO_ACAO_TESTE = { x: 720, y: 350 };
const POSICAO_TROCA = { x: 730, y: 260 };

/** A coleta continua pertencendo ao inventário; apenas muda de posição e substitui o ataque. */
export function criarControlesAcaoTeste(scene) {
  scene.limparAcoesPersonagemTeste?.();
  if (!personagemTesteAtivo(scene)) return;
  const config = PERSONAGEM_TESTE.botaoTroca;
  const textura = scene.textures.get(config.textura);
  if (!textura.has("botao")) {
    const r = config.recorte;
    textura.add("botao", 0, r.x, r.y, r.largura, r.altura);
  }
  const botao = scene.add.image(0, 0, config.textura, "botao")
    .setOrigin(0.5).setScrollFactor(0).setDepth(230).setAlpha(0.85)
    .setInteractive({ useHandCursor: true });
  const icone = scene.add.image(0, 0, obterArmaPersonagemTeste(scene).textura, "arma")
    .setOrigin(0.5).setScrollFactor(0).setDepth(231);
  scene.botaoTrocaArma = botao;
  scene.iconeTrocaArma = icone;
  let ponteiroTroca = null;
  let armaExibida = null;

  const atualizar = () => {
    const ativo = !!scene.player?.active && !scene.morteEmAndamento &&
      !scene.generatorMenuOpen && !scene.devItemMenuOpen;
    const interagindo = ativo && !!scene.botaoColetarItemVisivel;
    scene.botaoAtaque?.setVisible(ativo && !interagindo);
    scene.iconeAtaque?.setVisible(ativo && !interagindo);
    scene.botaoColetarItem?.setVisible(interagindo);
    const podeTrocar = ativo && obterArmasPersonagemTeste(scene).length > 1;
    botao.setVisible(podeTrocar);
    icone.setVisible(podeTrocar);

    const arma = obterArmaPersonagemTeste(scene);
    if (arma !== armaExibida) {
      icone.setTexture(arma.textura, "arma");
      armaExibida = arma;
    }
    const pressionado = ponteiroTroca === null ? 1 : 0.92;
    const camera = scene.cameras.main;
    posicionarBotaoFixo(camera, botao, POSICAO_TROCA.x, POSICAO_TROCA.y,
      60 / config.recorte.largura * pressionado);
    // O PNG recortado preserva a proporção e cabe inteiramente no centro transparente.
    const escalaIcone = Math.min(32 / arma.recorte.largura, 24 / arma.recorte.altura);
    posicionarBotaoFixo(camera, icone, POSICAO_TROCA.x, POSICAO_TROCA.y,
      escalaIcone * pressionado);
  };
  const soltar = (pointer) => {
    if (pointer && ponteiroTroca !== pointer.id) return;
    ponteiroTroca = null;
    atualizar();
  };
  const cancelar = () => soltar();
  botao.on("pointerdown", pointer => {
    if (ponteiroTroca !== null || !botao.visible) return;
    ponteiroTroca = pointer?.id ?? 0;
    trocarArmaPersonagemTeste(scene);
    atualizar();
  });
  botao.on("pointerup", soltar);
  botao.on("pointerout", soltar);
  scene.input.on("pointerup", soltar);
  scene.input.on("pointerupoutside", soltar);
  scene.events.on("pause", cancelar);
  scene.events.on("sleep", cancelar);
  scene.game?.events?.on("blur", cancelar);

  const limpar = () => {
    scene.events.off("prerender", atualizar);
    scene.events.off("shutdown", limpar);
    scene.events.off("pause", cancelar);
    scene.events.off("sleep", cancelar);
    scene.game?.events?.off("blur", cancelar);
    scene.input.off("pointerup", soltar);
    scene.input.off("pointerupoutside", soltar);
    botao.destroy();
    icone.destroy();
    scene.botaoTrocaArma = null;
    scene.iconeTrocaArma = null;
    scene.atualizarAcoesPersonagemTeste = null;
    scene.limparAcoesPersonagemTeste = null;
  };
  scene.atualizarAcoesPersonagemTeste = atualizar;
  scene.limparAcoesPersonagemTeste = limpar;
  scene.events.on("prerender", atualizar);
  scene.events.once("shutdown", limpar);
  atualizar();
}
