import { criarCarregadorCacheavel } from "../core/AssetLoading.js";
import { carregarQuedasCoop } from "../multiplayer/CoopRevival.js";
import { CutsceneLoading } from "../ui/CutsceneLoading.js";
/**
 * @file Carrega mapas, personagens, sons, interface e tilesets durante a introdução.
 */

import { carregarSomPropulsaoRoboBola } from "../sounds/propulsaoRoboBola.js";
import { prepararTexturaLaserOlhao } from "../enemies/RoboOlhao.js";
import { carregarSomColocando } from "../sounds/colocando.js";
import { carregarSonsInimigos } from "../sounds/inimigos.js";
import { carregarSonsKatana } from "../sounds/katana.js";
import { carregarSonsPersonagem } from "../sounds/personagem.js";
import { carregarSomEspecialMagnus } from "../sounds/magnusEspecial.js";
import { carregarSomEspecialKai } from "../sounds/kaiEspecial.js";
import { carregarSomEspecialAria } from "../sounds/ariaEspecial.js";
import { carregarSomAuraNyx } from "../sounds/SOUNDS_PERSONAGENS.js/sounds_Nyx,.js";
import { carregarMusicaCidade } from "../sounds/musicaCidade.js";
import { carregarSomEnchendoGalao } from "../sounds/enchendoGalao.js";
import { preloadInventoryItemImages } from "../inventory/InventoryItems.js";
import { carregarEfeitosEspeciais } from "../combat/SpecialAbilityEffects.js";

class Preloader extends Phaser.Scene {
  /**
   * Registra a cena de carregamento com a chave usada pelos menus.
   */
  constructor() {
    super("preloader");
  }

  // =====================================================
  // INICIAR CARREGAMENTO
  // =====================================================

