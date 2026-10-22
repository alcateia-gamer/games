/**
 * @file Cena que carrega mapas, personagens, sons, interface e tilesets. Mostra progresso e
 * prepara a textura final do raio antes de entrar na fase.
 */


import { carregarSonsInimigos } from "../sounds/inimigos.js";
import { carregarSonsKatana } from "../sounds/katana.js";
import { carregarSonsPersonagem } from "../sounds/personagem.js";
import { carregarSomGerador } from "../sounds/gerador.js";
import { carregarSomLuzFabrica } from "../sounds/luzFabrica.js";
import { preloadInventoryItemImages } from "../inventory/InventoryItems.js";

class Preloader extends Phaser.Scene {
  /**
   * Registra a cena de carregamento com a chave usada pelos menus.
   */
  constructor() {
    super("preloader");
  }

  // =====================================================
  // NOVA SPRITE SHEET DO RAIO DA BASE
  // =====================================================
  //
  // PNG:
  // RAIO_BOSS_BASE (1) (1).png
  //
  // Dimensão da imagem original: 1789x2048.
  //
  // Organização original:
  // 7 colunas e 4 linhas.
  // 24 quadros, com 3 na última linha.
  //
  // Organização final usada pelo Boss:
  // 6 colunas e 4 linhas.
  //
  // TAMANHO EXATO DOS FRAMES FINAIS:
  // X = 311
  // Y = 623
  //
  // Não redimensiona o conteúdo dos raios.
  // Não altera a ordem dos frames.
  // Não modifica o PNG original.
  // =====================================================

