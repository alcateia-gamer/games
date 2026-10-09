// Nome da textura usada para o brilho radial da luz do poste.
// Essa textura é usada tanto no topo da lâmpada quanto na luz do chão.
const TEXTURA_LUZ_POSTE = "luz-poste-radial";

// Nome da textura usada para o feixe vertical que desce da lâmpada até o chão.
const TEXTURA_FEIXE_POSTE = "luz-poste-feixe";

// Tamanho da textura radial da luz.
const TAMANHO_TEXTURA_LUZ = 256;

// Largura da textura do feixe vertical.
const LARGURA_TEXTURA_FEIXE = 256;

// Altura da textura do feixe vertical.
const ALTURA_TEXTURA_FEIXE = 384;

// Depth padrão usado pelos efeitos de iluminação.
// Esse valor define a ordem de renderização da luz em relação aos outros elementos.
const DEPTH_LUZ_AMBIENTE = 9.5;

// Ativa ou desativa os elementos visuais de debug das luzes.
const DEBUG_LUZES = false;



// ------------------------------------------------------------
// FUNÇÃO: getProperty
// ------------------------------------------------------------
//
// Procura uma propriedade personalizada em um objeto do Tiled.
//
// Exemplo:
// Se o objeto tiver a propriedade "Raio", retorna o valor dela.
//
// Se a propriedade não existir, retorna o valor padrão informado.
function getProperty(object, name, defaultValue) {
  const property = object.properties?.find((item) => item.name === name);

  return property !== undefined ? property.value : defaultValue;
}



// ------------------------------------------------------------
// FUNÇÃO: criarTexturaLuzPoste
// ------------------------------------------------------------
//
// Cria uma textura radial branca reutilizável.
//
// Essa textura serve para:
// - brilho próximo da lâmpada;
// - círculo/mancha de luz no chão.
//
// A textura é criada apenas uma vez.
// Se ela já existir, a função termina imediatamente.
function criarTexturaLuzPoste(scene) {
  // Evita criar a mesma textura várias vezes.
  if (scene.textures.exists(TEXTURA_LUZ_POSTE)) return;

  // Cria uma textura Canvas de 256x256.
  const texture = scene.textures.createCanvas(
    TEXTURA_LUZ_POSTE,
    TAMANHO_TEXTURA_LUZ,
    TAMANHO_TEXTURA_LUZ,
  );

  // Pega o contexto 2D do canvas para desenhar a textura.
  const context = texture.getContext();

  // Descobre o centro da textura.
  const center = TAMANHO_TEXTURA_LUZ / 2;

  // Cria um gradiente radial.
  //
  // Ele começa no centro e vai ficando transparente
  // conforme se aproxima das bordas.
  const gradient = context.createRadialGradient(
    center,
    center,
    0,
    center,
    center,
    center,
  );

  // Centro totalmente branco e forte.
  gradient.addColorStop(0, "rgba(255, 255, 255, 1)");

  // Região ainda bastante clara.
  gradient.addColorStop(0.18, "rgba(255, 255, 255, 0.78)");

  // Região intermediária mais suave.
  gradient.addColorStop(0.48, "rgba(255, 255, 255, 0.32)");

  // Próximo da borda fica quase transparente.
  gradient.addColorStop(0.78, "rgba(255, 255, 255, 0.07)");

  // Borda completamente transparente.
  gradient.addColorStop(1, "rgba(255, 255, 255, 0)");

  // Aplica o gradiente no canvas.
  context.fillStyle = gradient;

  // Preenche a textura inteira com esse gradiente.
  context.fillRect(
    0,
    0,
    TAMANHO_TEXTURA_LUZ,
    TAMANHO_TEXTURA_LUZ,
  );

  // Atualiza a textura no Phaser.
  texture.refresh();
}



