import {test} from 'node:test';
import assert from 'node:assert/strict';
import {setupLocalVoice} from '../dist/local-voice-ui.js';
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function fixture(locale='pt-BR'){
 const previous={document:globalThis.document,fetch:globalThis.fetch};const elements=new Map();const el=id=>{if(!elements.has(id))elements.set(id,{disabled:false,textContent:''});return elements.get(id)};const requests=[];let generator;
 globalThis.document={getElementById:el};globalThis.fetch=async(url,options)=>{requests.push({url,options});return url.endsWith('/health')?Response.json({ready:true,locale,model:'Chatterbox pt-BR'}):new Response(new Blob(['wav'],{type:'audio/wav'}))};
 setupLocalVoice({setLocalVoice:value=>{generator=value},clear(){},say(){}});
 return {el,requests,get generator(){return generator},restore(){el('local-voice-release').onclick();globalThis.document=previous.document;globalThis.fetch=previous.fetch}};
}
test('motor brasileiro envia o texto intacto somente ao serviço deste computador',async()=>{const f=fixture();try{await tick();f.el('local-voice-prepare').onclick();await tick();assert.equal(typeof f.generator,'function');const blob=await f.generator('Olá, João! Tudo bem?',new AbortController().signal);assert.equal(blob.type,'audio/wav');assert.equal(f.requests[1].url,'http://127.0.0.1:3214/speech');assert.deepEqual(JSON.parse(f.requests[1].options.body),{text:'Olá, João! Tudo bem?'});f.el('local-voice-release').onclick();assert.equal(f.generator,null)}finally{f.restore()}});
test('não aceita motor de Portugal como se fosse brasileiro',async()=>{const f=fixture('pt-PT');try{await tick();f.el('local-voice-prepare').onclick();await tick();assert.equal(f.generator,null);assert.match(f.el('local-voice-status').textContent,/não é o motor brasileiro/);assert.equal(f.el('local-voice-test').disabled,true)}finally{f.restore()}});