  /**
   * Reorganiza em memória os 24 quadros do raio da base em uma folha de frames de 311 × 623
   * pixels.
   */
  prepararNovoRaioBase() {
    const CHAVE_ORIGINAL = "boss-raio-base-original";
    const CHAVE_FINAL = "boss-raio-base";
    const CHAVE_CANVAS = "boss-raio-base-canvas";
    const CHAVE_CORRECAO = "boss-raio-base-frame-623";

    // ===================================================
    // CONFIGURAÇÕES DA IMAGEM ORIGINAL
    // ===================================================

    const TOTAL_FRAMES = 24;
    const COLUNAS_ORIGEM = 7;
    const LINHAS_ORIGEM = 4;

    // ===================================================
    // CONFIGURAÇÕES DOS FRAMES FINAIS
    // ===================================================

    const FRAME_LARGURA = 311;
    const FRAME_ALTURA = 623;

    const COLUNAS_DESTINO = 6;
    const LINHAS_DESTINO = 4;

    // ===================================================
    // AJUSTES MANUAIS DE CENTRALIZAÇÃO
    // ===================================================

    const AJUSTE_CENTRO_X = 0;
    const AJUSTE_CENTRO_Y = 0;

    // ===================================================
    // VERIFICAR SE A IMAGEM FOI CARREGADA
    // ===================================================

    if (!this.textures.exists(CHAVE_ORIGINAL)) {
      console.error(
        "Boss: imagem original do raio da base não carregada."
      );
      return;
    }

    const texturaOriginal = this.textures.get(CHAVE_ORIGINAL);
    const imagem = texturaOriginal.getSourceImage();

    if (!imagem?.width || !imagem?.height) {
      console.error(
        "Boss: dimensões inválidas para o raio da base."
      );
      return;
    }

    // ===================================================
    // IDENTIFICAR OS LIMITES REAIS DOS QUADROS
    // ===================================================

    const larguraOriginal = imagem.width;
    const alturaOriginal = imagem.height;

    const larguraMediaOrigem =
      larguraOriginal / COLUNAS_ORIGEM;

    const alturaMediaOrigem =
      alturaOriginal / LINHAS_ORIGEM;

    if (
      Math.ceil(larguraMediaOrigem) > FRAME_LARGURA ||
      Math.ceil(alturaMediaOrigem) > FRAME_ALTURA
    ) {
      console.error(
        "Boss: o tamanho dos quadros originais excede 311x623."
      );
      return;
    }

    // ===================================================
    // LIMPAR TEXTURAS ANTERIORES
    // ===================================================

    if (this.textures.exists(CHAVE_CORRECAO)) {
      this.textures.remove(CHAVE_CORRECAO);
    }

    if (this.textures.exists(CHAVE_FINAL)) {
      this.textures.remove(CHAVE_FINAL);
    }

    if (this.textures.exists(CHAVE_CANVAS)) {
      this.textures.remove(CHAVE_CANVAS);
    }

    // ===================================================
    // CRIAR CANVAS COM A GRADE CORRETA
    // ===================================================

    const larguraCanvas =
      COLUNAS_DESTINO * FRAME_LARGURA;

    const alturaCanvas =
      LINHAS_DESTINO * FRAME_ALTURA;

    const texturaCanvas = this.textures.createCanvas(
      CHAVE_CANVAS,
      larguraCanvas,
      alturaCanvas
    );

    if (!texturaCanvas) {
      console.error(
        "Boss: não foi possível criar a textura do raio."
      );
      return;
    }

    const contexto = texturaCanvas.getContext();

    contexto.imageSmoothingEnabled = false;
    contexto.clearRect(
      0,
      0,
      larguraCanvas,
      alturaCanvas
    );

    // ===================================================
    // COPIAR OS 24 FRAMES NA ORDEM ORIGINAL
    // ===================================================

    for (let i = 0; i < TOTAL_FRAMES; i++) {
      const colunaOrigem = i % COLUNAS_ORIGEM;

      const linhaOrigem =
        Math.floor(i / COLUNAS_ORIGEM);

      const origemX = Math.round(
        colunaOrigem * larguraMediaOrigem
      );

      const origemDireita = Math.round(
        (colunaOrigem + 1) * larguraMediaOrigem
      );

      const origemY = Math.round(
        linhaOrigem * alturaMediaOrigem
      );

      const origemBaixo = Math.round(
        (linhaOrigem + 1) * alturaMediaOrigem
      );

      const larguraRecorte =
        origemDireita - origemX;

      const alturaRecorte =
        origemBaixo - origemY;

      const colunaDestino =
        i % COLUNAS_DESTINO;

      const linhaDestino =
        Math.floor(i / COLUNAS_DESTINO);

      const margemX = Math.floor(
        (FRAME_LARGURA - larguraRecorte) / 2
      );

      const margemY = Math.floor(
        (FRAME_ALTURA - alturaRecorte) / 2
      );

      const destinoX =
        colunaDestino * FRAME_LARGURA +
        margemX +
        AJUSTE_CENTRO_X;

      const destinoY =
        linhaDestino * FRAME_ALTURA +
        margemY +
        AJUSTE_CENTRO_Y;

      contexto.drawImage(
        imagem,
        origemX,
        origemY,
        larguraRecorte,
        alturaRecorte,
        destinoX,
        destinoY,
        larguraRecorte,
        alturaRecorte
      );
    }

    // ===================================================
    // ATUALIZAR TEXTURA DO CANVAS
    // ===================================================

    texturaCanvas.refresh();

    // ===================================================
    // CRIAR SPRITE SHEET FINAL DE 311x623
    // ===================================================

    this.textures.addSpriteSheet(
      CHAVE_FINAL,
      texturaCanvas.getSourceImage(),
      {
        frameWidth: FRAME_LARGURA,
        frameHeight: FRAME_ALTURA,
        endFrame: TOTAL_FRAMES - 1,
      }
    );

    const texturaFinal =
      this.textures.get(CHAVE_FINAL);

    const framesCarregados = texturaFinal
      .getFrameNames()
      .filter((nome) => /^\d+$/.test(String(nome)));

    if (framesCarregados.length !== TOTAL_FRAMES) {
      console.error(
        "Boss: quantidade incorreta de frames.",
        framesCarregados.length
      );
      return;
    }

    console.log(
      "Boss: raio da base carregado corretamente.",
      {
        frames: framesCarregados.length,
        larguraFrame: FRAME_LARGURA,
        alturaFrame: FRAME_ALTURA,
        larguraSpritesheet: larguraCanvas,
        alturaSpritesheet: alturaCanvas,
      }
    );
  }

