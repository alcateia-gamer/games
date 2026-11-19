import {EventEmitter} from 'node:events';
export function lightingFixture(t,{powered=false,registry=new Map(),map=null}={}) {
 const previous={Phaser:globalThis.Phaser,document:globalThis.document};
 const metrics={uploads:0,canvases:[],queries:[],clips:0};
 const context=()=>new Proxy({createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),
  createRadialGradient:()=>({addColorStop(){}}),clip(){metrics.clips++;}}, {get(o,k){return k in o?o[k]:(...args)=>{};}});
 const canvas=()=>{const c={width:0,height:0},ctx=context();c.getContext=()=>ctx;metrics.canvases.push(c);return c;};
 globalThis.document={createElement:canvas};
 globalThis.Phaser={Textures:{FilterMode:{LINEAR:0}},Renderer:{Events:{RENDER:'render'}},Scenes:{Events:{SHUTDOWN:'shutdown'}}};
 t.after(()=>Object.assign(globalThis,previous));registry.events ||= new EventEmitter();
 const texture={getContext:()=>ctx,setFilter(){},setSize(){},refresh(){metrics.uploads++;}};const ctx=context();
 const overlay=new Proxy({depth:50},{get(o,k){return k in o?o[k]:(...a)=>{if(k==='setDepth')o.depth=a[0];return overlay;};}});
 const scene={game:{registry,renderer:new EventEmitter()},registry,events:new EventEmitter(),time:{now:0},luzFabricaAcesa:powered,
  map:map ?? {getObjectLayer(name){metrics.queries.push(name);return {objects:name==='collision'?[{x:200,y:0,width:5,height:300}]:[]};}},
  cameras:{main:{width:800,height:450,scrollX:0,scrollY:0,matrix:{a:1,b:0,c:0,d:1,e:0,f:0}}},
  textures:{createCanvas:()=>texture,remove(){}},add:{image:()=>overlay,rectangle:()=>overlay},
  player:{active:true,x:100,y:100,body:{velocity:{x:0,y:0}}}};
 return {scene,metrics,render:()=>scene.game.renderer.emit('render',scene,scene.cameras.main)};
}
