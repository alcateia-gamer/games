/** Coleta manual para DevTools, inclusive no Android real. Sem importação na partida normal. */
const active = new WeakSet();
export async function capturePerformance({ label="sample", revision="unspecified", seconds=60, rendererCounters=false }={}) {
  const probe=window.nullbornsPerformance;
  if(!probe)throw new Error("Abra o jogo com ?perf=1 antes de coletar.");
  if(!Number.isFinite(seconds)||seconds<5||seconds>600)throw new RangeError("seconds deve estar entre 5 e 600");
  if(active.has(probe))throw new Error("Já existe uma coleta em andamento.");
  active.add(probe);
  let visibilityChanges=0;
  const changed=()=>{visibilityChanges++;};
  const viewport=()=>({width:innerWidth,height:innerHeight,dpr:devicePixelRatio,visible:document.visibilityState});
  const before=viewport();let start;
  document.addEventListener("visibilitychange",changed);
  try{
    if(rendererCounters)await probe.enableRendererCounters();
    probe.reset();
    start=performance.now();
    await new Promise(resolve=>setTimeout(resolve,seconds*1000));
    return {label,revision,requestedSeconds:seconds,elapsedMs:performance.now()-start,
      userAgent:navigator.userAgent,before,after:viewport(),visibilityChanges,
      heap:performance.memory?{used:performance.memory.usedJSHeapSize,total:performance.memory.totalJSHeapSize}:null,
      ...probe.snapshot()};
  }finally{document.removeEventListener("visibilitychange",changed);active.delete(probe);}
}
