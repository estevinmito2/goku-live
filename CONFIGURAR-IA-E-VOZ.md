# Ativar conversa por IA e voz personalizada

As integrações estão implementadas, mas as credenciais não estão incluídas. A chave Euler Stream do FotoLab serve somente para conectar o TikTok.

## 1. Inteligência

No Render, abra o serviço goku-live → Environment e adicione:

| Variável | Valor |
| --- | --- |
| OPENAI_API_KEY | Sua chave de projeto da API OpenAI |
| OPENAI_MODEL | gpt-4.1-mini, ou outro modelo compatível com Responses |
| AI_OPERATOR_TOKEN | Um código privado forte criado por você para desbloquear o painel |
| AI_DAILY_LIMIT | Opcional, quantidade máxima de pedidos por serviço/dia por instância; padrão 1000 |

As chaves ficam somente no servidor. Não envie as chaves no chat e não salve em arquivos públicos. O código do operador é digitado no jogo e vale por uma hora naquela sessão. O limite diário é contado na memória do processo e reinicia em um novo deploy; use também limites e alertas no provedor para controlar gastos. API de IA e voz têm cobrança própria.

## 2. Voz autorizada

Você confirmou autorização para gerar novas falas com a voz da referência. O arquivo enviado, universfield-watch-out-voice-352456.mp3, contém aproximadamente 1,08 segundo. Ele não é suficiente para preparar uma voz consistente. Forneça uma gravação maior da mesma voz, limpa, sem música e com uma pessoa falando. A ElevenLabs recomenda cerca de 1 a 2 minutos e documenta um mínimo de 10 segundos no total em seu fluxo de upload.

Crie a voz autorizada na ElevenLabs e obtenha seu ID. Depois adicione no Render:

| Variável | Valor |
| --- | --- |
| ELEVENLABS_API_KEY | Chave de API ElevenLabs |
| ELEVENLABS_VOICE_ID | ID da voz personalizada criada com a amostra autorizada |

O jogo envia o texto para a voz configurada; um MP3 de referência, sozinho, não fala novos nomes ou frases. A referência não foi publicada no GitHub nem enviada a um serviço de clonagem. A geração e sua qualidade ainda precisam ser verificadas com credenciais e uma amostra adequada.

## 3. Usar

Salve as variáveis com redeploy. Abra o jogo, use o código no painel Inteligência da live e clique em Desbloquear IA e voz. Ative o som. A opção Voz personalizada será escolhida automaticamente quando estiver disponível; pode ser trocada no seletor. Ela é usada para comentários, entradas, presentes e demais falas. Uma falha da voz personalizada é informada no painel e não troca silenciosamente para outra voz.

O modelo recebe cada comentário com histórico exclusivo daquele @ e daquela sessão, até seis pares de mensagens, por 30 minutos de inatividade. O contexto não é compartilhado entre pessoas nem salvo em banco. Limpar conversas apaga o histórico. Reabrir a página ou reiniciar o servidor inicia outra sessão.

As respostas são curtas, com até 420 caracteres, para evitar monólogos. Há filas e limites de uso; em picos, comentários além da capacidade são marcados como não respondidos. Não é garantido responder cada mensagem em uma live de alto volume. Não há navegação web ou consulta de notícias ao vivo. Enquanto a IA não estiver configurada e desbloqueada, o jogo identifica o modo básico no painel.

## Referências consultadas

- https://developers.openai.com/api/docs/guides/text
- https://developers.openai.com/api/docs/models/gpt-4.1-mini
- https://elevenlabs.io/docs/api-reference/text-to-speech/convert
- https://elevenlabs.io/docs/eleven-creative/voices/voice-cloning/instant-voice-cloning
