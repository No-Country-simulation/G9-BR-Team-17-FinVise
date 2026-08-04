# ADR 011 — Autenticação entre Backend e AI Service

## Contexto

As rotas `/internal/v1/*` do AI Service eram protegidas apenas pela topologia de
rede. Além disso, agente e RAG utilizavam diretamente o `user_id` recebido no
corpo JSON. Uma chamada que alcançasse o FastAPI poderia, portanto, escolher o
usuário consultado.

## Decisão

O backend autentica todas as chamadas internas com um token compartilhado em
`Authorization: Bearer`. O segredo é configurado por `AI_SERVICE_TOKEN`, deve
possuir pelo menos 32 caracteres e nunca é enviado ao frontend.

Nas operações do agente e do RAG, o backend envia o UUID obtido do principal JWT
em `X-FinVise-User-Id`. O AI Service valida primeiro o token de serviço, valida o
cabeçalho como UUID e constrói internamente a requisição com essa identidade.
Os contratos JSON externos dessas rotas proíbem `user_id`.

O endpoint `/health` permanece público para os health checks dos containers.

## Consequências

- chamadas internas sem token ou com token incorreto recebem `401`;
- agente e RAG não confiam em identidade fornecida no payload;
- backend e AI Service precisam compartilhar o mesmo segredo durante deploy e rotação;
- a rede Docker e o bloqueio de `/internal/` no Nginx permanecem como camadas adicionais;
- a rotação sem indisponibilidade exigirá suporte futuro a mais de um token válido.
