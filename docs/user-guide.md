# Guia de uso do FinVise

Este guia descreve os fluxos disponíveis na interface atual. A aplicação local via Docker fica, por padrão, em `http://localhost:8080`.

## Criar uma conta e entrar

1. Acesse **Criar conta** em `/register`.
2. Informe nome, e-mail e uma senha de 8 a 100 caracteres.
3. Volte para `/login` e entre com e-mail e senha.

O cadastro não inicia uma sessão automaticamente. Após o login, o navegador armazena o JWT usado nas chamadas autenticadas.

Não existe conta pública de demonstração versionada. A migração `V16` remove a antiga conta insegura.

## Recuperar a senha

Na tela de login, abra **Esqueci minha senha** (`/forgot-password`). O fluxo possui três etapas:

1. informe o e-mail para solicitar um código;
2. digite o código de seis dígitos recebido;
3. defina e confirme a nova senha.

O código e o token de redefinição expiram em cinco minutos. Solicitar um novo código invalida o anterior. Após cinco tentativas inválidas, novas validações ficam bloqueadas por 30 minutos.

Por segurança, a primeira etapa mostra a mesma mensagem para e-mails existentes e inexistentes. A entrega depende de `RESEND_API_KEY` e de um remetente autorizado; em ambiente sem Resend configurado, a tela avança, mas o e-mail não chega.

Depois da redefinição, entre novamente com a nova senha. Tokens de login emitidos antes da troca ainda não são revogados automaticamente.

## Escolher a origem dos dados

O FinVise mantém duas origens separadas:

- `CSV_IMPORT`: arquivos importados manualmente;
- `OPEN_FINANCE_PLUGGY`: conexões sincronizadas pela Pluggy.

Quando uma tela pede uma origem ou fonte, a seleção controla quais transações entram em consultas, análises e contexto do agente. Uma conversa criada para uma origem não mistura dados da outra.

## Importar um CSV

1. Abra **Importar CSV** em `/import`.
2. Selecione um arquivo de até 5 MiB.
3. Envie e acompanhe o processamento/indexação.
4. Após a indexação, solicite a análise quando a interface oferecer essa etapa.

Formato mínimo:

```csv
description,amount,date,type,payment_method,recurrent
Supermercado ABC,150.50,2026-07-01,EXPENSE,CREDIT_CARD,false
Salário,3500.00,2026-07-05,INCOME,PIX,true
```

Regras:

- `description`, `amount` e `date` são obrigatórios;
- a data usa `YYYY-MM-DD`;
- o valor não pode ser zero;
- `type` aceita receita/despesa em inglês ou português e pode ser omitido;
- arquivos com o mesmo conteúdo não podem ser importados duas vezes pelo mesmo usuário;
- a categoria é calculada pelo sistema; o schema do dataset de treinamento não é o schema de upload.

Linhas inválidas aparecem no resultado. Um arquivo pode concluir com linhas válidas processadas e uma lista de erros para as demais.

## Conectar Open Finance

1. Abra `/open-finance`.
2. Confirme que a integração aparece como configurada.
3. Inicie o widget Pluggy e conclua a conexão da instituição.
4. Ao receber o `itemId`, aguarde a sincronização explícita feita pela aplicação.

O backend valida que o item pertence ao usuário, importa transações publicadas, evita duplicatas, categoriza os registros, atualiza fatos/RAG e cria uma análise.

Se a integração estiver indisponível, peça ao responsável pelo ambiente para conferir as credenciais Pluggy, URL de redirecionamento e opção sandbox. O projeto não recebe webhooks; novas sincronizações dependem do fluxo explícito implementado.

## Gerenciar fontes

Em `/import/sources` é possível:

- visualizar arquivos CSV e conexões Open Finance;
- definir uma fonte padrão;
- excluir uma fonte pertencente ao usuário.

Excluir uma fonte remove suas transações, snapshot financeiro e documentos RAG. Análises históricas já produzidas são preservadas como registro do resultado daquele momento. Excluir uma conexão Open Finance no FinVise não chama uma API de revogação no provedor.

## Consultar transações

