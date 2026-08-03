# FinVise — Frontend

SPA/PWA do FinVise, construída com React 19.2.7, TypeScript e Vite 7.3.6.

## Tecnologias

- React 19.2.7 e React DOM 19.2.7.
- React Router 6.30.4 com lazy loading de páginas.
- TanStack Query 5.101.2 e Axios 1.18.1.
- React Hook Form 7.81.0, Zod 3.25.76 e resolvers.
- Recharts 3.9.2, Tailwind CSS 3.4.x, Framer Motion e Lucide React.
- `vite-plugin-pwa` com service worker `autoUpdate` e manifest estático em `public/manifest.json`.
- Vitest 4.1.10, Testing Library, MSW e JSDOM.

Consulte `package.json`/`package-lock.json` para as versões completas.

## Estrutura

```text
src/
├── app/           # raiz e roteamento
├── components/    # UI, autenticação, charts, layout, agente e transações
├── features/      # pontos de exportação por domínio
├── hooks/         # hooks de API e seleção de origem
├── layouts/       # layout autenticado
├── lib/           # Axios, Query Client, mocks e utilitários
├── pages/         # páginas carregadas por rota
├── services/      # clientes HTTP e parser SSE
├── types/         # contratos TypeScript
└── validations/   # schemas Zod
```

## Pré-requisitos

- Node.js >= 22.12.0.
- npm >= 10.

## Instalação e scripts

```bash
cd frontend
npm ci

npm run dev
npm run build
npm run preview
npm run lint
npm run test -- --run
npm run test:coverage -- --run
```

| Script | Ação |
| --- | --- |
| `dev` | servidor Vite em `http://localhost:5173` |
| `build` | `tsc && vite build`, saída em `dist/` sem sourcemaps |
| `preview` | preview do bundle |
| `lint` | ESLint para `.ts`/`.tsx`, zero warnings |
| `test` | Vitest em modo padrão |
| `test:coverage` | Vitest com coverage V8 |

O CI executa `npm ci`, lint, coverage em modo `--run` e build.

## Variáveis de ambiente

Copie o exemplo para execução isolada:

```bash
cp .env.example .env.local
```

| Variável | Padrão/fallback | Uso |
| --- | --- | --- |
| `VITE_API_BASE_URL` | `/api/v1` | `baseURL` do Axios e prefixo do `fetch` SSE; incorporada no build |
| `VITE_API_PROXY_TARGET` | `http://localhost:8080` | destino de `/api` no servidor Vite; precisa existir no ambiente do processo |

No build Docker, somente `VITE_API_BASE_URL` é recebido como build arg. O Compose usa `/api/v1`, roteado pelo Nginx externo para o backend.

`vite.config.ts` lê `VITE_API_PROXY_TARGET` por `process.env` e não chama `loadEnv`. Por isso, colocar apenas essa variável em `.env.local` não garante que o config a veja; defina-a no shell/processo que inicia `npm run dev` ou ajuste o config para carregar arquivos Vite.

## Rotas

Públicas:

- `/login`;
- `/register`;
- `/forgot-password`.

Privadas, protegidas pela existência do token em `localStorage`:

- `/` — dashboard;
- `/transactions`;
- `/analyses/new` e `/analyses/:analysisId`;
- `/import` e `/import/sources`;
- `/open-finance`;
- `/profile`, `/recommendations` e `/history`;
- `/agent`;
- `/settings`.

Uma rota desconhecida redireciona para `/`. A proteção no cliente é apenas UX; autorização efetiva ocorre no backend.

## Autenticação

O login persiste:

- `finance_ai_token`;
- `finance_ai_user_id`.

O interceptor Axios adiciona `Authorization: Bearer <token>`. Em `401`, remove a sessão local e redireciona para `/login`.

O cadastro não autentica automaticamente. O reset de senha envia o `resetToken` emitido pela validação do código como Bearer específico na última etapa.

O projeto não distribui usuário/senha de demonstração; a migração `V16` remove a antiga conta pública.

## Origens e agente

A origem selecionada é `CSV_IMPORT` ou `OPEN_FINANCE_PLUGGY`. A tela do agente também permite:

- selecionar UUIDs específicos dentre as fontes disponíveis;
- usar todas as fontes da origem com lista vazia;
- definir `topK` por opções 3, 5, 10 ou 15 (o backend aceita qualquer inteiro de 1 a 20).

O serviço cria a conversa quando necessário e envia mensagens por `fetch` para processar `ReadableStream`. Eventos aceitos: `conversation`, `tools`, `sources`, `token`, `done` e `error`. O token é incluído manualmente no `fetch`, pois esse caminho não usa Axios.

## PWA

O plugin usa:

- `registerType: autoUpdate`;
- `manifest: false`, pois o manifest é `public/manifest.json`;
- cache de `js`, `css`, `html`, `ico`, `png`, `svg` e `json`;
- fallback de navegação `/index.html`.

## Testes

Os testes versionados cobrem aplicação, componentes UI, páginas, validação e serviços de autenticação/API/agente. O setup está em `tests/setup.ts`, e a configuração em `vitest.config.ts`.

```bash
npm run test:coverage -- --run
```

## Backend esperado

O frontend consome o contrato descrito em `../docs/api.md`. Respostas REST normalmente usam `ApiResponse<T>`; reset de senha, RAG, model status e SSE possuem formatos próprios e são tratados pelos serviços correspondentes.
