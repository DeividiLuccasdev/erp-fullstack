# ERP Full-Stack — Sistema de Gestão Comercial

Sistema web Full-Stack para gerenciamento comercial, desenvolvido com **React, TypeScript, Node.js, Express, PostgreSQL e Prisma**.

O projeto implementa autenticação, gerenciamento de clientes e produtos, controle de estoque, vendas, pedidos e dashboard, além de infraestrutura com Docker, CI com GitHub Actions e deploy em nuvem.

## 🌐 Aplicação Online

**Frontend:**  
https://erp-fullstack-frontend.onrender.com

**API:**  
https://erp-fullstack-api-deividi.onrender.com

## 🚀 Tecnologias

### Frontend

- React
- TypeScript
- Vite
- Tailwind CSS
- Lucide React
- Fetch API

### Backend

- Node.js
- TypeScript
- Express
- API REST
- JWT
- bcryptjs
- Prisma ORM

### Banco de Dados

- PostgreSQL
- Neon PostgreSQL

### DevOps e Infraestrutura

- Docker
- Docker Compose
- GitHub Actions
- CI/CD
- Render
- Git
- GitHub

---

## 📋 Funcionalidades

### 🔐 Autenticação

- Login com e-mail e senha
- Autenticação utilizando JWT
- Senhas armazenadas com hash usando bcrypt
- Controle de acesso por perfil
- Perfis `ADMIN` e `OPERADOR`
- Rotas protegidas por middleware

### 👥 Clientes

- Cadastro de clientes
- Listagem
- Busca por ID
- Edição
- Exclusão lógica
- Validação de CPF duplicado
- Controle de clientes ativos e inativos

### 📦 Produtos

- Cadastro de produtos
- Listagem
- Consulta por ID
- Edição
- Exclusão
- Código único por produto
- Controle de preço
- Estoque atual
- Estoque mínimo

### 📊 Estoque

- Entrada de produtos
- Saída de produtos
- Validação de estoque disponível
- Histórico de movimentações
- Identificação do usuário responsável
- Controle de produtos com estoque baixo
- Operações utilizando transações no banco de dados

### 🛒 Vendas e Pedidos

- Criação de pedidos
- Associação opcional de cliente
- Inclusão de produtos no pedido
- Cálculo automático de subtotal
- Cálculo automático do total
- Finalização da venda
- Cancelamento de pedidos
- Baixa automática de estoque
- Registro automático da movimentação de estoque
- Validação de estoque antes da finalização
- Detalhamento completo dos pedidos

### 📈 Dashboard

- Total de clientes
- Total de produtos
- Pedidos abertos
- Vendas finalizadas
- Pedidos cancelados
- Faturamento total
- Produtos com estoque baixo
- Últimas vendas realizadas

---

## 🏗️ Arquitetura do Backend

O backend foi refatorado para separar as responsabilidades por módulo.

```text
backend/
├── prisma/
│   ├── migrations/
│   └── schema.prisma
│
├── src/
│   ├── config/
│   │   └── prisma.ts
│   │
│   ├── middlewares/
│   │   └── auth.ts
│   │
│   ├── routes/
│   │   ├── auth.routes.ts
│   │   ├── clientes.routes.ts
│   │   ├── dashboard.routes.ts
│   │   ├── estoque.routes.ts
│   │   ├── pedidos.routes.ts
│   │   ├── produtos.routes.ts
│   │   └── usuarios.routes.ts
│   │
│   └── server.ts
│
├── Dockerfile
├── package.json
└── tsconfig.json
```

O `server.ts` é responsável principalmente por configurar o Express, middlewares e registrar os módulos da aplicação.

---

## 🖥️ Estrutura do Frontend

```text
frontend/
├── src/
│   ├── pages/
│   │   ├── Clientes.tsx
│   │   ├── Estoque.tsx
│   │   ├── Produtos.tsx
│   │   └── Vendas.tsx
│   │
│   ├── api.ts
│   ├── App.tsx
│   ├── index.css
│   └── main.tsx
│
├── Dockerfile
├── package.json
└── vite.config.ts
```

---

## 🔌 Principais Endpoints

### Autenticação

```http
POST /api/auth/login
```