Em `/transactions`, selecione a origem/fonte e use os filtros disponíveis. A API suporta tipo, categoria, período e paginação. A tela também apresenta totais e agrupamentos conforme o contexto selecionado. Existe um endpoint administrativo de reclassificação para transações CSV em `OUTROS`, mas a interface atual não expõe um botão para essa operação.

## Gerar uma análise

Em `/analyses/new`:

1. selecione a origem e, opcionalmente, uma fonte específica;
2. escolha o modelo de perfil;
3. defina o período, quando necessário;
4. execute a análise.

Modelos disponíveis:

- **Machine Learning**: classificador treinado para combinar renda, gastos e comportamento;
- **Regras financeiras**: resultado determinístico e explicável por limites financeiros.

A análise exige transações no escopo e ao menos uma receita. O resultado apresenta perfil, score, confiança, fatores, indicadores, resumo de gastos, recomendações e versões dos classificadores.

O histórico fica em `/history`; o resultado individual usa `/analyses/{analysisId}`.

## Dashboard, perfil e recomendações

- `/`: visão geral da análise mais recente, indicadores e recomendações prioritárias;
- `/profile`: detalhes do perfil financeiro atual;
- `/recommendations`: recomendações determinísticas associadas às análises.

Sem análise anterior, essas telas podem exibir estado vazio. Importe/sincronize dados e gere uma análise primeiro.

## Usar o agente financeiro

Em `/agent`:

1. crie ou selecione uma conversa;
2. escolha a origem, fontes específicas e profundidade de recuperação;
3. envie perguntas sobre receitas, despesas, categorias, meses, recorrências, comparações ou metas de economia;
4. acompanhe texto, ferramentas e fontes recebidos por streaming.

Exemplos:

- “Qual foi meu mês com maior despesa?”
- “Compare meus gastos dos últimos dois meses.”
- “Quais despesas recorrentes mais pesam no orçamento?”
- “Quanto preciso poupar por mês para atingir minha meta?”

O agente usa ferramentas determinísticas e evidências RAG filtradas pelo usuário e pela origem. Quando LLM está desabilitada, continua respondendo com um template determinístico. As respostas são educacionais e não substituem aconselhamento financeiro profissional.

Se uma mensagem já estiver em processamento, uma segunda tentativa na mesma conversa pode ser recusada temporariamente. A interface usa um identificador idempotente para evitar mensagens duplicadas.

## Configurações

Em `/settings` existem três grupos funcionais:

### Aparência

Escolha tema claro, escuro ou o tema do sistema. A preferência fica salva neste dispositivo. A interface atual está disponível somente em português do Brasil.

### Alterar senha autenticada

Informe a senha atual, a nova senha e a confirmação. A nova senha deve ter ao menos oito caracteres, ser diferente da atual e coincidir com a confirmação.

Esse fluxo é diferente de **Esqueci minha senha**: aqui é necessário estar autenticado e conhecer a senha atual.

### Exportar dados financeiros

Use **Baixar relatório CSV** para gerar `finvise-relatorio-financeiro.csv`. O arquivo:

- é UTF-8 com BOM para compatibilidade com planilhas;
- usa ponto e vírgula como separador;
- contém data de geração, usuário, total de receitas, despesas, saldo e resumo por categoria;
- usa vírgula como separador decimal.

A exportação considera todas as transações do usuário e não gera PDF ou Excel.

## Instalar como PWA

Em navegadores compatíveis, o FinVise pode ser instalado como aplicação. O service worker usa atualização automática. Para receber uma nova versão dos assets, pode ser necessário recarregar a página depois que a atualização for baixada.

## Problemas comuns

| Sintoma | Verificação |
| --- | --- |
| Código de recuperação não chega | Resend, remetente/domínio autorizado e logs do backend |
| CSV rejeitado | tamanho, extensão/content type, cabeçalhos, datas e duplicidade |
| Open Finance indisponível | status da integração e credenciais Pluggy |
| Análise sem dados | origem/fonte correta, receitas existentes e período |
| Agente sem fontes | indexação RAG, origem/sourceIds e status da fila |
| Exportação não inicia | sessão ainda válida e transações acessíveis |

Para detalhes técnicos, consulte [API](api.md) e [Desenvolvimento e operação local](development.md).
