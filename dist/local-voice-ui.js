export function setupLocalVoice(audio){
 const $=id=>document.getElementById(id),base='http://127.0.0.1:3214';let paused=false,busy=false,retry;
 const message=text=>$('local-voice-status').textContent=text;
 async function connect(){if(busy||paused)return;busy=true;clearTimeout(retry);$('local-voice-prepare').disabled=true;
  try{const response=await fetch(base+'/health',{targetAddressSpace:'loopback',credentials:'omit',signal:AbortSignal.timeout(15000)});if(!response.ok)throw new Error('Serviço local indisponível.');const info=await response.json();
   if(info.locale!=='pt-BR'||info.model!=='Chatterbox pt-BR')throw new Error('O serviço encontrado não é o motor brasileiro.');
   if(!info.ready)throw new Error(info.message||'Preparando motor brasileiro…');
   audio.setLocalVoice(async(text,signal)=>{message('Gerando a voz do amigo em português do Brasil…');const start=performance.now();const timeout=AbortSignal.timeout(180000);const response=await fetch(base+'/speech',{method:'POST',targetAddressSpace:'loopback',credentials:'omit',headers:{'Content-Type':'application/json'},body:JSON.stringify({text}),signal:AbortSignal.any([signal,timeout].filter(Boolean))});if(!response.ok){let error;try{error=await response.json()}catch{}throw new Error(error?.error||'Falha no motor brasileiro.')}const blob=await response.blob();if(!blob.type.startsWith('audio/'))throw new Error('O serviço não retornou áudio.');message('Português do Brasil ativo · última geração: '+((performance.now()-start)/1000).toFixed(1)+' s.');return blob});
   $('local-voice-test').disabled=false;$('local-voice-release').disabled=false;message('Voz do amigo pronta · português do Brasil · processamento neste computador.');
  }catch(error){audio.setLocalVoice(null);$('local-voice-test').disabled=true;message(error.name==='TypeError'||error.name==='TimeoutError'?'Verifique se INICIAR-VOZ-BRASILEIRA está aberto e permita o acesso a aplicativos neste computador no navegador. Clique em Conectar voz brasileira para tentar novamente.':error.message);if(!paused&&error.name!=='TypeError'&&error.name!=='TimeoutError')retry=setTimeout(connect,5000)}finally{busy=false;$('local-voice-prepare').disabled=false}
 }
 $('local-voice-prepare').onclick=()=>{paused=false;connect()};
 $('local-voice-test').onclick=()=>{audio.say('Oi, João! Tudo bem com você? Seja bem-vindo à nossa live!');message('Teste da voz brasileira na fila. Ative o som para ouvir.')};
 $('local-voice-release').onclick=()=>{paused=true;clearTimeout(retry);audio.clear();audio.setLocalVoice(null);$('local-voice-test').disabled=true;$('local-voice-release').disabled=true;message('Voz desconectada desta página. Clique em Conectar voz brasileira para retomar.')};
 async function boot(){
  let permission;
  for(const name of ['loopback-network','local-network-access']){try{permission=await navigator.permissions.query({name});break}catch{}}
  if(permission?.state==='granted'){connect();return}
  if(permission?.state==='denied'){message('O navegador bloqueou o acesso ao motor local. Nas permissões deste site, permita o acesso a aplicativos neste computador e clique em Conectar voz brasileira.');return}
  message('Abra INICIAR-VOZ-BRASILEIRA e clique em Conectar voz brasileira para autorizar o acesso ao motor neste computador.');
 }
 boot();
}