  /**
   * A fila carrega em paralelo à introdução; a TV mostra o progresso quando necessário.
   */
  iniciarCarregamento() {
    this.carregandoAtivos = true;
    this.cutscene.setLoadProgress(null);
    const atualizarProgresso = valor => this.cutscene.setLoadProgress(valor);

    const aoConcluir = () => {
      this.events.off("shutdown", cancelar);
      this.load.off("progress", atualizarProgresso);
      if (this.falhasCarregamento.length) {
        this.cutscene.showLoadError("Não foi possível carregar todos os recursos.", () => {
          this.cutscene.clearMessage();
          this.cutscene.release();
          this.scene.restart({ ...this.scene.settings.data, cutscene: this.cutscene });
        });
        return;
      }
      // Também disponível no cliente cooperativo que só recebe o feixe do host.
      prepararTexturaLaserOlhao(this);
      this.prepararRenderizacaoPersonagens();
      this.finalizarCarregamento();
    };
    const cancelar = () => {
      this.load.off("progress", atualizarProgresso);
      this.load.off("complete", aoConcluir);
    };
    this.events.once("shutdown", cancelar);
    this.load.on("progress", atualizarProgresso);
    this.load.once("complete", aoConcluir);

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

  /**
   * Evita que detalhes dos sprites desapareçam no zoom fracionado da arena.
   * O shader de pixel art suaviza a redução e mantém os blocos na ampliação;
   * inclui caminhada e ataque para a aparência não mudar durante os golpes.
   */
  prepararRenderizacaoPersonagens() {
    const texturas = [
      "walk", "attack",
      "personagem2-walk", "personagem2-attack", "personagem2-idle",
      "personagem3-walk", "personagem3-attack",
      "personagem4-walk", "personagem4-attack",
    ];
    for (const chave of texturas) {
      if (this.textures.exists(chave)) {
        this.textures.get(chave).setSmoothPixelArt(true);
      }
    }
  }

  // =====================================================
  // FINALIZAR CARREGAMENTO
  // =====================================================

  /**
   * Entra em Level1 após a introdução e o loader, preservando personagem e modo de rede.
   */
  finalizarCarregamento() {
    this.cutscene.setAssetsReady(() => {
      this.game.musicaMenu?.stop();
      this.game.musicaMenu?.destroy();
      this.game.musicaMenu = null;
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
    const load = criarCarregadorCacheavel(this);
    const assets = { load, textures: this.textures, cache: this.cache };
    load.setPath("./assets/");
    if (!this.textures.exists("upgrade-npc")) load.spritesheet("upgrade-npc", "PERSONAGENS/NPC/NPC.png", { frameWidth: 64, frameHeight: 64 });
    if (!this.textures.exists("scrap-components")) load.image("scrap-components", "COLETAVEIS/sucatas.png");
    carregarMusicaCidade(load);
    carregarEfeitosEspeciais(assets);

    preloadInventoryItemImages(assets);
    load.image("hand_icon", "../Tilesets/extras/Hand_icon.png");

    carregarQuedasCoop(load);
    carregarSonsPersonagem(load);
    carregarSomEspecialMagnus(load);
    carregarSomEspecialKai(load);
    carregarSomEspecialAria(load);
    carregarSonsKatana(load);
    carregarSonsInimigos(load);
    carregarSomPropulsaoRoboBola(load);
    carregarSomColocando(load);
    carregarSomEnchendoGalao(load);
    carregarSomAuraNyx(load);

    // =====================================================
    // MAPAS
    // =====================================================

    load.tilemapTiledJSON(
      "mapa",
      "map/InicioFase1 (1).json?v=fuel-refill-1"
    );

    // =====================================================
    // PERSONAGEM 1 - KAI MERCER
    // =====================================================

    load.spritesheet(
      "walk",
      "PERSONAGENS/PERSONAGENS PRICIPAIS/KAI_MERCER 1/KAI_WALK.png",
      {
        frameWidth: 128,
        frameHeight: 128,
      }
    );

    load.spritesheet(
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

    load.spritesheet(
      "personagem2-walk",
      "PERSONAGENS/PERSONAGENS PRICIPAIS/MAGNUS_FORCE 2/magnus_walk_LARANJA.png",
      {
        frameWidth: 64,
        frameHeight: 64,
      }
    );

    load.spritesheet(
      "personagem2-attack",
      "PERSONAGENS/PERSONAGENS PRICIPAIS/MAGNUS_FORCE 2/magnus_ataque_LARANJA.png",
      {
        frameWidth: 128,
        frameHeight: 128,
      }
    );

    load.spritesheet(
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

    load.spritesheet(
      "personagem3-walk",
      "PERSONAGENS/PERSONAGENS PRICIPAIS/ARIA_KADE 3/ARIA_WALK.png",
      {
        frameWidth: 128,
        frameHeight: 128,
      }
    );

    load.spritesheet(
      "personagem3-attack",
      "PERSONAGENS/PERSONAGENS PRICIPAIS/ARIA_KADE 3/ARIA_ARCO_ATAQUE_ROSA.png",
      {
        frameWidth: 64,
        frameHeight: 64,
      }
    );

    load.spritesheet(
      "aria-arrow",
      "PERSONAGENS/PERSONAGENS PRICIPAIS/ARIA_KADE 3/Arrow_ROSA.png",
      {
        frameWidth: 64,
        frameHeight: 64,
      }
    );

    // =====================================================
    // PERSONAGEM 4 - NYX
    // =====================================================

    load.spritesheet(
      "personagem4-walk",
      "PERSONAGENS/PERSONAGENS PRICIPAIS/NYX_4/nyx_walk.png",
      {
        frameWidth: 64,
        frameHeight: 64,
      }
    );

    load.spritesheet(
      "personagem4-attack",
      "PERSONAGENS/PERSONAGENS PRICIPAIS/NYX_4/nyx_ataque.png",
      {
        frameWidth: 192,
        frameHeight: 192,
      }
    );

    // =====================================================
    // ROBÔ DE GUERRA
    // =====================================================

    load.spritesheet(
      "robo-teste",
      "PERSONAGENS/INIMIGOS PRINCIPAIS/ROBO_DE_GUERRA/robo_teste_2.png",
      {
        frameWidth: 311,
        frameHeight: 421,
      }
    );

    load.spritesheet(
      "robo-teste-normal",
      "PERSONAGENS/INIMIGOS PRINCIPAIS/ROBO_DE_GUERRA/robo_teste_3.png",
      {
        frameWidth: 311,
        frameHeight: 421,
      }
    );

    load.spritesheet(
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

    load.spritesheet(
      "robo-serra",
      "PERSONAGENS/INIMIGOS PRINCIPAIS/ROBO_DE_SERRA/robo_novo.png",
      {
        frameWidth: 278,
        frameHeight: 270,
      }
    );

    load.spritesheet(
      "robo-serra-morte",
      "PERSONAGENS/INIMIGOS PRINCIPAIS/ROBO_DE_SERRA/robo_serra_morte.png",
      { frameWidth: 278, frameHeight: 270 },
    );

    // =====================================================
    // ROBÔ PET
    // =====================================================

    load.spritesheet(
      "robo-pet",
      "PERSONAGENS/PERSONAGENS PRICIPAIS/ROBO_PET/robo_pet.png",
      {
        frameWidth: 354,
        frameHeight: 256,
      }
    );

    // =====================================================
    // ROBO BOLA
    // =====================================================

    load.spritesheet(
      "robo-olhao",
      "PERSONAGENS/INIMIGOS PRINCIPAIS/ROBO_OLHAO/robo_olhao.png",
      { frameWidth: 280, frameHeight: 280 },
    );

    load.spritesheet(
      "robo-olhao-morte",
      "PERSONAGENS/INIMIGOS PRINCIPAIS/ROBO_OLHAO/robo_olhao_morte.png",
      { frameWidth: 280, frameHeight: 280 },
    );

    load.spritesheet(
      "robo-bola",
      "PERSONAGENS/INIMIGOS PRINCIPAIS/ROBO_BOLA/ROBO_BOLA127x127.png",
      { frameWidth: 127, frameHeight: 127 },
    );

    load.spritesheet(
      "robo-bola-morte",
      "PERSONAGENS/INIMIGOS PRINCIPAIS/ROBO_BOLA/ROBO_MORTE_127x127.png",
      { frameWidth: 127, frameHeight: 127 },
    );

    // =====================================================
    // JOYSTICK
    // =====================================================

    load.plugin(
      "rexvirtualjoystickplugin",
      "../js/libs/rexvirtualjoystickplugin.min.js",
      true
    );

    // =====================================================
    // TILESETS - CIDADE
    // =====================================================

    load.image(
      "cityShopping",
      "../Tilesets/City/Tileset_SciFi_CityShopping_Rasak.png"
    );

    load.image(
      "street",
      "../Tilesets/City/Tileset_SciFi_Street_Rasak.png"
    );

    load.image(
      "street2",
      "../Tilesets/City/Tileset_SciFi_Street_Rasak.png"
    );

    load.image(
      "garbage",
      "../Tilesets/City/Tileset_SciFi_Garbage_Rasak.png"
    );

    load.image(
      "a5Street",
      "../Tilesets/City/A5_Street_Rasak.png"
    );

    load.image(
      "slums",
      "../Tilesets/City/Tileset_SciFi_Slums_Rasak.png"
    );

    load.image(
      "publicTransportation",
      "../Tilesets/City/Tileset_SciFi_PublicTransportation_Slums_Rasak.png.png"
    );

    load.image(
      "a4Outside",
      "../Tilesets/City/A4_SciFi_Outside_Rasak.png"
    );

    load.image(
      "a3Outside",
      "../Tilesets/City/A3_SciFi_Outside_Rasak.png"
    );

    load.image(
      "A5_SciFi_Outside_Rasak",
      "../Tilesets/City/A5_SciFi_Outside_Rasak.png"
    );

    load.image(
      "buildingExtras",
      "../Tilesets/City/Tileset_SciFi_BuildingExtras.png"
    );

    load.image(
      "torre",
      "../Tilesets/City/TorreTileset.png"
    );

    load.image(
      "cabineTelefonica",
      "../Tilesets/extras/Cabine-Tele.png"
    );

    // =====================================================
    // TILESETS - INTERIOR
    // =====================================================

    load.image(
      "apartment2",
      "../Tilesets/Inside/Tileset_SciFi_Arpartment_2_Rasak.png"
    );

    load.image(
      "insideA1",
      "../Tilesets/Inside/A1_SciFi_Inside_Rasak.png"
    );

    load.image(
      "insideA2",
      "../Tilesets/Inside/A2_SciFi_Inside_Rasak.png"
    );

    load.image(
      "club",
      "../Tilesets/Inside/Tileset_SciFi_Club_Rasak.png"
    );

    // =====================================================
    // TILESETS - INDUSTRIAL
    // =====================================================

    load.image(
      "ModernIndustrial2",
      "../Tilesets/Industrial/Tileset_Modern_Industrial_2_Rasak.png"
    );

    load.image(
      "ModernInsideFactoryA1",
      "../Tilesets/Industrial/A1_Modern_Inside_Factory_Rasak.png"
    );

    // A versão acompanha o PNG original para evitar reutilizar uma arte antiga em cache.

    load.image(
      "industrial3",
      "../Tilesets/Industrial/Tileset_Modern_Industrial_3_Rasak.png"
    );

    load.image(
      "insideA4",
      "../Tilesets/Inside/A4_SciFi_Inside_Rasak.png"
    );

    load.image(
      "insideA5",
      "../Tilesets/Inside/A5_SciFi_Inside_Rasak.png"
    );

    load.image(
      "a2Outside",
      "../Tilesets/City/A2_Scifi_Outside_Rasak.png"
    );

    load.image(
      "insideA3",
      "../Tilesets/Inside/A3_SciFi_Inside_Rasak.png"
    );

    load.image(
      "apartment1",
      "../Tilesets/Inside/Tileset_SciFi_Arpartment_1_Rasak.png"
    );

    // =====================================================
    // PORTAS E ELEMENTOS INDUSTRIAIS
    // =====================================================

    load.image(
      "tanqueCombustivel",
      "../Tilesets/Animations/Industrial and Security/tanque_pixel_art_300x150_transparente.png"
    );

    // =====================================================
    // LUZES
    // =====================================================

    // =====================================================
    // EXTRAS
    // =====================================================

    // =====================================================
    // NOVO BOTÃO DE DASH
    // Ajuste o nome dash.png se o sprite tiver outro nome.
    // =====================================================

    load.image(
      "botao-dash",
      "../Tilesets/extras/botao-dash.png"
    );
 
    load.image(
      "botoes-ulti",
      "../Tilesets/extras/botoes-ulti.png"
    );

    load.image(
      "wallBorder",
      "../Tilesets/extras/parede-borda.png"
    );

    load.image(
      "shopDoor",
      "../Tilesets/Animations/Doors/!ShopDoor.png"
    );

    // =====================================================
    // TILESETS - VEÍCULOS
    // =====================================================

    load.image(
      "VehiclesSpeederCivil5",
      "../Tilesets/Animations/Vehicles/Flying cars/Speeder_civil5.png"
    );

    load.image(
      "Speeder_civil2",
      "../Tilesets/Animations/Vehicles/Flying cars/Speeder_civil2.png"
    );

    load.image(
      "Transporter_Private",
      "../Tilesets/Animations/Vehicles/Flying cars/Transporter_Private.png"
    );

    load.image(
      "Transporter_Ambulance",
      "../Tilesets/Animations/Vehicles/Flying cars/Transporter_Ambulance.png"
    );

    load.image(
      "Transporter_PoliceSwat",
      "../Tilesets/Animations/Vehicles/Flying cars/Transporter_PoliceSwat.png"
    );

    // =====================================================
    // O cooperativo mantém todos os recursos prontos antes de publicar a entrada na cidade.

    // DEBUG DE ERROS
    // =====================================================

    const aoFalhar = (file) => {
      this.falhasCarregamento.push(file.key);
      console.error(
        "ERRO AO CARREGAR:",
        file.key,
        file.src
      );
    };
    this.load.on("loaderror", aoFalhar);
    this.events.once("shutdown", () => this.load.off("loaderror", aoFalhar));
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

    this.falhasCarregamento = [];
    const anterior = this.scene.settings.data?.cutscene;
    this.cutscene = anterior && !anterior.destroyed ? anterior : new CutsceneLoading(this.game, this.scene.settings.data);
    this.cutscene.attach(this);

    this.iniciarCarregamento();
  }
}

export default Preloader;
