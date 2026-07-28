# FinVise - Frontend

Frontend da Fintech FinVise construído com React 19.2, TypeScript, Vite e PWA.

## Tecnologias

- React 19.2 + React DOM 19.2 + TypeScript
- Vite 7 + PWA (vite-plugin-pwa)
- React Router
- TanStack Query (React Query)
- React Hook Form + Zod
- Recharts
- Tailwind CSS
- Vitest + React Testing Library + MSW

## Estrutura

```
src/
├── app/           # App root
├── components/    # Componentes reutilizáveis (ui, charts, layout)
├── features/      # Módulos de funcionalidades
├── hooks/         # Hooks customizados
├── layouts/       # Layouts de página
├── lib/           # Utilitários e configurações
├── pages/         # Páginas roteadas
├── services/      # Serviços de API
├── types/         # Tipos TypeScript
└── validations/   # Schemas Zod
```

## Scripts

Requer Node.js 22.12 ou superior.

```bash
npm install
npm run dev        # desenvolvimento
npm run build      # build de produção
npm run preview    # preview do build
npm run test       # testes
npm run test -- --run # testes em CI
```

## Variáveis de ambiente

Copie `.env.example` para `.env.local` e ajuste conforme necessário.

## Acesso demo

- E-mail: `demo@finvise.com`
- Senha: `demo123`

O frontend espera o backend em `/api/v1` via Nginx. Em desenvolvimento, o Vite proxya requisições para o alvo configurado em `VITE_API_PROXY_TARGET`.