### Usuários

```http
POST /api/usuarios
GET  /api/perfil
GET  /api/admin/teste
```

### Clientes

```http
POST   /api/clientes
GET    /api/clientes
GET    /api/clientes/:id
PUT    /api/clientes/:id
DELETE /api/clientes/:id
```

### Produtos

```http
POST   /api/produtos
GET    /api/produtos
GET    /api/produtos/:id
PUT    /api/produtos/:id
DELETE /api/produtos/:id
```

### Estoque

```http
POST /api/estoque/entrada
POST /api/estoque/saida
GET  /api/estoque/movimentacoes
GET  /api/estoque/baixo
```

### Pedidos

```http
POST /api/pedidos
POST /api/pedidos/:id/itens
POST /api/pedidos/:id/finalizar
POST /api/pedidos/:id/cancelar
GET  /api/pedidos
GET  /api/pedidos/:id
```

### Dashboard

```http
GET /api/dashboard
```

---

## 🔒 Segurança

O projeto utiliza:

- JWT para autenticação
- bcrypt para hash das senhas
- Middleware para validação do token
- Controle de autorização por perfil
- Variáveis de ambiente para credenciais
- `.env` protegido pelo `.gitignore`
- Validações no backend antes de operações críticas
- Transações de banco em movimentações de estoque e vendas

Nenhuma credencial sensível é armazenada diretamente no repositório.

---

## ⚙️ Variáveis de Ambiente

### Backend

Crie:

```text
backend/.env
```

Exemplo:

```env
DATABASE_URL=sua_url_postgresql
JWT_SECRET=seu_segredo_jwt
```

### Frontend

Para utilizar uma API diferente:

```env
VITE_API_URL=http://localhost:3000
```

---

## 💻 Executando Localmente

Clone o repositório:

```bash
git clone https://github.com/DeividiLuccasdev/erp-fullstack.git
cd erp-fullstack
```

### Backend

```bash
cd backend
npm install
npx prisma generate
npm run dev
```

Backend:

```text
http://localhost:3000
```

### Frontend

Em outro terminal:

```bash
cd frontend
npm install
npm run dev
```

Frontend:

```text
http://localhost:5173
```

---

## 🐳 Docker

O projeto possui Dockerfiles separados para frontend e backend e um `docker-compose.yml` na raiz.

Para executar:

```bash
docker compose up --build
```

Serviços:

```text
Frontend: http://localhost:8080
Backend:  http://localhost:3000
```

Para encerrar:

```bash
docker compose down
```

---

## 🔄 Integração Contínua

O projeto utiliza **GitHub Actions**.

A cada `push` ou `pull request` para a branch `main`, o workflow executa automaticamente validações do projeto.

### Backend

```bash
npm ci
npx prisma generate
npx tsc --noEmit
```

### Frontend

```bash
npm ci
npm run build
```

Isso ajuda a impedir que alterações com erros de compilação sejam integradas ao projeto.

---

## ☁️ Deploy

### Frontend

Deploy como **Static Site** no Render.

https://erp-fullstack-frontend.onrender.com

### Backend

Deploy como **Web Service Docker** no Render.

https://erp-fullstack-api-deividi.onrender.com

### Banco

PostgreSQL hospedado no **Neon**.

---

## 🧠 Conceitos Aplicados

Este projeto utiliza conceitos importantes de desenvolvimento de software:

- Arquitetura cliente-servidor
- API REST
- CRUD
- Autenticação e autorização
- JWT
- Hash de senhas
- Relacionamentos em banco de dados
- ORM
- Transações
- Regras de negócio
- Componentização
- Estado no React
- Consumo de APIs
- Variáveis de ambiente
- Containerização
- CI/CD
- Deploy em nuvem
- Versionamento com Git

---

## 📌 Status do Projeto

**Concluído ✅**

O sistema está funcional localmente e em produção, com frontend, backend, banco de dados, autenticação, Docker, CI e deploy configurados.

---

## 👨‍💻 Autor

**Deividi Tiago Luccas**

Desenvolvedor Full-Stack

GitHub:  
https://github.com/DeividiLuccasdev

LinkedIn:  
https://www.linkedin.com/in/deividi-luccas-0ab589227