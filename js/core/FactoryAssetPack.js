/** Pacote exclusivo da fábrica, completo antes de criar a fase, inclusive boss e áudio. */
import { criarCarregadorCacheavel, recursoDisponivel } from "./AssetLoading.js";
import { carregarSomImpactoChuvaBoss } from "../sounds/impactoChuvaBoss.js";
import { carregarSomTeleporteBoss } from "../sounds/teleporteBoss.js";
import { carregarSomExplosaoPulsoBoss } from "../sounds/explosaoPulsoBoss.js";
import { carregarSomDisparoBoss } from "../sounds/disparoBoss.js";
import { carregarSomGerador } from "../sounds/gerador.js";
import { carregarSomLuzFabrica } from "../sounds/luzFabrica.js";
import { carregarMusicaNovoBoss } from "../sounds/novoBoss.js";
import { carregarMusicaFabrica } from "../sounds/musicaFabrica.js";
import { carregarSonsLeitorCartao } from "../sounds/leitorCartao.js";
import { carregarSomPortaFabrica } from "../sounds/portaFabrica.js";
import { carregarSomEscudoBoss } from "../sounds/escudoBoss.js";
import { carregarSomEscotilhaBoss } from "../sounds/escotilhaBoss.js";
import { carregarSomImpactoEscotilhaBoss, carregarSomExplosaoEscotilhaBoss } from "../sounds/impactoEscotilhaBoss.js";
import { carregarSomRaioEscotilhaBoss } from "../sounds/raioEscotilhaBoss.js";
import { carregarAssetsNovoBoss } from "../enemies/novoBoss/NovoBossAssets.js";

const imagens = [
  ["factoryInsideA1", "../Tilesets/Industrial/A1_Modern_Inside_Factory_Rasak.png"],
  ["industrialGenerator", "../Tilesets/Industrial/Tileset_Pixel_Art_de_Gerador_Industrial.png?v=4d96171721c8"],
  ["industrialElectrical", "../Tilesets/Industrial/Tileset_Pixel_Art_de_Eletrica_industrial.png?v=137e2c850c30"],
  ["industrialA2", "../Tilesets/Industrial/A2_Industrial_Rasak.png"],
  ["industrialA4", "../Tilesets/Industrial/A4_Modern_Industrial_Rasak.png"],
  ["industrialA5", "../Tilesets/Industrial/A5_SciFi_Industrial_Rasak.png"],
  ["industrial1", "../Tilesets/Industrial/Tileset_Modern_Industrial_1_Rasak.png"],
  ["entertainingDistrict", "../Tilesets/Entertaining_District/Tileset_ModernSciFi_Entertaining_District_Rasak.png"],
  ["securityDoor", "../Tilesets/Animations/Doors/!Security Door.png"],
  ["industrialGate", "../Tilesets/Animations/Doors/!Industrial Gate.png"],
  ["industrialControls", "../Tilesets/Animations/Industrial and Security/!$Controlls.png"],
  ["industrialMachines", "../Tilesets/Animations/Industrial and Security/!Industrial mashines.png"],
  ["industrialSwitch", "../Tilesets/Animations/Industrial and Security/!Switch_Rasak.png"],
  ["electricGenerator", "../Tilesets/Animations/Industrial and Security/$ElectricGenerator.png"],
  ["generatorCharacter", "../Tilesets/Animations/Industrial and Security/!$Generator_char.png"],
  ["satellite", "../Tilesets/Animations/Industrial and Security/$Satalite.png"],
  ["ventilationSystem", "../Tilesets/Animations/Industrial and Security/!Ventilation System.png"],
  ["shieldGenerator", "../Tilesets/Animations/Industrial and Security/!$ShieldGenerator.png"],
  ["chemTank", "../Tilesets/Animations/Industrial and Security/!Chem-Tank.png"],
  ["shieldDoorCharacter", "../Tilesets/Animations/Industrial and Security/!$Shield_Door_char.png"],
  ["neonTubes1", "../Tilesets/Animations/Lights/!$Neontubes1.png"],
  ["neonTubes2", "../Tilesets/Animations/Lights/!$Neontubes2.png"],
  ["industrialLights1", "../Tilesets/Animations/Lights/!Industrials_Lights1.png"],
  ["modernFloorLights", "../Tilesets/Animations/Lights/!$ModernFloorLights.png"],
  ["roboPB", "../Tilesets/extras/RoboPB.png"],
  ["roboV", "../Tilesets/extras/RoboV.png"],
  ["supercomputer", "../Tilesets/Animations/Industrial and Security/Supercomputer.png"],
  ["wallBorders", "../Tilesets/extras/parede-borda.png"],
];