// ------------------------------------------------------------
// FUNÇÃO: criarTexturaFeixePoste
// ------------------------------------------------------------
//
// Cria a textura do feixe de luz.
//
// O feixe tem:
// - parte superior estreita;
// - parte inferior mais larga;
// - centro mais claro;
// - bordas suaves;
// - transparência progressiva.
function criarTexturaFeixePoste(scene) {
  // Se a textura já existir, não cria novamente.
  if (scene.textures.exists(TEXTURA_FEIXE_POSTE)) return;

  // Cria um Canvas para desenhar o feixe.
  const texture = scene.textures.createCanvas(
    TEXTURA_FEIXE_POSTE,
    LARGURA_TEXTURA_FEIXE,
    ALTURA_TEXTURA_FEIXE,
  );

  // Pega o contexto 2D.
  const context = texture.getContext();

  // Descobre o centro horizontal da textura.
  const centerX = LARGURA_TEXTURA_FEIXE / 2;

  // Salva o estado atual do canvas.
  context.save();

  // Aplica blur para deixar o feixe mais suave.
  context.filter = "blur(10px)";

  // Define a cor branca.
  context.fillStyle = "#ffffff";

  // Começa a desenhar o formato do feixe.
  context.beginPath();

  // Parte superior esquerda do feixe.
  context.moveTo(centerX - 8, 0);

  // Parte superior direita do feixe.
  context.lineTo(centerX + 8, 0);

  // Parte inferior direita, bem mais aberta.
  context.lineTo(
    LARGURA_TEXTURA_FEIXE - 8,
    ALTURA_TEXTURA_FEIXE,
  );

  // Parte inferior esquerda.
  context.lineTo(
    8,
    ALTURA_TEXTURA_FEIXE,
  );

  // Fecha o formato.
  context.closePath();

  // Preenche o feixe.
  context.fill();

  // Restaura o estado anterior do canvas.
  context.restore();



  // ----------------------------------------------------------
  // GRADIENTE LATERAL
  // ----------------------------------------------------------
  //
  // Faz o centro do feixe ficar mais forte
  // e as laterais ficarem transparentes.
  context.globalCompositeOperation = "destination-in";

  const sideGradient = context.createLinearGradient(
    0,
    0,
    LARGURA_TEXTURA_FEIXE,
    0,
  );

  // Lado esquerdo totalmente transparente.
  sideGradient.addColorStop(
    0,
    "rgba(255, 255, 255, 0)",
  );

  // Começa a aparecer.
  sideGradient.addColorStop(
    0.18,
    "rgba(255, 255, 255, 0.18)",
  );

  // Centro bem iluminado.
  sideGradient.addColorStop(
    0.5,
    "rgba(255, 255, 255, 0.9)",
  );

  // Começa a desaparecer do outro lado.
  sideGradient.addColorStop(
    0.82,
    "rgba(255, 255, 255, 0.18)",
  );

  // Lado direito totalmente transparente.
  sideGradient.addColorStop(
    1,
    "rgba(255, 255, 255, 0)",
  );

  // Aplica o gradiente lateral.
  context.fillStyle = sideGradient;

  context.fillRect(
    0,
    0,
    LARGURA_TEXTURA_FEIXE,
    ALTURA_TEXTURA_FEIXE,
  );



  // ----------------------------------------------------------
  // GRADIENTE VERTICAL
  // ----------------------------------------------------------
  //
  // Controla a intensidade da luz do topo até o chão.
  const lengthGradient = context.createLinearGradient(
    0,
    0,
    0,
    ALTURA_TEXTURA_FEIXE,
  );

  // Começa mais fraco bem no topo.
  lengthGradient.addColorStop(
    0,
    "rgba(255, 255, 255, 0.18)",
  );

  // Logo abaixo fica bem forte.
  lengthGradient.addColorStop(
    0.12,
    "rgba(255, 255, 255, 0.82)",
  );

  // Meio do feixe.
  lengthGradient.addColorStop(
    0.58,
    "rgba(255, 255, 255, 0.58)",
  );

  // Próximo do chão começa a enfraquecer.
  lengthGradient.addColorStop(
    0.9,
    "rgba(255, 255, 255, 0.28)",
  );

  // Final totalmente transparente.
  lengthGradient.addColorStop(
    1,
    "rgba(255, 255, 255, 0)",
  );

  // Aplica o gradiente vertical.
  context.fillStyle = lengthGradient;

  context.fillRect(
    0,
    0,
    LARGURA_TEXTURA_FEIXE,
    ALTURA_TEXTURA_FEIXE,
  );

  // Volta para o modo normal de composição.
  context.globalCompositeOperation = "source-over";

  // Atualiza a textura no Phaser.
  texture.refresh();
}



