# Deploy e integração contínua

## Ambiente online

| Parte | Onde | URL |
| --- | --- | --- |
| Frontend | Render, Static Site | https://erp-fullstack-frontend.onrender.com |
| Backend | Render, Web Service Docker | https://erp-fullstack-api-deividi.onrender.com |
| Banco | PostgreSQL no Neon | |

### Inicialização do backend

O container roda, nesta ordem: `prisma generate`, `prisma migrate deploy` e `npm run start`. Se as migrations falharem, o servidor não sobe. Antes de escutar a porta, o servidor cria ou restaura a conta de demonstração (`demo@example.com` / `Demo@2026`, perfil `OPERADOR`), porque o Render define a variável `RENDER`; fora do Render isso só acontece com `CRIAR_USUARIO_DEMO=true`.

O primeiro acesso pode demorar de 30 a 60 segundos: o plano gratuito do Render "adormece" o servidor após 15 minutos sem uso. Depois que ele acorda, tudo responde normalmente.

## Integração contínua

Workflow `.github/workflows/ci.yml` (GitHub Actions), executado em `push` e `pull request` para `main` e manualmente (`workflow_dispatch`).

### Backend

Roda com um serviço PostgreSQL 16 no próprio workflow (banco `erp_ci`):

```bash
npm ci
npx prisma generate
npx tsc --noEmit
npx prisma migrate deploy
npm test
```

### Frontend

```bash
npm ci
npm run build   # tsc -b && vite build
```

Isso impede que alterações com erro de compilação ou testes quebrados sejam integradas ao projeto.