  // =====================================================
  // INICIAR CARREGAMENTO
  // =====================================================

  /**
   * Cria a interface de progresso, conecta a conclusão e inicia a fila de recursos do jogo.
   */
  iniciarCarregamento() {
    this.carregandoAtivos = true;

    this.add
      .rectangle(400, 305, 440, 115, 0x000000, 1)
      .setStrokeStyle(2, 0x00ff66, 0.8);

    this.textoStatus = this.add.text(
      200,
      280,
      "CARREGANDO ASSETS...",
      {
        fontFamily: "monospace",
        fontSize: "13px",
        color: "#00ff66",
      }
    );

    this.add
      .rectangle(400, 315, 404, 26, 0x000000, 1)
      .setStrokeStyle(2, 0x00ff66, 1);

    this.barra = this.add
      .rectangle(204, 315, 0, 12, 0x00ff66)
      .setOrigin(0, 0.5);

    this.porcentagem = this.add
      .text(600, 342, "0%", {
        fontFamily: "monospace",
        fontSize: "14px",
        color: "#42ff84",
      })
      .setOrigin(1, 0.5);

    this.load.on("progress", (progress) => {
      this.barra.width = 392 * progress;

      this.porcentagem.setText(
        Math.floor(progress * 100) + "%"
      );
    });

    this.load.once("complete", () => {
      this.prepararNovoRaioBase();
      this.finalizarCarregamento();
    });

    this.carregarAssets();
    this.load.start();
  }

  // =====================================================
  // PRELOAD
  // =====================================================

  /**
   * Mantém o preload automático vazio; a fila é iniciada explicitamente pelo fluxo de criação
   * da cena.
   */
  preload() {
    // Carregamento iniciado após clicar em JOGAR.
  }

  // =====================================================
  // FINALIZAR CARREGAMENTO
  // =====================================================

  /**
   * Mostra a confirmação de carregamento e entra em Level1 com personagem e modo de rede
   * selecionados.
   */
  finalizarCarregamento() {
    this.barra.width = 392;
    this.porcentagem.setText("100%");
    this.textoStatus.setText("INCURSÃO PRONTA");

    this.time.delayedCall(1500, () => {
      this.scene.start("Level1", {
        personagem: this.personagemSelecionada,
        multiplayer: this.multiplayer,
      });
    });
  }

  // =====================================================
  // CARREGAR ASSETS
  // =====================================================