// ------------------------------------------------------------
// FUNÇÃO: criarLuzPoste
// ------------------------------------------------------------
//
// Cria os três elementos visuais de uma luz de poste:
//
// 1. glowTopo
//    pequeno brilho na lâmpada;
//
// 2. feixe
//    luz que desce da lâmpada até o chão;
//
// 3. luzChao
//    mancha/círculo iluminado no chão.
//
function criarLuzPoste(
  scene,
  x,
  y,
  raio,
  intensidade,
  cor,
  depths,
) {
  // Define o comprimento do feixe de acordo com o raio da luz.
  const comprimentoFeixe = raio * 0.55;

  // Calcula o tamanho do brilho da lâmpada.
  //
  // Nunca fica menor que 14
  // e nunca maior que 44.
  const tamanhoGlow = Math.max(
    14,
    Math.min(raio * 0.25, 44),
  );

  // Calcula onde termina o feixe vertical.
  const yFinalFeixe = y + 4 + comprimentoFeixe;

  // Define onde fica o centro da luz no chão.
  const yCentroLuzChao = yFinalFeixe + 10;



  // ----------------------------------------------------------
  // BRILHO NO TOPO DA LÂMPADA
  // ----------------------------------------------------------
  const glowTopo = scene.add
    .image(x, y, TEXTURA_LUZ_POSTE)

    // Centraliza a textura.
    .setOrigin(0.5)

    // Define o tamanho visual.
    .setDisplaySize(
      tamanhoGlow,
      tamanhoGlow,
    )

    // Aplica a cor da luz.
    .setTint(cor)
    .setTintMode(Phaser.TintModes.FILL)

    // Controla a intensidade/transparência.
    .setAlpha(intensidade * 1.05)

    // ADD deixa a luz com aparência de brilho.
    .setBlendMode(Phaser.BlendModes.ADD)

    // Define o depth inicial.
    .setDepth(DEPTH_LUZ_AMBIENTE);



  // ----------------------------------------------------------
  // FEIXE VERTICAL
  // ----------------------------------------------------------
  const feixe = scene.add
    .image(
      x,
      y + 4,
      TEXTURA_FEIXE_POSTE,
    )

    // Origem horizontal no centro.
    //
    // Origem vertical em 0 significa que
    // o feixe começa exatamente no topo da imagem.
    .setOrigin(0.5, 0)

    // Define largura e comprimento do feixe.
    .setDisplaySize(
      raio * 0.8,
      comprimentoFeixe,
    )

    // Aplica a cor.
    .setTint(cor)
    .setTintMode(Phaser.TintModes.FILL)

    // Controla a intensidade.
    .setAlpha(intensidade * 1.05)

    // Usa modo de mistura aditivo.
    .setBlendMode(Phaser.BlendModes.ADD)

    // Depth inicial do feixe.
    .setDepth(DEPTH_LUZ_AMBIENTE);



  // ----------------------------------------------------------
  // LUZ NO CHÃO
  // ----------------------------------------------------------
  const luzChao = scene.add
    .image(
      x,
      yCentroLuzChao,
      TEXTURA_LUZ_POSTE,
    )

    // Centraliza a textura.
    .setOrigin(0.5)

    // Deixa a luz larga e achatada,
    // criando o efeito de iluminação no chão.
    .setDisplaySize(
      raio * 0.95,
      raio * 0.32,
    )

    // Aplica a cor.
    .setTint(cor)
    .setTintMode(Phaser.TintModes.FILL)

    // Intensidade um pouco maior.
    .setAlpha(intensidade * 1.1)

    // Mistura aditiva.
    .setBlendMode(Phaser.BlendModes.ADD)

    // Depth inicial.
    .setDepth(DEPTH_LUZ_AMBIENTE);



  // Retorna todos os elementos criados.
  //
  // Isso permite alterar depois, por exemplo,
  // o depth do feixe sem mexer na luz do chão.
  return {
    glowTopo,
    feixe,
    luzChao,
    yFinalFeixe,
    x,
    y,
    raio,
    intensidade,
  };
}



