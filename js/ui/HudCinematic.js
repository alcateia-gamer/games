/** Oculta a interface fixa sem interferir nas atualizações dos botões ou na iluminação. */
export function ocultarHUDDuranteCena(scene, camera) {
  const objetos = new Map(), elementos = new Map();
  const filtroCamera = camera.id;
  let restaurado = false;

  function ocultarElemento(elemento) {
    if (!elemento?.style || elementos.has(elemento)) return;
    elementos.set(elemento, elemento.style.visibility ?? "");
    elemento.style.visibility = "hidden";
  }

  function atualizar() {
    if (restaurado) return;
    for (const objeto of scene.children?.list ?? []) {
      // A máscara de iluminação também é fixa, mas fica abaixo da interface (depth 50).
      if (objeto.scrollFactorX !== 0 || objeto.scrollFactorY !== 0 || !(objeto.depth >= 90)) continue;
      if (!objetos.has(objeto)) objetos.set(objeto, objeto.cameraFilter ?? 0);
      objeto.cameraFilter = (objeto.cameraFilter ?? 0) | filtroCamera;
      ocultarElemento(objeto.node);
    }
    // Vida/estamina usam um canvas HTML fora da lista de objetos do Phaser.
    ocultarElemento(scene.hudStatus?.elemento);
    ocultarElemento(scene.hudAliados?.elemento);
  }

  atualizar();
  scene.events?.on("prerender", atualizar);
  return {
    restaurar() {
      if (restaurado) return;
      restaurado = true;
      scene.events?.off("prerender", atualizar);
      for (const [objeto, original] of objetos) {
        objeto.cameraFilter = ((objeto.cameraFilter ?? 0) & ~filtroCamera) | (original & filtroCamera);
      }
      for (const [elemento, visibilidade] of elementos) elemento.style.visibility = visibilidade;
      objetos.clear(); elementos.clear();
    },
  };
}
