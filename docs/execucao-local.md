# Execução local

## Pré-requisitos

- Node.js 24 (versão usada no CI e nas imagens Docker)
- Um banco PostgreSQL

## Variáveis de ambiente

### Backend (`backend/.env`)

| Variável | Obrigatória | Descrição |
| --- | --- | --- |
| `DATABASE_URL` | sim | URL de conexão do PostgreSQL |
| `JWT_SECRET` | sim | Segredo para assinar os tokens JWT |
| `PORT` | não | Porta HTTP (padrão `3000`) |
| `CRIAR_USUARIO_DEMO` | não | `true` cria ou restaura a conta de demonstração ao iniciar o servidor (no Render isso já acontece, pela variável `RENDER`) |

```env
DATABASE_URL=sua_url_postgresql
JWT_SECRET=seu_segredo_jwt
```

O `.env` é ignorado pelo Git; nenhuma credencial fica no repositório.

### Frontend

| Variável | Obrigatória | Descrição |
| --- | --- | --- |
| `VITE_API_URL` | não | URL da API (padrão `http://localhost:3000`) |

```env
VITE_API_URL=http://localhost:3000
```

## Backend

```bash
git clone https://github.com/DeividiLuccasdev/erp-fullstack.git
cd erp-fullstack/backend
npm install
npx prisma generate
npx prisma migrate deploy
npm run dev
```

API em http://localhost:3000.

### Primeiro administrador

Não há cadastro público de usuários. Crie o primeiro administrador pela linha de comando (a senha é pedida no terminal):

```bash
npm run criar-admin -- --email voce@exemplo.com --nome "Seu Nome"
```

O mesmo comando redefine a senha e reativa um usuário que já existe, promovendo-o a `ADMIN`. Os demais usuários são criados por um ADMIN em `POST /api/usuarios`. O comando recusa o e-mail da conta de demonstração.

### Conta de demonstração

Com `CRIAR_USUARIO_DEMO=true` (ou no Render, que define `RENDER`), o servidor cria ou restaura, antes de aceitar conexões, o usuário `demo@example.com` (senha `Demo@2026`, perfil `OPERADOR`). A operação é um upsert: se a conta já existe, volta a ficar ativa, com o perfil e a senha originais. Sem essas variáveis nada é criado, então bancos locais e de teste ficam limpos. O código está em `src/lib/usuarioDemo.ts`.

## Frontend

Em outro terminal:

```bash
cd frontend
npm install
npm run dev
```

Frontend em http://localhost:5173.

## Docker

O projeto tem Dockerfiles separados para backend (Node 24 Alpine) e frontend (build com Node e arquivos servidos por Nginx), e um `docker-compose.yml` na raiz. O compose lê `backend/.env`; o banco não faz parte do compose.

```bash
docker compose up --build
```

```text
Frontend: http://localhost:8080
Backend:  http://localhost:3000
```

Para encerrar:

```bash
docker compose down
```

Ao iniciar, o container do backend roda `prisma generate` e `prisma migrate deploy`; se as migrations falharem, o servidor não sobe.

O frontend é compilado dentro da imagem e o Vite embute `VITE_API_URL` no momento do build; sem ela, a interface chama `http://localhost:3000`.
