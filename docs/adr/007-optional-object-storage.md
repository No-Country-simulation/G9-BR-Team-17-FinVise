# ADR 007: Object Storage opcional

## Status

Aceito

## Contexto

Arquivos CSV importados precisam ser preservados para parsing, rastreabilidade e exclusão posterior.

## Decisão

Tornar o armazenamento dos CSVs importados configurável. Com `STORAGE_TYPE=local`, usar `LocalObjectStorageService`; com `STORAGE_TYPE=oci`, usar `OciObjectStorageService`.

## Consequências

- O projeto inicia localmente sem dependência de cloud.
- O modo local usa `/app/uploads` no volume `uploads_data` do Compose.
- O modo OCI exige namespace, bucket, região e o profile `DEFAULT` de `~/.oci/config` visível ao processo.
- O Compose atual não monta credenciais OCI; essa estratégia deve ser definida antes de habilitar o modo.
- Modelos, datasets, relatórios e backups não usam esta abstração na implementação atual.
