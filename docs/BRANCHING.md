# Estratégia de branches

O projeto usa um fluxo de promoção com três branches permanentes:

| Branch | Ambiente | Finalidade |
| --- | --- | --- |
| `dev` | Desenvolvimento | Integração contínua do trabalho da equipe |
| `homolog` | Homologação | Validação funcional e aceite antes da produção |
| `main` | Produção | Código aprovado e pronto para publicação |

## Fluxo de desenvolvimento

1. Atualize `dev` e crie uma branch curta a partir dela.
2. Use um dos prefixos: `feature/`, `fix/`, `chore/`, `docs/`, `refactor/` ou `hotfix/`.
3. Abra um PR da branch de trabalho para `dev`.
4. Depois da integração e dos testes, abra um PR de `dev` para `homolog`.
5. Após o aceite em homologação, abra um PR de `homolog` para `main`.
6. O PR para `main` exige aprovação exclusiva de `@lucasabreuzip`. Não é permitido push direto.

## Fluxo operacional do time

Para a equipe, o fluxo operacional é:

1. Cada dev cria sua branch de trabalho a partir de `dev`.
2. O dev implementa a tarefa e abre PR para `dev`.
3. O time revisa e integra em `dev`.
4. Quando `dev` estiver estável, abre-se PR de `dev` para `homolog`.
5. Após validação em `homolog`, abre-se PR de `homolog` para `main`.
6. O PR para `main` fica aguardando a aprovação de `@lucasabreuzip`.

Fluxo resumido:

```text
feature/* ou fix/* -> dev -> homolog -> main (produção)
```

## Regras de proteção recomendadas

### `dev`

- Alterações somente por pull request.
- CI obrigatória.
- Conversas do review devem estar resolvidas.

### `homolog`

- Aceitar PR somente de `dev`.
- Alterações somente por pull request.
- CI obrigatória.
- Conversas do review devem estar resolvidas.

### `main`

- Aceitar PR somente de `homolog`.
- Alterações somente por pull request.
- Exigir pelo menos uma aprovação.
- Exigir revisão do `CODEOWNERS` (`@lucasabreuzip`) como único aprovador permitido.
- Invalidar aprovação quando novos commits forem enviados.
- CI obrigatória e conversas resolvidas.
- Bloquear force push e exclusão da branch.

O workflow `Branch policy` valida automaticamente o caminho de promoção. O arquivo
`CODEOWNERS` define o proprietário responsável pela aprovação de produção.
Consulte também a [Estratégia de CI/CD](ci-cd.md) para os jobs, gatilhos,
espelhamento e limites do deploy.

## Convenção de commits

Use mensagens objetivas no formato Conventional Commits:

```text
feat: adiciona importação de extrato
fix: corrige cálculo do saldo mensal
docs: documenta processo de homologação
```

## Correção urgente em produção

Crie `hotfix/<descricao>` a partir de `dev`, valide normalmente e promova pelo mesmo
caminho. O workflow atual rejeita PR direto de `hotfix/*` para `main`. Se a urgência
exigir uma exceção administrativa, registre justificativa, risco e rollback no PR e
prossiga somente com aprovação explícita do proprietário.

