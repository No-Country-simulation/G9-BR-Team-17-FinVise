# Documentação do FinVise

Este diretório reúne a documentação funcional, técnica e operacional do FinVise. O código e os arquivos de configuração versionados são a fonte final de verdade; os documentos abaixo explicam como executar, usar, desenvolver e operar o sistema.

## Comece por aqui

| Objetivo | Documento |
| --- | --- |
| Entender o produto e subir o ambiente rapidamente | [README principal](../README.md) |
| Configurar variáveis e integrações | [Configuração](configuration.md) |
| Conhecer os fluxos disponíveis na interface | [Guia de uso](user-guide.md) |
| Desenvolver e testar localmente | [Desenvolvimento e operação local](development.md) |
| Consultar endpoints, payloads e erros | [API](api.md) |
| Entender os componentes e fluxos internos | [Arquitetura](architecture.md) |
| Publicar em uma instância OCI | [Deploy na OCI](deployment-oci.md) |

## Por área

### Produto e uso

- [Guia de uso](user-guide.md): cadastro, recuperação de senha, importação CSV, Open Finance, análises, agente, configurações e exportação.
- [Frontend](../frontend/README.md): estrutura React, rotas, serviços, ambiente e testes.
- [API](api.md): contrato público do backend e contrato interno do AI Service.

### Backend e dados

- [Backend](../backend/README.md): módulos Spring Boot, banco, integrações, execução e testes.
- [Arquitetura](architecture.md): limites entre frontend, backend, AI Service, PostgreSQL e integrações externas.
- [Arquitetura RAG](rag-architecture.md): ingestão, fila durável, embeddings, busca híbrida e SSE.
- [Dados](../data/README.md): datasets, amostras, scripts e diferença entre treino e upload.

### Inteligência artificial

- [AI Service](../ai-service/README.md): FastAPI, registry, modelos, agente, RAG e endpoints internos.
- [Ciência de dados](data-science.md): preparação, treinamento, métricas, artefatos e provisionamento.
- [Relatório final dos modelos](../ai-service/reports/final-test/README.md): resultados reproduzíveis no conjunto de teste.

### Operação e segurança

- [Configuração](configuration.md): catálogo consolidado de variáveis por componente.
- [Desenvolvimento e operação local](development.md): Docker, execução isolada, CI, backup, restore e diagnóstico.
- [Segurança](security.md): controles implementados, segredos e limites conhecidos.
- [Deploy na OCI](deployment-oci.md): preparação da instância e operação em produção.

### Colaboração e decisões

- [Estratégia de branches](BRANCHING.md): branches permanentes, nomes, commits e promoção.
- [ADRs](adr/): decisões arquiteturais registradas e suas consequências.
- [Diagramas Mermaid](diagrams/): fontes versionadas dos principais diagramas.

## Fontes de verdade

Quando houver dúvida, valide nesta ordem:

1. endpoints e validações: controllers/DTOs do backend e routes/schemas do AI Service;
2. variáveis: `.env.example`, arquivos `application*.yml`, `app/core/config.py` e Compose;
3. dependências e scripts: `pom.xml`, `package.json`, `pyproject.toml`, lockfiles e `Makefile`;
4. banco: migrações Flyway em `backend/src/main/resources/db/migration`;
5. infraestrutura: arquivos Compose, Dockerfiles e configuração Nginx.

## Estado documentado

A documentação descreve o estado versionado da branch, não modificações locais ignoradas ou ainda não commitadas. Funcionalidades externas dependem de credenciais válidas:

- Resend para entrega do código de recuperação de senha;
- Pluggy para Open Finance;
- API compatível com OpenAI para LLM e embeddings remotos;
- OCI Object Storage quando `STORAGE_TYPE=oci`.

Sem essas credenciais, o núcleo local continua utilizável com as limitações registradas em [Configuração](configuration.md).

## Como manter

Uma mudança deve atualizar a documentação no mesmo pull request quando alterar:

- endpoint, DTO, código de erro ou autenticação;
- variável, valor padrão, segredo ou porta;
- comando de instalação, teste, build ou deploy;
- fluxo visível no frontend;
- schema/migração ou responsabilidade entre componentes;
- modelo, versão, artefato, dataset ou métrica publicada.

Use links relativos, exemplos sem segredos reais e marque explicitamente limitações ainda não implementadas.
