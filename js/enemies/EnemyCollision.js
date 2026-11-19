/** Proteção varrida da física: cobre movimento, recuo e empurrões em frames longos. */
import { tempoImpactoFlecha } from "../player/ArrowCollision.js";
import { retanguloLivreDoMapa, obterFilhosGrupoSeguro } from "./EnemyPathfinding.js";

function obstaculos(scene, inicio, fim, width, height) {
  const grupo = scene.collisionGroup, arvore = scene.physics?.world?.staticTree;
  if (arvore && grupo?.contains) return arvore.search({
    minX: Math.min(inicio.x, fim.x) - 1, minY: Math.min(inicio.y, fim.y) - 1,
    maxX: Math.max(inicio.x, fim.x) + width + 1, maxY: Math.max(inicio.y, fim.y) + height + 1,
  }).filter(b => b.enable !== false && grupo.contains(b.gameObject));
  return obterFilhosGrupoSeguro(grupo).map(o => o.body).filter(b => b?.enable !== false);
}

export function limitarPassoInimigo(scene, robo, inicio, fim) {
  const { width, height } = robo.body;
  if (inicio.x === fim.x && inicio.y === fim.y) return { x: fim.x, y: fim.y };
  if (robo.playableArea) fim = robo.playableArea.limitarPasso(inicio, fim, width, height);
  const dx = fim.x - inicio.x, dy = fim.y - inicio.y;
  const distancia = Math.hypot(dx, dy);
  if (!distancia) return { ...fim };
  let limite = 1;
  const arena = robo.prologoEncontroId ? scene.novoBoss?.config.arena : null;
  if (arena) {
    for (const [origem, delta, min, max] of [[inicio.x, dx, arena.xMin, arena.xMax - width],
      [inicio.y, dy, arena.yMin, arena.yMax - height]]) {
      if (delta < 0) limite = Math.min(limite, (min - origem) / delta);
      if (delta > 0) limite = Math.min(limite, (max - origem) / delta);
    }
  }
  for (const b of obstaculos(scene, inicio, fim, width, height)) {
    if (!b || ![b.x, b.y, b.width, b.height].every(Number.isFinite)) continue;
    // Topo esquerdo do robô contra o obstáculo expandido pelas dimensões reais.
    const expandido = { x: b.x - width, y: b.y - height,
      width: b.width + width, height: b.height + height };
    // Arcade pode deixar o corpo exatamente na borda. Afastar-se não é nova colisão.
    if ((inicio.x <= expandido.x && dx <= 0) ||
        (inicio.x >= expandido.x + expandido.width && dx >= 0) ||
        (inicio.y <= expandido.y && dy <= 0) ||
        (inicio.y >= expandido.y + expandido.height && dy >= 0)) continue;
    const t = tempoImpactoFlecha(inicio, fim, { x: dx / distancia, y: dy / distancia }, expandido, 0, 0);
    if (t !== null) limite = Math.min(limite, Math.max(0, t - 0.02 / distancia));
  }
  limite = Math.max(0, Math.min(1, limite));
  return { x: inicio.x + dx * limite, y: inicio.y + dy * limite };
}

// Uma etapa por mundo: primeiro limita todos pelo cenário, depois considera o
// movimento relativo dos pares que já têm collider. Assim a ordem dos listeners
// não permite que um robô use a posição ainda não corrigida do vizinho.
const protecoes = new WeakMap();

function tempoContatoCorpos(a, b) {
  const inicio = a.inicio, outro = b.inicio;
  const dx = (a.fim.x - inicio.x) * a.limite - (b.fim.x - outro.x) * b.limite;
  const dy = (a.fim.y - inicio.y) * a.limite - (b.fim.y - outro.y) * b.limite;
  if (!dx && !dy) return null;
  const rect = { x: outro.x - inicio.width, y: outro.y - inicio.height,
    width: outro.width + inicio.width, height: outro.height + inicio.height };
  // Sobreposição inicial pertence à separação discreta já feita pelo Arcade.
  if (inicio.x > rect.x + 1e-7 && inicio.x < rect.x + rect.width - 1e-7 &&
      inicio.y > rect.y + 1e-7 && inicio.y < rect.y + rect.height - 1e-7) return null;
  if ((inicio.x <= rect.x + 1e-7 && dx <= 0) ||
      (inicio.x >= rect.x + rect.width - 1e-7 && dx >= 0) ||
      (inicio.y <= rect.y + 1e-7 && dy <= 0) ||
      (inicio.y >= rect.y + rect.height - 1e-7 && dy >= 0)) return null;
  const distancia = Math.hypot(dx, dy);
  const t = tempoImpactoFlecha(inicio, { x: inicio.x + dx, y: inicio.y + dy },
    { x: dx / distancia, y: dy / distancia }, rect, 0, 0);
  if (t === null) return null;
  const x = inicio.x + dx * t, y = inicio.y + dy * t;
  const bordaX = Math.min(Math.abs(x - rect.x), Math.abs(x - rect.x - rect.width));
  const bordaY = Math.min(Math.abs(y - rect.y), Math.abs(y - rect.y - rect.height));
  return { t: Math.max(0, t - 0.02 / distancia),
    nx: bordaX <= bordaY ? -Math.sign(dx) : 0,
    ny: bordaY < bordaX ? -Math.sign(dy) : 0 };

}

