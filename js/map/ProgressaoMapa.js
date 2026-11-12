/** Libera as áreas anteriores quando a progressão fecha o caminho de volta. */
import { limparGrupoRobos } from "../enemies/EnemyTest.js";
import { jogadorNaArenaNovoBoss } from "../enemies/novoBoss/NovoBossConfig.js";

export function descarregarCidade(scene) {
  if (scene.cidadeDescarregada) return;
  scene.cidadeDescarregada = true;
  scene.cache.tilemap.remove("mapa");
  const cidade = scene.scene.get("Level1");
  if (cidade && !scene.scene.isActive("Level1")) {
    cidade.map?.destroy();
    cidade.map = null;
    for (const key of ["poleBaseObjects", "cabineObjects", "tanqueCombustivelObjects", "neonObjects"]) {
      cidade[key] = [];
    }
  }
}

/** O início da cutscene é o ponto definitivo de descarregamento, também no cooperativo. */
export function descarregarFabricaParaBoss(scene) {
  const encontro = scene.novoBoss;
  if (scene.fabricaDescarregada || !encontro) return;
  const entradas = (scene.portasFabrica ?? []).filter(p => ["porta02", "porta03"].includes(p.nome));
  const limiteY = entradas.length ? Math.max(...entradas.map(p => p.area.y + p.area.height)) : -5232;
  scene.fabricaDescarregada = true;
  const fora = objeto => objeto.y - (objeto.displayHeight ?? objeto.height ?? 0) > limiteY;
  scene.spawnAreasRoboBola?.destruir();
  scene.iluminacaoEmergencia?.desligarGiroflex();
  // A origem é fixa: perseguir o jogador até a arena não transforma um robô externo
  // em participante do encontro. Os invocados pelo boss continuam na luta.
  const nasceuNaArena = inimigo => {
    const origem = inimigo.origemSpawn ?? inimigo.patrolCenter ?? inimigo;
    return Boolean(inimigo.prologoEncontroId) || jogadorNaArenaNovoBoss(
      { active: true, x: origem.x, y: origem.y }, encontro.config.arena);
  };
  const anteriores = scene.inimigos ?? [];
  scene.inimigos = anteriores.filter(inimigo => !nasceuNaArena(inimigo));
  limparGrupoRobos(scene);
  scene.inimigos = anteriores.filter(nasceuNaArena);
  scene.inimigoTeste = scene.inimigos[0] ?? null;
  scene.leitorCartaoFabrica?.terminal?.close();
  scene.removerInteracaoGerador?.();
  scene.removerInteracaoGerador = null;
  for (const porta of entradas) porta.fecharParaBoss?.();
  scene.descarregarPortasFabrica?.(limiteY);
  scene.objetosMapaParte2 = (scene.objetosMapaParte2 ?? []).filter(objeto => {
    if (!fora(objeto)) return true;
    objeto.destroy();
    return false;
  });
  for (const obstaculo of [...(scene.collisionGroup?.getChildren() ?? [])]) {
    if (obstaculo.body?.top > limiteY) obstaculo.destroy();
  }
  for (const item of scene.itensColetaveis ?? []) {
    if (!fora(item)) continue;
    if (item.marker) scene.tweens.killTweensOf(item.marker);
    item.marker?.destroy();
    item.image.destroy();
  }
  scene.itensColetaveis = (scene.itensColetaveis ?? []).filter(item => !fora(item));
  for (const data of scene.map.layers ?? []) {
    const layer = data.tilemapLayer;
    if (!layer) continue;
    layer.forEachTile(tile => {
      if (tile && layer.tileToWorldY(tile.y) > limiteY) {
        layer.removeTileAt(tile.x, tile.y, true, false);
      }
    });
  }
  // A instância da cena contém agora somente os tiles necessários; libera o JSON original.
  scene.cache.tilemap.remove("mapaParte2");
  // Uma barreira permanente mantém o retorno fechado mesmo após a derrota do boss.
  if (entradas.length) {
    const esquerda = Math.min(...entradas.map(p => p.area.x));
    const direita = Math.max(...entradas.map(p => p.area.x + p.area.width));
    scene.collisionGroup.create((esquerda + direita) / 2, limiteY + 4)
      .setDisplaySize(direita - esquerda, 8).setVisible(false).refreshBody();
  }
}
