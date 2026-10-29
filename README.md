# Goku Live

Fan game interativo com Goku flutuando em Namek. Usa a mesma base de conexão do FotoLab: servidor Node, TikTok-Live-Connector 2.5.0, eventos SSE por sessão, deduplicação de presentes e publicação GitHub → Render.

## Executar

Node.js 22 ou superior: `npm ci`, `npm test`, `npm start`. Abra http://127.0.0.1:3210. No Windows use `Iniciar Goku Live.cmd`.

## Usar na live

1. Abra o jogo pelo link publicado e inicie sua live pública no TikTok.
2. Informe seu @ e clique em Conectar live.
3. Clique em Ativar som e voz. Selecione uma voz em português disponível no aparelho.
4. Use Modo transmissão ou `?overlay=1` para captura vertical. O botão Sair volta aos controles.
5. Capture o navegador e seu áudio no software de transmissão, como no FotoLab. O jogo recebe eventos; ele não transmite vídeo por conta própria.

Entradas recebem boas-vindas usando `user.uniqueId`, o @ que a plataforma entrega. Esse identificador é preferido ao apelido; não é o nome civil. Comentários podem receber respostas por IA com histórico separado por usuário quando o serviço estiver configurado e desbloqueado. Sem configuração, o modo básico continua com respostas locais. Veja CONFIGURAR-IA-E-VOZ.md para ativação, serviços necessários, limites e estado da voz enviada.

## Presentes

Rosa/coração → God vermelho; estrela/leão → Super Saiyajin dourado; gelo/azul → Blue; galáxia/universo → Instinto Superior prata. Presentes desconhecidos usam o valor unitário como alternativa. A plataforma não entrega uma cor padronizada: configure o ID ou nome exato no painel quando necessário. Regras ficam salvas neste navegador.

Cada evento final de presente entra na fila, mesmo que seja igual ao anterior. Combo é consolidado ao terminar e agradecido com sua quantidade; não dispara uma animação por atualização parcial. A transformação dura 6,5 segundos e então segue para o próximo presente ou volta à base. Fila visual limitada a 100 e fila de fala a 40 para evitar crescimento sem limite em picos.

## Áudio e artes

Trilha instrumental original sintetizada no navegador, sem gravação ou melodia oficial de Dragon Ball. É possível selecionar um arquivo de música local no painel. A voz pode ser a síntese do aparelho ou uma voz autorizada via ElevenLabs, quando configurada no servidor e desbloqueada no painel. O navegador exige um clique para ativar áudio. A música abaixa durante as falas e a fila evita vozes sobrepostas.

Artes criadas com Imagegen integrado. Prompts e arquivos descritos em `ARTES.md`. As cinco formas possuem sprites próprios, aura, partículas e efeito de transformação. As animações respeitam a preferência de movimento reduzido.

## Hospedagem

Configuração do Render em `render.yaml`: build `npm ci --no-audit --no-fund && npm test`, start `npm start`, health `/healthz`. Render fornece `RENDER_EXTERNAL_URL`; em outro provedor configure `PUBLIC_URL` com a origem HTTPS do jogo. Se necessário, configure `EULER_API_KEY` no ambiente do servidor, nunca no código ou navegador. Conexão é por biblioteca não oficial, dependente do TikTok e do provedor de assinatura. Reinícios exigem reconexão; hospedagem gratuita pode adormecer.

Testes automatizados usam um conector simulado; uma live ativa ainda é necessária para validar entrada, comentário e presente reais. Não é necessário comprar presentes para testar a demonstração.

## Som de aura enviado

O arquivo `dist/saiyan-aura.mp3` foi fornecido pelo usuário e toca em loop enquanto qualquer transformação está ativa. Para ao voltar à forma base, ao desconectar ou ao desligar o áudio. Tem volume próprio e abaixa durante as falas. Ative o som com um clique no navegador.
