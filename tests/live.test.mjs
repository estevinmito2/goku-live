import {test} from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {once} from 'node:events';
import {request} from 'node:http';
import {username,normalize,tierFor} from '../live-events.mjs';
import {createGameServer} from '../server.mjs';
import {connectionError} from '../connection-errors.mjs';

test('usuários válidos e faixas de moldura nas fronteiras',()=>{
  assert.equal(username(' @amigo_01 '),'amigo_01');
  assert.throws(()=>username('https://tiktok.com/@alguem'));
  for(const [value,tier] of [[0,'bloom'],[9,'bloom'],[10,'neon'],[99,'neon'],[100,'royal'],[500,'cosmic'],[1000,'phoenix'],[5000,'imperial'],[10000,'celestial']])assert.equal(tierFor(value),tier);
});
test('foto real, combo final e valor unitário do presente',()=>{
  const gift={user:{uniqueId:'amigo',avatarThumb:{urlList:['https://example.com/foto.jpg']}},giftId:10,giftDetails:{giftType:1,giftName:'Flor',diamondCount:1},repeatCount:50,repeatEnd:false};
  assert.equal(normalize('gift',gift),null);
  const event=normalize('gift',{...gift,repeatEnd:true});
  assert.equal(event.tier,'bloom');assert.equal(event.repeat,50);assert.equal(event.avatar,'https://example.com/foto.jpg');assert.equal(event.name,'amigo');
  assert.equal(normalize('comment',{profilePictureUrl:'javascript:bad'}).avatar,null);
});
test('sessões isoladas, eventos reais, deduplicação e desconexão',async()=>{
  const connections=[];
  class Fake extends EventEmitter{constructor(name){super();this.name=name;connections.push(this)}async connect(){return{roomId:'123'}}async disconnect(){this.stopped=true}}
  const server=createGameServer(name=>new Fake(name));server.listen(0,'127.0.0.1');await once(server,'listening');
  const root='http://127.0.0.1:'+server.address().port;
  const post=async(path,body={},id)=>{const res=await fetch(root+'/api/'+path,{method:'POST',headers:{'Content-Type':'application/json',...(id?{'X-Session-Id':id}:{})},body:JSON.stringify(body)});return{status:res.status,data:await res.json()}};
  const controllers=[];
  try{
    assert.equal((await fetch(root)).status,200);
    const a=(await post('session')).data.id,b=(await post('session')).data.id;
    async function listen(id){const controller=new AbortController();controllers.push(controller);const res=await fetch(root+'/api/events?session='+id,{signal:controller.signal});let text='';const read=(async()=>{try{for await(const chunk of res.body)text+=new TextDecoder().decode(chunk)}catch{}})();return()=>text}
    const first=await listen(a),second=await listen(b);
    assert.equal((await post('connect',{username:'canal_a'},a)).status,200);
    assert.equal((await post('connect',{username:'canal_b'},b)).status,200);
    const payload={common:{msgId:'one'},user:{uniqueId:'pessoa'},comment:'teste'};
    connections[0].emit('chat',payload);connections[0].emit('chat',payload);
    connections[1].emit('gift',{common:{msgId:'two'},user:{uniqueId:'outra'},giftDetails:{diamondCount:1000,giftName:'Presente'},giftId:9});
    for(const [event,data] of [['like',{likeCount:50,totalLikeCount:500}],['member',{}],['follow',{}],['share',{}],['roomUser',{viewerCount:123}]])connections[0].emit(event,{...data,user:{uniqueId:'participante'}});
    const combo={user:{uniqueId:'combo_user'},giftId:'55',gift:{type:1,name:'Rosa',diamondCount:1},groupId:'combo-1',repeatCount:1};
    connections[1].emit('gift',{...combo,common:{msgId:'start'},repeatEnd:0});
    connections[1].emit('gift',{...combo,common:{msgId:'finish'},repeatEnd:1});
    connections[1].emit('gift',{...combo,common:{msgId:'duplicate-finish'},repeatEnd:1});
    connections[1].emit('gift',{...combo,groupId:'combo-2',common:{msgId:'next-gift'},repeatEnd:1});
    await new Promise(r=>setTimeout(r,70));
    assert.equal((second().match(/"giftName":"Rosa"/g)||[]).length,2);

    assert.equal((first().match(/"comment":"teste"/g)||[]).length,1);
    assert(!second().includes('"comment":"teste"'));assert(second().includes('"tier":"phoenix"'));assert(!first().includes('"tier":"phoenix"'));
    for(const type of ['like','join','follow','share','viewers']){assert(first().includes('"type":"'+type+'"'));assert(!second().includes('"type":"'+type+'"'))}
    assert(first().includes('"total":500'));assert(first().includes('"count":123'));
    assert.equal((await post('disconnect',{},a)).status,200);assert.equal(connections[0].stopped,true);assert(!connections[1].stopped);
    const unauthorized=await post('disconnect');assert.equal(unauthorized.status,401);
    const cross=await fetch(root+'/api/session',{method:'POST',headers:{Origin:'https://other.example'}});assert.equal(cross.status,403);
  }finally{for(const c of controllers)c.abort();server.closeAllConnections();await new Promise(r=>server.close(r))}
});
test('diagnóstico não expõe mensagens ou credenciais do provedor',()=>{
  class UserOfflineError extends Error{}
  class SignatureRateLimitError extends Error{}
  assert.equal(connectionError(new UserOfflineError()).code,'offline');
  assert.equal(connectionError(new SignatureRateLimitError()).code,'provider_limit');
  const result=connectionError(new Error('secret-token=example'));
  assert.equal(result.code,'connection_failed');assert(!JSON.stringify(result).includes('secret-token'));
});
test('hospedagem aceita somente domínio configurado e origem correspondente',async()=>{
  const server=createGameServer(undefined,{publicUrl:'https://fotolab.example'});server.listen(0,'127.0.0.1');await once(server,'listening');
  const root='http://127.0.0.1:'+server.address().port;
  const send=(path,headers,method='GET')=>new Promise((resolve,reject)=>{const req=request(root+path,{method,headers},res=>{res.resume();res.on('end',()=>resolve(res.statusCode))});req.on('error',reject);req.end()});
  try{
    assert.equal(await send('/healthz',{Host:'fotolab.example'}),200);
    assert.equal(await send('/healthz',{Host:'untrusted.example'}),403);
    assert.equal(await send('/api/session',{Host:'fotolab.example',Origin:'https://fotolab.example'},'POST'),200);
    assert.equal(await send('/api/session',{Host:'fotolab.example',Origin:'https://other.example'},'POST'),403);
  }finally{server.closeAllConnections();await new Promise(r=>server.close(r))}
});
test('timeout encerra também uma conexão que termina de abrir depois',async()=>{
  let resolveConnect,disconnects=0;
  class Late extends EventEmitter{connect(){return new Promise(resolve=>resolveConnect=resolve)}async disconnect(){disconnects++}}
  const server=createGameServer(()=>new Late(),{connectTimeout:40});server.listen(0,'127.0.0.1');await once(server,'listening');
  const root='http://127.0.0.1:'+server.address().port;
  try{
    const {id}=await (await fetch(root+'/api/session',{method:'POST'})).json();
    const res=await fetch(root+'/api/connect',{method:'POST',headers:{'X-Session-Id':id,'Content-Type':'application/json'},body:JSON.stringify({username:'canal_teste'})});
    assert.equal(res.status,502);assert.equal((await res.json()).code,'timeout');assert.equal(disconnects,1);
    resolveConnect({roomId:'late'});await new Promise(r=>setTimeout(r,15));assert.equal(disconnects,2);
  }finally{server.closeAllConnections();await new Promise(r=>server.close(r))}
});


