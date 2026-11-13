import test from 'node:test';
import assert from 'node:assert/strict';
import { HollowDialogueAudio } from './HollowDialogueAudio.js';
function fixture() {
  const created=[];
  const parameter={setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){}};
  const context={state:'running',currentTime:1,destination:{},
    createOscillator(){const node={frequency:parameter,connect(){},disconnect(){this.disconnected=true;},start(){},stop(time){this.stopAt=time;}};created.push(node);return node;},
    createGain(){return {gain:parameter,connect(){},disconnect(){}};}};
  const game={sound:{context,locked:false,volume:1}};
  return {audio:new HollowDialogueAudio(game),game,context,created};
}
test('bipes arcade curtos espaçados por palavra, com limpeza',()=>{
  const {audio,context,created}=fixture();audio.word();audio.word();
  assert.equal(created.length,2);assert.equal(created[0].type,'square');
  assert.equal(created[0].stopAt,1.036);
  context.currentTime+=0.1;audio.word();assert.equal(created.length,3);
  created[0].onended();assert.equal(audio.voices.size,2);
  audio.destroy();assert.equal(audio.voices.size,0);assert.ok(created[1].disconnected);
  audio.word();assert.equal(created.length,3);
});
test('respeita mute e bloqueio de áudio do navegador',()=>{
  const {audio,game,context,created}=fixture();
  game.sound.mute=true;audio.word();game.sound.mute=false;
  game.sound.locked=true;audio.word();game.sound.locked=false;
  context.state='suspended';audio.word();assert.equal(created.length,0);
  audio.destroy();
});
