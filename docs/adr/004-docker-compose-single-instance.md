# ADR 004: Docker Compose em uma única OCI Compute Instance

## Status

Aceito

## Contexto

A solução deve rodar em uma única instância na OCI, sem Kubernetes.

## Decisão

Usar Docker Compose para orquestrar nginx, frontend, backend, AI service e PostgreSQL em uma única OCI Compute Instance.

## Consequências

- Simplicidade operacional para o MVP.
- No override de produção, somente Nginx expõe a porta 80; PostgreSQL, backend e AI Service ficam sem portas publicadas.
- No Compose de desenvolvimento, o PostgreSQL é publicado apenas no loopback (`127.0.0.1:5432`) para ferramentas locais; backend e AI Service não publicam portas, e somente o Nginx expõe a aplicação para outras interfaces do host.
- A configuração versionada não expõe 443 nem termina TLS; HTTPS depende de terminação externa ou de um override futuro.
- A rede Docker permite saída à internet (`internal: false`) para integrações externas.
- Escalabilidade vertical limitada; pode ser reavaliado no futuro.