// ------------------------------------------------------------
// FUNÇÃO: criarLuzesPostes
// ------------------------------------------------------------
//
// Procura a Object Layer chamada "Luzes" no mapa do Tiled.
//
// Cada ponto existente nessa camada representa
// a posição de uma luz de poste.
function criarLuzesPostes(scene, map, depths) {
  // Procura a camada de objetos "Luzes".
  const luzesLayer = map.getObjectLayer("Luzes");

  // Se a camada não existir, não faz nada.
  if (!luzesLayer) return;

  // Pega apenas os objetos do tipo Point.
  //
  // Portanto, os pontos posicionados no Tiled
  // indicam onde as luzes devem nascer.
  const pontos = luzesLayer.objects.filter(
    (object) => object.point,
  );

  // Se não existir nenhum ponto, encerra.
  if (pontos.length === 0) return;

  // Cria as texturas necessárias.
  //
  // As funções já verificam se elas existem,
  // então não serão recriadas toda vez.
  criarTexturaLuzPoste(scene);
  criarTexturaFeixePoste(scene);



  // ----------------------------------------------------------
  // DEBUG
  // ----------------------------------------------------------
  //
  // Se DEBUG_LUZES estiver ativo,
  // cria gráficos para visualizar os pontos.
  const debugGraphics =
    DEBUG_LUZES || scene.DEBUG_LUZES
      ? scene.add.graphics().setDepth(100)
      : null;



  // ----------------------------------------------------------
  // CRIA TODAS AS LUZES
  // ----------------------------------------------------------
  //
  // Para cada ponto colocado no Tiled,
  // cria uma luz de poste.
  scene.luzesPostes = pontos.map((object) => {
    // Lê a propriedade "Raio" do objeto.
    //
    // Se não existir, usa 180.
    const raio = getProperty(
      object,
      "Raio",
      180,
    );

    // Lê a propriedade "Intensidade".
    //
    // Se não existir, usa 0.68.
    //
    // Clamp impede que ela fique menor que 0.68
    // ou maior que 0.78.
    const intensidade = Phaser.Math.Clamp(
      getProperty(
        object,
        "Intensidade",
        0.68,
      ),
      0.68,
      0.78,
    );

    // Define a luz como branca.
    const cor = 0xffffff;



    // Cria os efeitos visuais do poste.
    const luz = criarLuzPoste(
      scene,
      object.x,
      object.y,
      raio,
      intensidade,
      cor,
      depths,
    );



    // --------------------------------------------------------
    // DEBUG VISUAL
    // --------------------------------------------------------
    //
    // Desenha informações no mapa para facilitar
    // o posicionamento das luzes.
    if (debugGraphics) {
      // Linha azul-clara mostrando
      // do ponto da lâmpada até o final do feixe.
      debugGraphics.lineStyle(
        1,
        0x00ffff,
        0.8,
      );

      debugGraphics.lineBetween(
        object.x,
        object.y,
        object.x,
        luz.yFinalFeixe,
      );

      // Círculo mostrando o ponto inicial da luz.
      debugGraphics.strokeCircle(
        object.x,
        object.y,
        5,
      );

      // Círculo mostrando onde o feixe termina.
      debugGraphics.strokeCircle(
        object.x,
        luz.yFinalFeixe,
        7,
      );
    }

    // Salva essa luz na lista scene.luzesPostes.
    return luz;
  });
}



// ------------------------------------------------------------
// FUNÇÃO: atualizarDepthLuzesPostes
// ------------------------------------------------------------
//
// Atualiza o depth do FEIXE da luz
// em relação ao depth atual do personagem.
//
// Essa função provavelmente deve ser chamada durante o update,
// porque o depth do personagem pode mudar enquanto ele anda.
function atualizarDepthLuzesPostes(scene) {
  // Verifica se:
  //
  // - o personagem existe;
  // - está ativo;
  // - scene.luzesPostes é realmente um array.
  //
  // Caso contrário, encerra.
  if (
    !scene.player?.active ||
    !Array.isArray(scene.luzesPostes)
  ) {
    return;
  }

  // Calcula o depth do feixe.
  //
  // Math.max garante que o depth nunca fique
  // menor que DEPTH_LUZ_AMBIENTE.
  //
  // scene.player.depth + 0.000001 coloca
  // o feixe ligeiramente acima do personagem.
  const depth = Math.max(
    DEPTH_LUZ_AMBIENTE,
    scene.player.depth + 0.000001,
  );

  // Percorre todas as luzes.
  scene.luzesPostes.forEach(({ feixe }) => {
    // Coloca SOMENTE o feixe acima do personagem.
    //
    // glowTopo e luzChao continuam usando
    // DEPTH_LUZ_AMBIENTE.
    feixe.setDepth(depth);
  });
}



// ------------------------------------------------------------
// EXPORTAÇÕES
// ------------------------------------------------------------
//
// Permite utilizar essas funções em outros arquivos.
export {
  criarLuzesPostes,
  atualizarDepthLuzesPostes,
};