// Catálogo declarativo construído com os próprios módulos originais, sem duplicar seus caminhos.
function catalogar() {
  const arquivos = [];
  const load = Object.fromEntries(["image", "spritesheet", "atlas", "audio", "tilemapTiledJSON"].map(tipo =>
    [tipo, (chave, ...args) => arquivos.push({ tipo, chave, args })]));
  for (const [chave, caminho] of imagens) load.image(chave, caminho);
  load.tilemapTiledJSON("mapaParte2", "map/parte2-fase1.json");
  carregarAssetsNovoBoss({ load, textures: { exists: () => false } });
  carregarMusicaNovoBoss(load);
  carregarMusicaFabrica(load);
  carregarSomImpactoChuvaBoss(load);
  carregarSomTeleporteBoss(load);
  carregarSomExplosaoPulsoBoss(load);
  carregarSomDisparoBoss(load);
  carregarSomGerador(load);
  carregarSomLuzFabrica(load);
  carregarSonsLeitorCartao(load);
  carregarSomPortaFabrica(load);
  carregarSomEscudoBoss(load);
  carregarSomEscotilhaBoss(load);
  carregarSomImpactoEscotilhaBoss(load);
  carregarSomExplosaoEscotilhaBoss(load);
  carregarSomRaioEscotilhaBoss(load);
  return Object.freeze(arquivos.map(({ tipo, chave, args }) => Object.freeze({ tipo, chave,
    args: Object.freeze(args.map(arg => arg && typeof arg === "object" ? Object.freeze({ ...arg }) : arg)),
  })));
}

export const ASSETS_FABRICA = catalogar();

export function enfileirarAssetsFabrica(scene) {
  const load = criarCarregadorCacheavel(scene);
  load.setPath("./assets/");
  for (const { tipo, chave, args } of ASSETS_FABRICA) {
    // O Loader recebe sua própria configuração, sem metadados mutáveis entre partidas.
    load[tipo](chave, ...args.map(arg => arg && typeof arg === "object" ? { ...arg } : arg));
  }
}

export function assetsFabricaProntos(scene) {
  return ASSETS_FABRICA.every(arquivo => recursoDisponivel(scene, arquivo.tipo, arquivo.chave));
}

/** A fábrica só cria mapa, sons, sprites e runtime depois desta barreira. */
export function verificarEntradaFabrica(scene) {
  scene.aguardandoAssetsFabrica = !assetsFabricaProntos(scene);
  if (!scene.aguardandoAssetsFabrica) return true;
  scene.cameras.main.setBackgroundColor("#000000");
  scene.cameras.main.fadeEffect?.reset();
  const camera = scene.cameras.main;
  scene.add.text(camera.width / 2, camera.height / 2 - 30,
    "Não foi possível carregar a fábrica.\nVerifique a conexão e tente novamente.",
    { fontFamily: "monospace", fontSize: "16px", align: "center", color: "#ffffff" }).setOrigin(0.5);
  const tentar = scene.add.text(camera.width / 2, camera.height / 2 + 35, "TENTAR NOVAMENTE",
    { fontFamily: "monospace", fontSize: "18px", color: "#ffffff", backgroundColor: "#26333b", padding: { x: 16, y: 12 } })
    .setOrigin(0.5).setInteractive({ useHandCursor: true });
  tentar.once("pointerdown", () => scene.scene.restart({ ...scene.scene.settings.data }));
  return false;
}