  /**
   * Enfileira imagens, folhas de sprites, mapas e sons usando os caminhos e chaves
   * compartilhados pelos módulos.
   */
  carregarAssets() {
    this.load.setPath("./assets/");

    preloadInventoryItemImages(this);
    this.load.image("hand_icon", "../Tilesets/extras/Hand_icon.png");

    carregarSonsPersonagem(this.load);
    carregarSonsKatana(this.load);
    carregarSonsInimigos(this.load);
    carregarSomGerador(this.load);
    carregarSomLuzFabrica(this.load);

    // =====================================================
    // MAPAS
    // =====================================================

    this.load.tilemapTiledJSON(
      "mapa",
      "map/InicioFase1 (1).json"
    );

    this.load.tilemapTiledJSON(
      "mapaParte2",
      "map/parte2-fase1.json"
    );

    // =====================================================
    // PERSONAGEM 1 - KAI MERCER
    // =====================================================

    this.load.spritesheet(
      "walk",
      "PERSONAGENS/PERSONAGENS PRICIPAIS/KAI_MERCER 1/KAI_WALK.png",
      {
        frameWidth: 128,
        frameHeight: 128,
      }
    );

    this.load.spritesheet(
      "attack",
      "PERSONAGENS/PERSONAGENS PRICIPAIS/KAI_MERCER 1/KAI_ATAQUE_KATANA.png",
      {
        frameWidth: 128,
        frameHeight: 128,
      }
    );

    // =====================================================
    // PERSONAGEM 2 - MAGNUS FORCE
    // =====================================================

    this.load.spritesheet(
      "personagem2-walk",
      "PERSONAGENS/PERSONAGENS PRICIPAIS/MAGNUS_FORCE 2/magnus_walk.png",
      {
        frameWidth: 64,
        frameHeight: 64,
      }
    );

    this.load.spritesheet(
      "personagem2-attack",
      "PERSONAGENS/PERSONAGENS PRICIPAIS/MAGNUS_FORCE 2/magnus_ataque_1.png",
      {
        frameWidth: 128,
        frameHeight: 128,
      }
    );

    this.load.spritesheet(
      "personagem2-idle",
      "PERSONAGENS/PERSONAGENS PRICIPAIS/MAGNUS_FORCE 2/magnus_1.png",
      {
        frameWidth: 48,
        frameHeight: 64,
      }
    );

    // =====================================================
    // PERSONAGEM 3 - ARIA KADE
    // =====================================================

    this.load.spritesheet(
      "personagem3-walk",
      "PERSONAGENS/PERSONAGENS PRICIPAIS/ARIA_KADE 3/ARIA_WALK.png",
      {
        frameWidth: 128,
        frameHeight: 128,
      }
    );

    this.load.spritesheet(
      "personagem3-attack",
      "PERSONAGENS/PERSONAGENS PRICIPAIS/ARIA_KADE 3/ARIA_ARCO_ATAQUE.png",
      {
        frameWidth: 64,
        frameHeight: 64,
      }
    );

    this.load.spritesheet(
      "aria-arrow",
      "PERSONAGENS/PERSONAGENS PRICIPAIS/ARIA_KADE 3/Arrow.png",
      {
        frameWidth: 64,
        frameHeight: 64,
      }
    );

    // =====================================================
    // PERSONAGEM 4 - NYX
    // =====================================================

    this.load.spritesheet(
      "personagem4-walk",
      "PERSONAGENS/PERSONAGENS PRICIPAIS/NYX_4/nyx_walk.png",
      {
        frameWidth: 64,
        frameHeight: 64,
      }
    );

    this.load.spritesheet(
      "personagem4-attack",
      "PERSONAGENS/PERSONAGENS PRICIPAIS/NYX_4/nyx_ataque.png",
      {
        frameWidth: 192,
        frameHeight: 192,
      }
    );

    // =====================================================
    // BOSS FINAL
    // =====================================================

    this.load.spritesheet(
      "boss-ataque-chao",
      "PERSONAGENS/INIMIGOS PRINCIPAIS/BOSS_FINAL/BOSS_ATAQUE_CHAO.png",
      {
        frameWidth: 256,
        frameHeight: 256,
        endFrame: 15,
      }
    );

    this.load.spritesheet(
      "boss-raio-chao",
      "PERSONAGENS/INIMIGOS PRINCIPAIS/BOSS_FINAL/BOSS_RAIO_CHAO.png",
      {
        frameWidth: 256,
        frameHeight: 256,
      }
    );

    this.load.spritesheet(
      "boss-raio-zona",
      "PERSONAGENS/INIMIGOS PRINCIPAIS/BOSS_FINAL/RAIO_BOSS_1.png",
      {
        frameWidth: 311,
        frameHeight: 623,
      }
    );

    this.load.image(
      "boss-raio-base-original",
      "PERSONAGENS/INIMIGOS PRINCIPAIS/BOSS_FINAL/RAIO_BOSS_BASE (1) (1).png"
    );

    this.load.spritesheet(
      "boss-rec-vida",
      "PERSONAGENS/INIMIGOS PRINCIPAIS/BOSS_FINAL/BOSS_REC_VIDA.png",
      {
        frameWidth: 256,
        frameHeight: 256,
        endFrame: 24,
      }
    );

    this.load.spritesheet(
      "boss-tiro-laser",
      "PERSONAGENS/INIMIGOS PRINCIPAIS/BOSS_FINAL/BOSS_TIRO_LAZER.png",
      {
        frameWidth: 256,
        frameHeight: 256,
        endFrame: 19,
      }
    );

    // =====================================================
    // ROBÔ DE GUERRA
    // =====================================================

    this.load.spritesheet(
      "robo-teste",
      "PERSONAGENS/INIMIGOS PRINCIPAIS/ROBO_DE_GUERRA/robo_teste_2.png",
      {
        frameWidth: 311,
        frameHeight: 421,
      }
    );

    this.load.spritesheet(
      "robo-teste-normal",
      "PERSONAGENS/INIMIGOS PRINCIPAIS/ROBO_DE_GUERRA/robo_teste_3.png",
      {
        frameWidth: 311,
        frameHeight: 421,
      }
    );

    this.load.spritesheet(
      "robo-morte",
      "PERSONAGENS/INIMIGOS PRINCIPAIS/ROBO_DE_GUERRA/robo_morte.png",
      {
        frameWidth: 311,
        frameHeight: 421,
      }
    );

    // =====================================================
    // ROBÔ DE SERRA
    // =====================================================

    this.load.spritesheet(
      "robo-serra",
      "PERSONAGENS/INIMIGOS PRINCIPAIS/ROBO_DE_SERRA/robo_novo.png",
      {
        frameWidth: 278,
        frameHeight: 270,
      }
    );

    // =====================================================
    // ROBÔ PET
    // =====================================================

    this.load.spritesheet(
      "robo-pet",
      "PERSONAGENS/PERSONAGENS PRICIPAIS/ROBO_PET/robo_pet.png",
      {
        frameWidth: 354,
        frameHeight: 256,
      }
    );

    // =====================================================
    // JOYSTICK
    // =====================================================

    this.load.plugin(
      "rexvirtualjoystickplugin",
      "../js/libs/rexvirtualjoystickplugin.min.js",
      true
    );

    // =====================================================
    // TILESETS - CIDADE
    // =====================================================

    this.load.image(
      "cityShopping",
      "../Tilesets/City/Tileset_SciFi_CityShopping_Rasak.png"
    );

    this.load.image(
      "street",
      "../Tilesets/City/Tileset_SciFi_Street_Rasak.png"
    );

    this.load.image(
      "street2",
      "../Tilesets/City/Tileset_SciFi_Street_Rasak_DUP.png"
    );

    this.load.image(
      "garbage",
      "../Tilesets/City/Tileset_SciFi_Garbage_Rasak.png"
    );

    this.load.image(
      "a5Street",
      "../Tilesets/City/A5_Street_Rasak.png"
    );

    this.load.image(
      "slums",
      "../Tilesets/City/Tileset_SciFi_Slums_Rasak.png"
    );

    this.load.image(
      "publicTransportation",
      "../Tilesets/City/Tileset_SciFi_PublicTransportation_Slums_Rasak.png.png"
    );

    this.load.image(
      "a4Outside",
      "../Tilesets/City/A4_SciFi_Outside_Rasak.png"
    );

    this.load.image(
      "a3Outside",
      "../Tilesets/City/A3_SciFi_Outside_Rasak.png"
    );

    this.load.image(
      "A5_SciFi_Outside_Rasak",
      "../Tilesets/City/A5_SciFi_Outside_Rasak.png"
    );

    this.load.image(
      "buildingExtras",
      "../Tilesets/City/Tileset_SciFi_BuildingExtras.png"
    );

    this.load.image(
      "torre",
      "../Tilesets/City/TorreTileset.png"
    );

    // =====================================================
    // TILESETS - INTERIOR
    // =====================================================

    this.load.image(
      "apartment2",
      "../Tilesets/Inside/Tileset_SciFi_Arpartment_2_Rasak.png"
    );

    this.load.image(
      "insideA1",
      "../Tilesets/Inside/A1_SciFi_Inside_Rasak.png"
    );

    this.load.image(
      "insideA2",
      "../Tilesets/Inside/A2_SciFi_Inside_Rasak.png"
    );

    this.load.image(
      "club",
      "../Tilesets/Inside/Tileset_SciFi_Club_Rasak.png"
    );

    // =====================================================
    // TILESETS - INDUSTRIAL
    // =====================================================

    this.load.image(
      "ModernIndustrial2",
      "../Tilesets/Industrial/Tileset_Modern_Industrial_2_Rasak.png"
    );

    this.load.image(
      "ModernInsideFactoryA1",
      "../Tilesets/Industrial/A1_Modern_Inside_Factory_Rasak.png"
    );

    this.load.image(
      "factoryInsideA1",
      "../Tilesets/Industrial/A1_Modern_Inside_Factory_Rasak.png"
    );

    this.load.image(
      "industrialGenerator",
      "../Tilesets/Industrial/Tileset_Pixel_Art_de_Gerador_Industrial.png",
    );

    this.load.image(
      "industrialElectrical",
      "../Tilesets/Industrial/Tileset_Pixel_Art_de_Eletrica_industrial.png",
    );

    this.load.image(
      "industrialA2",
      "../Tilesets/Industrial/A2_Industrial_Rasak.png"
    );

    this.load.image(
      "industrialA4",
      "../Tilesets/Industrial/A4_Modern_Industrial_Rasak.png"
    );

    this.load.image(
      "industrialA5",
      "../Tilesets/Industrial/A5_SciFi_Industrial_Rasak.png"
    );

    this.load.image(
      "industrial1",
      "../Tilesets/Industrial/Tileset_Modern_Industrial_1_Rasak.png"
    );

    this.load.image(
      "industrial3",
      "../Tilesets/Industrial/Tileset_Modern_Industrial_3_Rasak.png"
    );

    this.load.image(
      "entertainingDistrict",
      "../Tilesets/Entertaining_District/Tileset_ModernSciFi_Entertaining_District_Rasak.png"
    );

    this.load.image(
      "insideA4",
      "../Tilesets/Inside/A4_SciFi_Inside_Rasak.png"
    );

    this.load.image(
      "insideA5",
      "../Tilesets/Inside/A5_SciFi_Inside_Rasak.png"
    );

    this.load.image(
      "a2Outside",
      "../Tilesets/City/A2_Scifi_Outside_Rasak.png"
    );

    this.load.image(
      "insideA3",
      "../Tilesets/Inside/A3_SciFi_Inside_Rasak.png"
    );

    this.load.image(
      "apartment1",
      "../Tilesets/Inside/Tileset_SciFi_Arpartment_1_Rasak.png"
    );

    // =====================================================
    // PORTAS E ELEMENTOS INDUSTRIAIS
    // =====================================================

    this.load.image(
      "securityDoor",
      "../Tilesets/Animations/Doors/!Security Door.png"
    );

    this.load.image(
      "industrialGate",
      "../Tilesets/Animations/Doors/!Industrial Gate.png"
    );

    this.load.image(
      "industrialControls",
      "../Tilesets/Animations/Industrial and Security/!$Controlls.png"
    );

    this.load.image(
      "industrialMachines",
      "../Tilesets/Animations/Industrial and Security/!Industrial mashines.png"
    );

    this.load.image(
      "industrialSwitch",
      "../Tilesets/Animations/Industrial and Security/!Switch_Rasak.png"
    );

    this.load.image(
      "electricGenerator",
      "../Tilesets/Animations/Industrial and Security/$ElectricGenerator.png"
    );

    this.load.image(
      "generatorCharacter",
      "../Tilesets/Animations/Industrial and Security/!$Generator_char.png"
    );

    this.load.image(
      "satellite",
      "../Tilesets/Animations/Industrial and Security/$Satalite.png"
    );

    this.load.image(
      "ventilationSystem",
      "../Tilesets/Animations/Industrial and Security/!Ventilation System.png"
    );

    this.load.image(
      "shieldGenerator",
      "../Tilesets/Animations/Industrial and Security/!$ShieldGenerator.png"
    );

    this.load.image(
      "chemTank",
      "../Tilesets/Animations/Industrial and Security/!Chem-Tank.png"
    );

    this.load.image(
      "shieldDoorCharacter",
      "../Tilesets/Animations/Industrial and Security/!$Shield_Door_char.png"
    );

    // =====================================================
    // LUZES
    // =====================================================

    this.load.image(
      "neonTubes1",
      "../Tilesets/Animations/Lights/!$Neontubes1.png"
    );

    this.load.image(
      "neonTubes2",
      "../Tilesets/Animations/Lights/!$Neontubes2.png"
    );

    this.load.image(
      "industrialLights1",
      "../Tilesets/Animations/Lights/!Industrials_Lights1.png"
    );

    this.load.image(
      "modernFloorLights",
      "../Tilesets/Animations/Lights/!$ModernFloorLights.png"
    );

    // =====================================================
    // EXTRAS
    // =====================================================

    this.load.image(
      "roboPB",
      "../Tilesets/extras/RoboPB.png"
    );

    this.load.image(
      "energiaBoss",
      "../Tilesets/extras/EnergiaBoss.png"
    );

    this.load.image(
      "roboV",
      "../Tilesets/extras/RoboV.png"
    );

    // =====================================================
    // NOVO BOTÃO DE DASH
    // Ajuste o nome dash.png se o sprite tiver outro nome.
    // =====================================================

    this.load.image(
      "botao-dash",
      "../Tilesets/extras/botao-dash.png"
    );

    this.load.image(
      "supercomputer",
      "../Tilesets/Animations/Industrial and Security/Supercomputer.png"
    );

    this.load.image(
      "wallBorders",
      "../Tilesets/extras/parede-borda.png"
    );

    this.load.image(
      "wallBorder",
      "../Tilesets/extras/parede-borda.png"
    );

    this.load.image(
      "shopDoor",
      "../Tilesets/Animations/Doors/!ShopDoor.png"
    );

    // =====================================================
    // TILESETS - VEÍCULOS
    // =====================================================

    this.load.image(
      "VehiclesSpeederCivil5",
      "../Tilesets/Animations/Vehicles/Flying cars/Speeder_civil5.png"
    );

    this.load.image(
      "Speeder_civil2",
      "../Tilesets/Animations/Vehicles/Flying cars/Speeder_civil2.png"
    );

    this.load.image(
      "Transporter_Private",
      "../Tilesets/Animations/Vehicles/Flying cars/Transporter_Private.png"
    );

    this.load.image(
      "Transporter_Ambulance",
      "../Tilesets/Animations/Vehicles/Flying cars/Transporter_Ambulance.png"
    );

    this.load.image(
      "Transporter_PoliceSwat",
      "../Tilesets/Animations/Vehicles/Flying cars/Transporter_PoliceSwat.png"
    );

    // =====================================================
    // DEBUG DE ERROS
    // =====================================================

    this.load.on("loaderror", (file) => {
      console.error(
        "ERRO AO CARREGAR:",
        file.key,
        file.src
      );
    });
  }

  // =====================================================
  // CREATE
  // =====================================================

  /**
   * Recupera personagem e multiplayer enviados pelo menu e inicia o carregamento da partida.
   */
  create() {
    this.cameras.main.setBackgroundColor("#000000");

    this.personagemSelecionada =
      this.scene.settings.data?.personagem ||
      "kai-mercer";

    this.multiplayer =
      this.scene.settings.data?.multiplayer === true;

    this.iniciarCarregamento();
  }
}

export default Preloader;
