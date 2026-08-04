# ADR 012 — Contexto e SSE escaláveis

## Contexto

O agente carregava todas as transações e todas as mensagens da conversa para cada
pergunta. O custo de memória, serialização e tokens crescia sem limite. O controle
de uma resposta ativa existia apenas no estado visual do frontend e a interrupção
do `fetch` não encerrava necessariamente a chamada ao provider.

## Decisão

O backend calcula o contexto financeiro com agregações e rankings SQL limitados.
Para inferência, mantém uma janela recente de mensagens e condensa
incrementalmente as mensagens anteriores em `agent_conversations.history_summary`.
O histórico público é paginado. Backend e AI Service aplicam um orçamento
aproximado de tokens antes da chamada ao provider.

Cada mensagem recebe um `clientMessageId`. A tabela `agent_message_requests`
persiste seu estado e permite reproduzir uma resposta já concluída sem duplicar
mensagens. `agent_conversations.active_request_id` fornece exclusão mútua entre
réplicas; locks abandonados expiram e podem ser retomados.

Uma falha de escrita no SSE é propagada pelo callback do cliente HTTP. Isso fecha
a resposta Backend → AI Service; o gerador FastAPI fecha o gerador do agente, que
por sua vez fecha o stream HTTP do provider.

## Consequências

- contexto, memória e payload passam a ter limites configuráveis;
- perguntas sobre fatos mensais ficam limitadas à janela
  `AGENT_ANALYTICAL_MAX_MONTHS`;
- uma conversa processa somente uma mensagem por vez e concorrentes recebem `409`;
- tentativas repetidas exigem o mesmo `clientMessageId` e conteúdo;
- respostas parciais não são persistidas como concluídas;
- o resumo é determinístico e serve apenas ao contexto conversacional, não como
  fonte de números financeiros;
- o cancelamento depende da detecção de escrita no socket e pode ocorrer após um
  pequeno buffer já ter sido enviado pelo sistema operacional.
