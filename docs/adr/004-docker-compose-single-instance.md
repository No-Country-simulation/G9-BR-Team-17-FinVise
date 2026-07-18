# ADR 004: Docker Compose em uma única OCI Compute Instance

## Status

Aceito

## Contexto

A solução deve rodar em uma única instância na OCI, sem Kubernetes.

## Decisão

Usar Docker Compose para orquestrar nginx, frontend, backend, AI service e PostgreSQL em uma única OCI Compute Instance.

## Consequências

- Simplicidade operacional para o MVP.
- Rede interna do Docker isola PostgreSQL e AI service.
- Apenas nginx expõe portas 80/443.
- Escalabilidade vertical limitada; pode ser reavaliado no futuro.
