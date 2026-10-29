import http from 'node:http';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {TikTokLiveConnection,WebcastEvent,ControlEvent} from 'tiktok-live-connector';
import {username,normalize,giftRules} from './live-events.mjs';
import {connectionError,safeDiagnostic} from './connection-errors.mjs';

export function createGameServer(factory=name=>new TikTokLiveConnection(name,{
  // Gift events already carry giftDetails; avoid the optional signed gift catalog.
  processInitialData:false,enableExtendedGiftInfo:false,
  ...(process.env.EULER_API_KEY?{signApiKey:process.env.EULER_API_KEY.trim()}:{}),
  webClientOptions:{timeout:{request:12000}},wsClientOptions:{handshakeTimeout:12000}
}),config={}) {
  const publicUrl=config.publicUrl||process.env.PUBLIC_URL||process.env.RENDER_EXTERNAL_URL;
  const publicOrigin=publicUrl?new URL(publicUrl).origin:null;
  const connectTimeout=config.connectTimeout||35000;
  const sessions=new Map();
  const send=(s,type,payload)=>{const chunk=`event: ${type}\ndata: ${JSON.stringify(payload)}\n\n`;for(const client of s.clients){if(client.writableLength>262144){client.destroy();s.clients.delete(client)}else client.write(chunk)}};
  const state=(s,status,message)=>{s.status=status;s.message=message;send(s,'status',{status,message,username:s.username})};
  const stop=async s=>{const conn=s.conn;s.conn=null;if(conn)await conn.disconnect().catch(()=>{})};
  const json=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data))};
  const files={'/namek.png':'namek.png','/goku-forms.png':'goku-forms.png','/game.mjs':'game.mjs','/':'index.html','/index.html':'index.html','/style.css':'style.css','/live.css':'live.css','/audio.js':'audio.js','/app.js':'app.js','/connection.js':'connection.js'};
  const server=http.createServer(async(req,res)=>{
    try{
      const host=req.headers.host||'';
      const local=/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host);
      if(!local&&(!publicOrigin||host!==new URL(publicOrigin).host)){json(res,403,{error:'Endereço não autorizado.'});return}
      const origin=local?`http://${host}`:publicOrigin;
      if(req.headers.origin&&req.headers.origin!==origin){json(res,403,{error:'Origem inválida.'});return}
      const url=new URL(req.url,`http://${host}`);
      if(req.method==='GET'&&url.pathname==='/healthz'){json(res,200,{ok:true});return}
      if(req.method==='POST'&&url.pathname==='/api/session'){
        if(sessions.size>=20){json(res,429,{error:'Muitas sessões abertas. Feche as sessões antigas.'});return}
        const id=randomUUID();sessions.set(id,{clients:new Set(),conn:null,status:'disconnected',message:'Pronto para conectar.',username:'',seen:new Set(),updated:Date.now(),lastAttempt:0});json(res,200,{id});return;
      }
      if(url.pathname.startsWith('/api/')){
        const s=sessions.get(req.headers['x-session-id']||url.searchParams.get('session'));
        if(!s){json(res,401,{error:'Sessão expirada. Atualize a página.'});return}s.updated=Date.now();
        if(url.pathname==='/api/events'&&req.method==='GET'){
          if(s.clients.size>=3){json(res,429,{error:'Muitas conexões.'});return}
          res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-cache','Connection':'keep-alive','X-Accel-Buffering':'no'});res.write(': connected\n\n');s.clients.add(res);
          res.write(`event: status\ndata: ${JSON.stringify({status:s.status,message:s.message,username:s.username})}\n\n`);
          const ping=setInterval(()=>{res.write(': ping\n\n');s.updated=Date.now()},15000);
          req.on('close',()=>{clearInterval(ping);s.clients.delete(res);if(!s.clients.size){const conn=s.conn;setTimeout(()=>{if(!s.clients.size&&s.conn===conn){stop(s);state(s,'disconnected','Página fechada. Conecte novamente.')}},15000).unref()}});return;
        }
        if(url.pathname==='/api/disconnect'&&req.method==='POST'){await stop(s);state(s,'disconnected','Desconectado.');json(res,200,{ok:true});return}
        if(url.pathname==='/api/connect'&&req.method==='POST'){
          if(s.status==='connecting'){json(res,409,{error:'Aguarde a conexão atual.'});return}
          if(Date.now()-s.lastAttempt<5000){json(res,429,{error:'Aguarde alguns segundos antes de tentar novamente.'});return}
          let body='';for await(const part of req){body+=part;if(body.length>1024){json(res,413,{error:'Pedido muito grande.'});return}}
          let name;try{name=username(JSON.parse(body).username)}catch{json(res,400,{error:'Digite um @ válido, sem o link.'});return}
          s.lastAttempt=Date.now();await stop(s);s.username=name;s.seen.clear();state(s,'connecting','Buscando a live de @'+name+'…');
          let conn;
          try{conn=factory(name)}catch(error){const failure=connectionError(error);state(s,'error',failure.message);json(res,502,{error:failure.message,code:failure.code});return}
          s.conn=conn;
          const publish=(type,data)=>{if(s.conn!==conn||s.status!=='connected')return;const event=normalize(type,data);if(!event)return;
            const delivery=event.type==='gift'?event.deliveryId:event.id;
            if(delivery){const key=type+':'+delivery;if(s.seen.has(key))return;s.seen.add(key);if(s.seen.size>2000)s.seen.delete(s.seen.values().next().value)}send(s,'live',event)};
          const bindings=[[WebcastEvent.CHAT,'comment'],[WebcastEvent.GIFT,'gift'],[WebcastEvent.LIKE,'like'],[WebcastEvent.MEMBER,'join'],[WebcastEvent.FOLLOW,'follow'],[WebcastEvent.SHARE,'share'],[WebcastEvent.ROOM_USER,'viewers']];
          for(const [event,type] of bindings)conn.on(event,data=>publish(type,data));
          conn.on(ControlEvent.ERROR,()=>{if(s.conn===conn)send(s,'notice',{message:'O conector informou uma falha. Se os eventos pararem, desconecte e tente novamente.'})});
          conn.on(ControlEvent.DISCONNECTED,()=>{if(s.conn===conn){s.conn=null;state(s,'disconnected','Conexão encerrada. Verifique a live e reconecte.')}});
          conn.on(WebcastEvent.STREAM_END,()=>{if(s.conn===conn){stop(s);state(s,'ended','A live terminou.')}});
          let timeout;
          try{
            // A late success after timeout/cancellation must not leave an orphan connection.
            const attempt=Promise.resolve().then(()=>conn.connect());
            attempt.then(()=>{if(s.conn!==conn)conn.disconnect().catch(()=>{})},()=>{});
            await Promise.race([attempt,new Promise((_,reject)=>{timeout=setTimeout(()=>reject(Object.assign(new Error('timeout'),{code:'FOTOLAB_TIMEOUT'})),connectTimeout)})]);
            if(s.conn!==conn){await conn.disconnect().catch(()=>{});json(res,409,{error:'Conexão cancelada.'});return}
            state(s,'connected','Conectado à live de @'+name);json(res,200,{ok:true,username:name,rules:giftRules});
          }catch(error){console.warn('Live connection diagnostic',JSON.stringify(safeDiagnostic(error)));const failure=connectionError(error);if(s.conn===conn){await stop(s);state(s,'error',failure.message)}json(res,502,{error:s.message,code:failure.code})}finally{clearTimeout(timeout)}return;
        }
        json(res,404,{error:'Rota não encontrada.'});return;
      }
      const file=files[url.pathname];if(req.method!=='GET'||!file){res.writeHead(404);res.end('Não encontrado');return}
      const ext=file.split('.').pop();const data=await readFile(new URL('./dist/'+file,import.meta.url));res.writeHead(200,{'Content-Type':{webmanifest:'application/manifest+json',html:'text/html; charset=utf-8',css:'text/css',js:'text/javascript',mjs:'text/javascript',png:'image/png'}[ext],'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'});res.end(data);
    }catch{if(!res.headersSent)json(res,500,{error:'Erro no servidor. Tente novamente.'});else res.end()}
  });
  const cleanup=setInterval(()=>{for(const [id,s]of sessions)if(!s.clients.size&&Date.now()-s.updated>30*60*1000){stop(s);sessions.delete(id)}},60000);cleanup.unref();
  server.on('close',()=>{clearInterval(cleanup);for(const s of sessions.values()){stop(s);for(const client of s.clients)client.end()}});
  return server;
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
  const port=Number(process.env.PORT)||3210;
  const hosted=Boolean(process.env.PUBLIC_URL||process.env.RENDER_EXTERNAL_URL);
  if(process.env.NODE_ENV==='production'&&!hosted)throw new Error('Configure PUBLIC_URL com a URL HTTPS do jogo antes de publicar.');
  const server=createGameServer();
  server.listen(port,hosted?'0.0.0.0':'127.0.0.1',()=>console.log(`Goku Live pronto: ${process.env.PUBLIC_URL||process.env.RENDER_EXTERNAL_URL||`http://127.0.0.1:${port}`}`));
  for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>{server.close();server.closeAllConnections();setTimeout(()=>process.exit(0),2000).unref()});
}
