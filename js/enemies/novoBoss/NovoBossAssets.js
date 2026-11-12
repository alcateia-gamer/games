/** Recursos próprios; nenhuma chave ou animação do boss antigo é reutilizada. */
export const assetsNovoBoss = Object.freeze({
  idle: Object.freeze({
    chave: "novo-boss-idle",
    arquivo: "PERSONAGENS/INIMIGOS PRINCIPAIS/BossPrincipal/boss-idle.png",
    larguraFrame: 288,
    alturaFrame: 288,
    ultimoFrame: 15,
    animacao: "novo-boss-idle-anim",
    quadrosPorSegundo: 10,
    nucleo: Object.freeze({ x: 150, y: 120 }),
  }),
  ataque: Object.freeze({
    chave: "novo-boss-ataque",
    arquivo: "PERSONAGENS/INIMIGOS PRINCIPAIS/BossPrincipal/boss-ataque.png",
    larguraFrame: 336,
    alturaFrame: 336,
    ultimoFrame: 47,
    animacao: "novo-boss-ataque-anim",
    quadrosPorSegundo: 16,
    // Correlação dos pixels centrais com idle: +18 em X e +48 em Y no frame 0.
    deslocamentoCorpo: Object.freeze({ x: 18, y: 48 }),
    nucleo: Object.freeze({ x: 168, y: 168 }),
  }),
  heavensFury: Object.freeze({
    chave: "novo-boss-heavens-fury",
    arquivo: "../Tilesets/mechanics/HeavensFury_preview(transparente).png",
    larguraFrame: 384,
    alturaFrame: 384,
    ultimoFrame: 12,
    // Largura opaca do quadro 4 na faixa do impacto, próxima ao chão (y=270–288).
    diametroImpacto: 150,
    origemX: 198 / 384,
    origemY: 0.75,
  }),
  escudoEnergia: Object.freeze({
    chave: "novo-boss-escudo-energia",
    arquivo: "PERSONAGENS/INIMIGOS PRINCIPAIS/BossPrincipal/derivados/escudo-energia-quadros.png",
    larguraFrame: 800, alturaFrame: 800, ultimoFrame: 4, frameMs: 100,
    origemX: 390 / 800, origemY: 400 / 800, diametro: 640,
  }),
  explosao: Object.freeze({
    chave: "novo-boss-explosao",
    arquivo: "PERSONAGENS/INIMIGOS PRINCIPAIS/BossPrincipal/derivados/ataque-explosao-quadros.png",
    larguraFrame: 600, alturaFrame: 600, ultimoFrame: 7, frameMs: 80,
    // O início nasce junto aos pés; a expansão abre no centro do corpo.
    origemX: 300 / 600, origemY: 300 / 600, diametro: 576,
  }),
  disparoEnergia: Object.freeze({
    chave: "novo-boss-disparo-energia",
    arquivo: "PERSONAGENS/INIMIGOS PRINCIPAIS/BossPrincipal/derivados/disparo-energia-pagina-1.png",
    larguraFrame: 660, alturaFrame: 499, ultimoFrame: 31,
    totalQuadros: 61, frameMs: 20,
    // A frente luminosa aponta à esquerda; a cauda com anéis fica à direita.
    origemX: 160 / 660, origemY: 260 / 499, raioNativo: 55,
  }),
  disparoEnergiaFinal: Object.freeze({
    chave: "novo-boss-disparo-energia-final",
    arquivo: "PERSONAGENS/INIMIGOS PRINCIPAIS/BossPrincipal/derivados/disparo-energia-pagina-2.png",
    larguraFrame: 660, alturaFrame: 499, ultimoFrame: 28,
  }),
  tentaculo: Object.freeze({
    chave: "novo-boss-tentaculo", tipo: "atlas",
    arquivo: "PERSONAGENS/INIMIGOS PRINCIPAIS/BossPrincipal/derivados/tentaculo/tentaculo-atlas-1.png",
    dados: "PERSONAGENS/INIMIGOS PRINCIPAIS/BossPrincipal/derivados/tentaculo/tentaculo-atlas-1.json",
    larguraFrame: 800, alturaFrame: 600, ultimoFrame: 139, frameMs: 40,
    prefixo: "tentaculo-", origemX: 0.5, origemY: 495 / 600, diametroBase: 120,
  }),
  tentaculoAgarrao: Object.freeze({
    chave: "novo-boss-tentaculo-agarrao", tipo: "atlas",
    arquivo: "PERSONAGENS/INIMIGOS PRINCIPAIS/BossPrincipal/derivados/tentaculo/agarrao-atlas-1.png",
    dados: "PERSONAGENS/INIMIGOS PRINCIPAIS/BossPrincipal/derivados/tentaculo/agarrao-atlas-1.json",
    larguraFrame: 800, alturaFrame: 600, ultimoFrame: 19, frameMs: 40,
    prefixo: "agarrao-", origemX: 0.5, origemY: 323 / 600,
    alturaEnvolvimento: 352, proporcaoAlvo: 1.35,
  }),
  morte: Object.freeze({
    chave: "novo-boss-morte",
    arquivo: "PERSONAGENS/INIMIGOS PRINCIPAIS/BossPrincipal/derivados/teleporte/boss-morte.png",
    larguraFrame: 216, alturaFrame: 216, ultimoFrame: 0,
    // Pose única fornecida; alinha o capuz à pose idle sem ampliar a arte.
    origemX: 105 / 216, origemY: 86 / 216,
  }),
  teleporteSaida: Object.freeze({
    chave: "novo-boss-teleporte-saida",
    arquivo: "PERSONAGENS/INIMIGOS PRINCIPAIS/BossPrincipal/derivados/teleporte/teleporte-saida.png",
    larguraFrame: 512, alturaFrame: 640, ultimoFrame: 17,
    duracoesMs: Object.freeze([60, 30, 30, 30, 20, 50, 50, 20, 50, 50, 50, 30, 30, 30, 30, 50, 50, 40]),
    origemX: 256 / 512, origemY: 344 / 640,
  }),
  teleporteEntrada: Object.freeze({
    chave: "novo-boss-teleporte-entrada",
    arquivo: "PERSONAGENS/INIMIGOS PRINCIPAIS/BossPrincipal/derivados/teleporte/teleporte-entrada.png",
    larguraFrame: 512, alturaFrame: 640, ultimoFrame: 8,
    duracoesMs: Object.freeze([30, 20, 20, 20, 40, 30, 20, 10, 80]),
    origemX: 256 / 512, origemY: 344 / 640,
  }),
  areaAtaque: Object.freeze({
    chave: "novo-boss-area-ataque",
    arquivo: "PERSONAGENS/INIMIGOS PRINCIPAIS/BossPrincipal/derivados/area-ataque/area-ataque-quadros.png",
    larguraFrame: 221, alturaFrame: 157, ultimoFrame: 108,
    origemX: 112 / 221, origemY: 84.5 / 157,
    larguraEfeito: 188, alturaEfeito: 123,
    duracoesMs: Object.freeze([70, 60, 70, 70, 60, 70, 70, 60, 70, 70, 60, 70, 70, 60, 70, 70, 60, 70, 70, 60, 70, 70, 60, 70, 70, 60, 70, 70, 60, 70, 70, 60, 70, 70, 60, 70, 70, 60, 70, 70, 60, 70, 70, 60, 70, 70, 60, 70, 70, 60, 70, 70, 60, 70, 70, 60, 70, 70, 60, 70, 70, 60, 70, 70, 60, 70, 70, 60, 70, 70, 60, 70, 70, 60, 70, 70, 60, 70, 70, 60, 70, 70, 60, 70, 70, 60, 70, 70, 60, 70, 70, 60, 70, 70, 60, 70, 70, 60, 70, 70, 60, 70, 70, 60, 70, 70, 60, 70, 70]),
  }),
  torreSummon: Object.freeze({
    chave: "novo-boss-torre-summon",
    arquivo: "PERSONAGENS/INIMIGOS PRINCIPAIS/BossPrincipal/derivados/torres/torre-summon.png",
    larguraFrame: 192, alturaFrame: 258, ultimoFrame: 15, frameMs: 100,
  }),
  torreIdle: Object.freeze({
    chave: "novo-boss-torre-idle",
    arquivo: "PERSONAGENS/INIMIGOS PRINCIPAIS/BossPrincipal/derivados/torres/torre-idle.png",
    larguraFrame: 192, alturaFrame: 258, ultimoFrame: 14,
    duracoesMs: Object.freeze([100, 100, 100, 100, 100, 100, 100, 200, 100, 100, 100, 100, 100, 100, 100]),
  }),
  torreAttacked: Object.freeze({
    chave: "novo-boss-torre-attacked",
    arquivo: "PERSONAGENS/INIMIGOS PRINCIPAIS/BossPrincipal/derivados/torres/torre-attacked.png",
    larguraFrame: 192, alturaFrame: 258, ultimoFrame: 3, frameMs: 100,
  }),
  torreDeath: Object.freeze({
    chave: "novo-boss-torre-death",
    arquivo: "PERSONAGENS/INIMIGOS PRINCIPAIS/BossPrincipal/derivados/torres/torre-death.png",
    larguraFrame: 192, alturaFrame: 258, ultimoFrame: 0, frameMs: 100,
  }),
  portal: Object.freeze({
    chave: "novo-boss-portal",
    arquivo: "PERSONAGENS/INIMIGOS PRINCIPAIS/BossPrincipal/derivados/portal/portal-quadros.png",
    larguraFrame: 320, alturaFrame: 320, ultimoFrame: 6,
    duracoesMs: Object.freeze([100, 100, 100, 100, 100, 100, 200]),
    // Centro da abertura escura na célula; o contorno tem padding assimétrico.
    origemX: 190 / 320, origemY: 155 / 320, escala: 0.35,
  }),
});

