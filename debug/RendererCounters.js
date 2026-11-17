/** Contadores opt-in; não executa consultas síncronas à GPU por quadro. */
export function installRendererCounters(game) {
  const gl = game.renderer?.gl;
  if (!gl) throw new Error("WebGL indisponível");
  const totals = {}, restore = [];
  let stopped = false;
  for (const key of ["drawArrays", "drawElements", "drawArraysInstanced", "drawElementsInstanced",
    "useProgram", "bindTexture", "bindFramebuffer", "activeTexture", "blendFunc", "blendFuncSeparate",
    "viewport", "clear", "texImage2D", "texSubImage2D"]) {
    if (typeof gl[key] !== "function") continue;
    const descriptor = Object.getOwnPropertyDescriptor(gl, key), original = gl[key];
    function counted(...args) {
      totals[key] = (totals[key] || 0) + 1;
      if (key.startsWith("draw")) {
        totals.drawCalls = (totals.drawCalls || 0) + 1;
        const indexed = key.includes("Elements"), count = args[indexed ? 1 : 2];
        const instances = key.endsWith("Instanced") ? args[indexed ? 4 : 3] : 1;
        if (args[0] === gl.TRIANGLES) totals.submittedTriangles = (totals.submittedTriangles || 0) + count * instances / 3;
      }
      return original.apply(this, args);
    }
    gl[key] = counted;
    restore.push(() => {
      if (gl[key] !== counted) return;
      if (descriptor) Object.defineProperty(gl, key, descriptor); else delete gl[key];
    });
  }
  return {
    reset() { for (const key of Object.keys(totals)) delete totals[key]; },
    snapshot() { return { ...totals }; },
    stop() { if (stopped) return; stopped = true; for (const undo of restore.reverse()) undo(); },
  };
}
