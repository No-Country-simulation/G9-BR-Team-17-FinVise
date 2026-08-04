# ADR 010 — Limites transacionais e chamadas externas

## Contexto

Os fluxos de importação CSV e sincronização Open Finance executavam armazenamento de objetos, Pluggy e AI Service dentro de métodos `@Transactional`. A latência ou indisponibilidade desses serviços mantinha conexões PostgreSQL e possíveis locks ocupados. Um rollback do banco também não desfazia arquivos já armazenados nem chamadas externas concluídas.

## Decisão

Separar orquestração e persistência:

- `CsvImportService` e `OpenFinanceService` executam validação, I/O e classificação sem transação de banco abrangente;
- `CsvImportPersistenceService` e `OpenFinancePersistenceService` concentram somente gravações em transações curtas;
- uma falha na persistência CSV aciona a remoção compensatória do arquivo armazenado;
- a sincronização Open Finance consulta IDs existentes uma vez e usa inserção JDBC em lotes com `ON CONFLICT DO NOTHING`;
- um advisory lock transacional por `provider:itemId` serializa commits concorrentes da mesma conexão;
- snapshots, chunks e o job RAG permanecem no mesmo commit das transações;
- chamadas do classificador de perfil ocorrem antes da transação curta que persiste a análise.

## Consequências

- Lentidão da Pluggy, do Object Storage ou do AI Service não ocupa uma conexão de banco durante a espera.
- Sincronizações repetidas e concorrentes tornam-se idempotentes para transações externas.
- O armazenamento de arquivos exige compensação explícita quando o commit falha.
- A análise continua síncrona para preservar o contrato da API, mas só começa depois do commit da sincronização e persiste seus resultados em uma transação separada.
