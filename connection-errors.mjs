// Only return known messages; upstream exceptions can contain URLs or credentials.
export function connectionError(error) {
  const name=error?.constructor?.name||error?.name;
  const reason=error?.reason;
  if(name==='InvalidResponseCompositeError')return {code:'room_lookup',message:'Não foi possível localizar a sala da live pelo @. Confira o usuário exato e se a live está pública. Código: room_lookup.'};
  if(name==='UserOfflineError')return {code:'offline',message:'Este canal está offline. Inicie uma live pública e conecte novamente.'};
  if(name==='InvalidUniqueIdError')return {code:'username',message:'O TikTok não reconheceu esse @. Confira o nome do canal.'};
  if(name==='ConnectTimeoutError'||error?.code==='ETIMEDOUT'||error?.code==='FOTOLAB_TIMEOUT')return {code:'timeout',message:'A conexão demorou demais. Aguarde um pouco e tente novamente.'};
  if(name==='SignatureRateLimitError'||reason==='Rate Limited')return {code:'provider_limit',message:'O serviço de conexão atingiu um limite. Aguarde antes de tentar novamente ou configure a chave do provedor no servidor.'};
  if(name==='PremiumFeatureError'||reason==='Premium Feature')return {code:'provider_access',message:'A Euler Stream recusou acesso a esta conexão. A chave configurada pode não ter permissão para este recurso. Código: provider_access.'};
  if(name==='SignatureMissingTokensError')return {code:'provider_signature',message:'A Euler Stream não retornou os dados de assinatura necessários. Código: provider_signature.'};
  if(name==='AuthenticatedWebSocketConnectionError'||reason==='Authenticated WS')return {code:'provider_auth',message:'O conector solicitou autenticação de sessão não configurada. Código: provider_auth.'};
  if(['ENOTFOUND','ECONNREFUSED','ECONNRESET'].includes(error?.code))return {code:'network',message:'Não foi possível alcançar o TikTok ou o provedor. Verifique a conexão de internet do servidor.'};
  if(name==='SignAPIError'||reason)return {code:'provider',message:'O serviço que prepara a conexão recusou a solicitação. Verifique a configuração Euler Stream no servidor.'};
  return {code:'connection_failed',message:'Não foi possível conectar. Confirme o @, se a live está pública e ao vivo e a disponibilidade do provedor.'};
}

// Log only fixed categories, never upstream text, URLs, headers or credentials.
export function safeDiagnostic(error,depth=0) {
  const classes=['Error','TypeError','RangeError','InvalidResponseError','InvalidResponseCompositeError','InvalidRequestError','SignAPIError','PremiumFeatureError','SignatureMissingTokensError','UserOfflineError','ConnectTimeoutError','SignatureRateLimitError','AuthenticatedWebSocketConnectionError'];
  const name=error?.constructor?.name||error?.name;
  const message=String(error?.message||'');
  return {
    type:classes.includes(name)?name:'OtherError',
    category:connectionError(error).code,
    httpStatus: /(?:status(?: code)?|response:)\s*(?:=|:)?\s*(400|401|402|403|404|429|500|502|503)/i.exec(message)?.[1]||null,
    socket: /websocket/i.test(message),
    emptyRoom: /room.?id|room info/i.test(message),
    invalidRepeat: /Invalid count value/i.test(message),
    missingTrim: /trim/i.test(message),
    permissionDenied: /lack of permission|forbidden|unauthorized/i.test(message),
    offline: /offline|not live|not online/i.test(message),
    sources: depth<1&&Array.isArray(error?.config?.requestErrs)?error.config.requestErrs.slice(0,3).map(e=>safeDiagnostic(e,depth+1)):undefined
  };
}