test('prioriza foto grande e média, ignorando URLs inválidas',()=>{
  const user={avatarLarge:{urlList:['http://invalid','https://example.com/large.jpg']},avatarMedium:{urlList:['https://example.com/medium.jpg']},avatarThumb:{urlList:['https://example.com/thumb.jpg']}};
  assert.equal(normalize('comment',{user}).avatar,'https://example.com/large.jpg');
  delete user.avatarLarge;
  assert.equal(normalize('comment',{user}).avatar,'https://example.com/medium.jpg');
  delete user.avatarMedium;
  assert.equal(normalize('comment',{user}).avatar,'https://example.com/thumb.jpg');
});


test('curtidas v3 usam count e total e preservam formato antigo',()=>{
  const current=normalize('like',{count:50,total:'12345'});
  assert.equal(current.count,50);assert.equal(current.total,12345);
  const legacy=normalize('like',{likeCount:7,totalLikeCount:100});
  assert.equal(legacy.count,7);assert.equal(legacy.total,100);
  assert.equal(normalize('like',{count:0,likeCount:9}).count,0);
  assert.equal(normalize('like',{count:-2,total:'invalid'}).count,0);
});


test('presente v3 aguarda combo final e mantém nome, valor e identidade',()=>{
  const gift={user:{uniqueId:'ana'},giftId:'1',gift:{type:1,name:'Rosa',diamondCount:100},groupId:'g1',repeatCount:3,repeatEnd:0};
  assert.equal(normalize('gift',gift),null);
  const final=normalize('gift',{...gift,repeatEnd:1});
  assert.equal(final.giftName,'Rosa');assert.equal(final.tier,'royal');assert.equal(final.repeat,3);
  assert.equal(final.deliveryId,normalize('gift',{...gift,repeatEnd:1,msgId:'new-message'}).deliveryId);
  assert.notEqual(final.deliveryId,normalize('gift',{...gift,repeatEnd:1,groupId:'g2'}).deliveryId);
  assert.ok(normalize('gift',{...gift,gift:{type:2,name:'Leão',diamondCount:1000},repeatEnd:0}));
});

test('espectadores v3 usam total, sem confundir com total acumulado',()=>{assert.equal(normalize('viewers',{total:'12',totalUser:'300'}).count,12)});