export function protegerColisaoInimigo(scene, robo) {
  const mundo = scene.physics?.world;
  if (!mundo?.on || robo.remoteOnly) return;
  let conjunto = protecoes.get(mundo);
  if (!conjunto) {
    conjunto = { estados: [], atualizar: null };
    conjunto.atualizar = () => {
      const estados = conjunto.estados;
      for (const estado of estados) estado.preparar();
      // Propaga somente reduções entre os pares, antes de escrever nos corpos.
      // Limite finito pelo número de robôs; não repete consultas ao mapa.
      for (let passe = 0; passe < estados.length; passe++) {
        let mudou = false;
        for (let i = 0; i < estados.length; i++) {
          const a = estados[i];
          if (!a.pronto) continue;
          const grupo = a.scene.enemySpawnManager?.enemyGroup;
          if (!grupo?.contains?.(a.robo)) continue;
          for (let j = i + 1; j < estados.length; j++) {
            const b = estados[j];
            if (!b.pronto || b.scene !== a.scene || !grupo.contains(b.robo)) continue;
            const contato = tempoContatoCorpos(a, b);
            if (!contato) continue;
            const { t, nx, ny } = contato;
            // Quem já se afasta do contato pode seguir; só bloqueia quem avança.
            const avancoA = (a.fim.x - a.inicio.x) * nx + (a.fim.y - a.inicio.y) * ny;
            const avancoB = (b.fim.x - b.inicio.x) * nx + (b.fim.y - b.inicio.y) * ny;
            if (avancoA < -1e-7 && a.limite * (1 - t) > 1e-7) {
              a.limite *= t; mudou = true;
            }
            if (avancoB > 1e-7 && b.limite * (1 - t) > 1e-7) {
              b.limite *= t; mudou = true;
            }
          }
        }
        if (!mudou) break;
      }
      for (const estado of estados) estado.aplicar();
    };
    protecoes.set(mundo, conjunto);
    mundo.on("worldstep", conjunto.atualizar);
  }
  if (conjunto.estados.some(estado => estado.robo === robo)) return;
  const validar = area => (!robo.playableArea || robo.playableArea.contem(area)) && retanguloLivreDoMapa(scene, area) && (!robo.prologoEncontroId || !scene.novoBoss ||
    (area.x >= scene.novoBoss.config.arena.xMin && area.y >= scene.novoBoss.config.arena.yMin &&
      area.x + area.width <= scene.novoBoss.config.arena.xMax &&
      area.y + area.height <= scene.novoBoss.config.arena.yMax));
  // Guarda o nascimento antes de preUpdate ou de qualquer collider alterar prev.
  let seguro = robo.body && validar(robo.body) ? { x: robo.body.x, y: robo.body.y } : null;
  const inicio = { x: 0, y: 0, width: 0, height: 0 };
  const estado = { scene, robo, inicio, fim: null, pronto: false, limite: 1,
    preparar() {
      const b = robo.body;
      this.pronto = false;
      if (!robo.active || robo.morto || robo.remoteOnly || !b || b.enable === false) return;
      const origem = seguro ?? b.prev;
      if (!origem) return;
      inicio.x = origem.x; inicio.y = origem.y; inicio.width = b.width; inicio.height = b.height;
      if (!validar(inicio)) return;
      this.fim = limitarPassoInimigo(scene, robo, inicio, b);
      if (!validar({ x: this.fim.x, y: this.fim.y, width: b.width, height: b.height })) this.fim = inicio;
      this.limite = 1;
      this.pronto = true;
    },
    aplicar() {
      if (!this.pronto) return;
      const b = robo.body;
      const x = inicio.x + (this.fim.x - inicio.x) * this.limite;
      const y = inicio.y + (this.fim.y - inicio.y) * this.limite;
      const bloqueouX = Math.abs(x - b.x) > 1e-7, bloqueouY = Math.abs(y - b.y) > 1e-7;
      if (bloqueouX || bloqueouY) {
        b.x = x; b.y = y; b.updateCenter?.();
        // O postUpdate do Arcade sincroniza o sprite usando o delta corrigido.
        b.setVelocity(bloqueouX ? 0 : b.velocity?.x ?? 0, bloqueouY ? 0 : b.velocity?.y ?? 0);
        robo.rotaAtual = []; robo.rotaInvalidada = true;
      }
      if (validar(b)) {
        seguro ??= { x: 0, y: 0 };
        seguro.x = b.x; seguro.y = b.y;
      }
    },
  };
  conjunto.estados.push(estado);
  let removido = false;
  const remover = () => {
    if (removido) return;
    removido = true;
    const indice = conjunto.estados.indexOf(estado);
    if (indice !== -1) conjunto.estados.splice(indice, 1);
    if (!conjunto.estados.length) {
      mundo.off("worldstep", conjunto.atualizar);
      protecoes.delete(mundo);
    }
    scene.events.off("shutdown", remover);
    robo.off("destroy", remover);
  };
  robo.once("destroy", remover);
  scene.events.once("shutdown", remover);
}
