# ADR 007: Object Storage opcional

## Status

Aceito

## Contexto

Armazenamento de modelos, datasets, CSVs e backups pode ser local ou na OCI Object Storage.

## Decisão

Tornar o Object Storage opcional. Quando não configurado, o sistema usa armazenamento local (`LocalObjectStorageService`). Quando configurado, usa `OciObjectStorageService`.

## Consequências

- O projeto inicia localmente sem dependência de cloud.
- Facilita desenvolvimento e testes.
- Produção pode migrar para Object Storage quando necessário.
