# ADR 005: Geração de Recomendações por Agente de IA com Fallback Determinístico

## Status

Aceito

## Contexto

As recomendações persistidas junto às análises financeiras devem ser personalizadas, contextuais e inteligentes quando o Agente de IA estiver ativo, mantendo alta disponibilidade e resiliência caso o serviço de IA ou o provedor LLM estejam indisponíveis.

## Decisão

1. Os indicadores e métricas financeiras (renda, gastos, endividamento, taxa de poupança, reserva) continuam sendo calculados de forma determinística e precisa em background pelo backend Java.
2. Quando a LLM estiver ativada (`ENABLE_LLM=true`) e o `ai-service` operacional, o backend solicita ao **Agente de IA** a geração de recomendações inteligentes e personalizadas (`/internal/v1/recommendations/generate`), recebendo itens estruturados em formato JSON.
3. Se a LLM estiver desativada (`ENABLE_LLM=false`) ou ocorrer falha de comunicação/timeout com o `ai-service`, o `RecommendationEngine` em Java aciona automaticamente o motor de regras determinísticas como **fallback de resiliência**.

## Consequências

- Recomendações ricas, explicáveis e personalizadas geradas por IA quando o sistema possui conectividade com o provedor LLM.
- Resiliência total: o sistema nunca fica indisponível ou sem recomendações em caso de falha de conexão ou ausência de chave de IA.
- Padrão DRY mantido: o cálculo pesado de indicadores financeiros permanece centralizado e reutilizável no backend.