/** Chamado pelo preloader após load.setPath("./assets/"). */
export function carregarAssetsNovoBoss(scene) {
  for (const asset of Object.values(assetsNovoBoss)) {
    if (scene.textures.exists(asset.chave)) continue;
    if (asset.tipo === "atlas") {
      scene.load.atlas(asset.chave, asset.arquivo, asset.dados);
      continue;
    }
    scene.load.spritesheet(asset.chave, asset.arquivo, {
      frameWidth: asset.larguraFrame,
      frameHeight: asset.alturaFrame,
      startFrame: 0,
      endFrame: asset.ultimoFrame,
    });
  }
}

/** Registra poses em chaves próprias; a lógica decide quando reproduzi-las. */
export function criarAnimacoesNovoBoss(scene) {
  if (!scene.textures.exists(assetsNovoBoss.idle.chave)) return false;
  for (const [tipo, asset] of [["idle", assetsNovoBoss.idle], ["ataque", assetsNovoBoss.ataque]]) {
    if (!scene.textures.exists(asset.chave) || scene.anims.exists(asset.animacao)) continue;
    scene.anims.create({ key: asset.animacao,
      frames: scene.anims.generateFrameNumbers(asset.chave, { start: 0, end: asset.ultimoFrame }),
      frameRate: asset.quadrosPorSegundo, repeat: tipo === "idle" ? -1 : 0,
    });
  }
  return true;
}
