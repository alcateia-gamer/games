/**
 * @file Monta o mapa da fábrica. Corrige metadados de tilesets irregulares antes de criar suas
 * camadas, objetos e colisões.
 */

import { criarTilesetsFabrica } from "./Tilesets.js";
import { criarCamadasFabrica } from "./CamadasMapa.js";
import { criarObjetosFabrica } from "./ObjetosMapa.js";
import { criarColisoesFabrica } from "./ColisoesMapa.js";

// =====================================================
// CORREÇÃO DOS AVISOS DE TILESETS DO PHASER
// =====================================================
//
// Alguns tilesets exportados pelo Tiled possuem
// largura ou altura que não são múltiplos do
// tamanho dos tiles (48x48).
//
// Isso produz avisos como:
//
// Image tile area not tile size multiple in:
// !Chem-Tank
// RoboPB
// RoboV
// robo_novo
//
// A correção acontece ANTES da criação do mapa.
//
// IMPORTANTE:
// - Não altera os arquivos PNG.
// - Não modifica o arquivo JSON original.
// - Não altera firstgid ou tilecount.
// - Não muda posições dos objetos.
// - Não modifica colisões ou animações.
// - Mantém os ajustes existentes em Tilesets.js.
// =====================================================

// Tilesets que precisam da correção.
const TILESETS_DIMENSOES_IRREGULARES = new Set([
  "!Chem-Tank",
  "RoboPB",
  "RoboV",
  "robo_novo",
  "Tileset_Pixel_Art_de_Gerador_Industrial",
  "Tileset_Pixel_Art_de_Eletrica_industrial",
]);

// =====================================================
// CALCULAR DIMENSÃO VÁLIDA
// =====================================================
//
// Calcula quantos tiles inteiros cabem na imagem,
// considerando tamanho, margem e espaçamento.
//
// Pixels incompletos nas bordas são desconsiderados
// apenas nos metadados do mapa.
// =====================================================

/**
 * Calcula a dimensão que contém apenas tiles completos, respeitando margem e espaçamento.
 */
function calcularDimensaoValida(
  dimensao,
  tamanhoTile,
  margem = 0,
  espacamento = 0,
) {
  if (
    !Number.isFinite(dimensao) ||
    !Number.isFinite(tamanhoTile) ||
    tamanhoTile <= 0
  ) {
    return dimensao;
  }

  const quantidade = Math.floor(
    (dimensao - 2 * margem + espacamento) / (tamanhoTile + espacamento),
  );

  if (quantidade <= 0) {
    return dimensao;
  }

  return (
    quantidade * tamanhoTile +
    Math.max(0, quantidade - 1) * espacamento +
    2 * margem
  );
}

// =====================================================
// CORRIGIR METADADOS ANTES DE CRIAR O TILEMAP
// =====================================================

/**
 * Ajusta em memória os metadados dos tilesets irregulares para evitar recortes inválidos pelo
 * Phaser.
 */
function corrigirDimensoesTilesetsFabrica(scene) {
  // Recuperar o mapa já carregado pelo Preloader.
  const entrada = scene.cache.tilemap.get("mapaParte2");

  if (!entrada) {
    return;
  }

  // O Phaser armazena os dados do Tiled em .data.
  const dados = entrada.data ?? entrada;

  if (!Array.isArray(dados.tilesets)) {
    return;
  }

  for (const tileset of dados.tilesets) {
    // Corrigir somente os quatro tilesets conhecidos.
    if (!TILESETS_DIMENSOES_IRREGULARES.has(tileset.name)) {
      continue;
    }

    const larguraOriginal = tileset.imagewidth;
    const alturaOriginal = tileset.imageheight;

    const tamanhoX = tileset.tilewidth || 48;
    const tamanhoY = tileset.tileheight || 48;

    const margem = tileset.margin ?? 0;
    const espacamento = tileset.spacing ?? 0;

    // Calcular a área ocupada por tiles completos.
    const larguraCorrigida = calcularDimensaoValida(
      larguraOriginal,
      tamanhoX,
      margem,
      espacamento,
    );

    const alturaCorrigida = calcularDimensaoValida(
      alturaOriginal,
      tamanhoY,
      margem,
      espacamento,
    );

    // Corrigir apenas as dimensões declaradas.
    tileset.imagewidth = larguraCorrigida;
    tileset.imageheight = alturaCorrigida;

    // Nenhum GID, coluna ou tilecount é alterado.
    // O JSON físico também permanece intacto.

    if (
      scene.DEBUG_MAP &&
      (larguraOriginal !== larguraCorrigida ||
        alturaOriginal !== alturaCorrigida)
    ) {
      console.log(
        `[Tileset ajustado] ${tileset.name}: ` +
          `${larguraOriginal}x${alturaOriginal} -> ` +
          `${larguraCorrigida}x${alturaCorrigida}`,
      );
    }
  }
}

// =====================================================
// CRIAR MAPA DA FÁBRICA - PARTE 2
// =====================================================

/**
 * Cria o tilemap da fábrica e seus componentes e guarda na cena as referências usadas para
 * ordenar camadas.
 */
function criarLevel1Parte2Map(scene) {
  // ===================================================
  // NOVO: CORRIGIR TILESETS ANTES DO PHASER LER O MAPA
  // ===================================================

  corrigirDimensoesTilesetsFabrica(scene);

  // ===================================================
  // CRIAR TILEMAP ORIGINAL
  // ===================================================

  const map = scene.make.tilemap({
    key: "mapaParte2",
  });

  // ===================================================
  // CARREGAR TILESETS ORIGINAIS
  // ===================================================

  const { tilesets, registrosTilesets, textureKeyByTilesetName } =
    criarTilesetsFabrica(map, scene);

  // ===================================================
  // CRIAR CAMADAS ORIGINAIS
  // ===================================================

  const camadas = criarCamadasFabrica(map, tilesets, scene, registrosTilesets);

  scene.camadaParedeAbaixoPerso = camadas.camadaParedeAbaixoPerso;

  scene.camadaParedeAcimaPerso = camadas.camadaParedeAcimaPerso;

  // ===================================================
  // CRIAR OBJETOS ORIGINAIS
  // ===================================================

  criarObjetosFabrica(scene, map, textureKeyByTilesetName);

  // ===================================================
  // CRIAR COLISÕES ORIGINAIS
  // ===================================================

  criarColisoesFabrica(scene, map);

  // ===================================================
  // REGISTRAR CAMADAS ORIGINAIS
  // ===================================================

  scene.camadasMapaParte2 = camadas.camadasTiles;

  return map;
}

export { criarLevel1Parte2Map };

export default criarLevel1Parte2Map;
