# API REST

Base local: `http://localhost:3000`. Produção: https://erp-fullstack-api-deividi.onrender.com

Todas as rotas, exceto `POST /api/auth/login` e `GET /`, exigem o cabeçalho `Authorization: Bearer <token>`. O token JWT vale 8 horas, mas a cada requisição o backend confere no banco se o usuário continua ativo e usa o perfil atual: desativar alguém ou trocar o perfil tem efeito imediato.

Respostas de erro são JSON no formato `{ "erro": "mensagem" }`, inclusive para JSON malformado (400) e rota inexistente (404).

## Autenticação

```http
POST /api/auth/login
```

## Usuários

```http
POST /api/usuarios   (somente ADMIN)
GET  /api/perfil
```

O primeiro administrador é criado pela linha de comando (`npm run criar-admin`), veja [execução local](execucao-local.md#primeiro-administrador).

A conta de demonstração (`demo@example.com`) é protegida: tentar recadastrar o e-mail dela responde 403. Toda rota que altere usuários deve consultar `ehUsuarioDemo` (`src/lib/usuarioDemo.ts`) e responder 403.

## Clientes

```http
POST   /api/clientes
GET    /api/clientes
GET    /api/clientes/:id
PUT    /api/clientes/:id
DELETE /api/clientes/:id   (somente ADMIN, exclusão lógica)
```

- CPF é único; duplicado responde 409, inclusive em cadastros simultâneos.
- Reativar um cliente (campo `ativo` no `PUT`) é exclusivo do ADMIN.

## Produtos

```http
POST   /api/produtos
GET    /api/produtos
GET    /api/produtos/:id
PUT    /api/produtos/:id
DELETE /api/produtos/:id   (somente ADMIN)
```

- Código é único; duplicado responde 409.
- Produto sem histórico é excluído; produto com histórico é desativado em vez de apagado.
- Reativar um produto (campo `ativo` no `PUT`) é exclusivo do ADMIN.
- O estoque inicial do cadastro fica registrado nas movimentações. Editar o produto não altera o saldo: o estoque só muda por movimentação ou venda.

## Estoque

```http
POST /api/estoque/entrada       (aceita Idempotency-Key)
POST /api/estoque/saida         (aceita Idempotency-Key)
GET  /api/estoque/movimentacoes
GET  /api/estoque/baixo
```

Saída com saldo insuficiente responde 409 com o estoque atual; produto inexistente responde 404.

## Pedidos

```http
POST /api/pedidos                  (aceita Idempotency-Key)
POST /api/pedidos/:id/itens        (aceita Idempotency-Key)
POST /api/pedidos/:id/finalizar    (aceita Idempotency-Key)
POST /api/pedidos/:id/cancelar
GET  /api/pedidos
GET  /api/pedidos/:id
```

- Cliente é opcional no pedido.
- Só pedidos `ABERTO` recebem itens e são finalizados; caso contrário, 409.
- A finalização baixa o estoque de todos os itens e registra as movimentações na mesma transação. Se algum produto não tiver saldo ou estiver desativado, nada muda.
- Subtotal e total são calculados com `Decimal`.

## Dashboard

```http
GET /api/dashboard
```

Total de clientes e produtos, pedidos abertos, vendas finalizadas, pedidos cancelados, faturamento total, produtos com estoque baixo e últimas vendas.

## Idempotency-Key

As rotas marcadas acima aceitam o cabeçalho `Idempotency-Key` (1 a 255 caracteres). As chaves são separadas por usuário.

| Situação | Resposta |
| --- | --- |
| Primeira requisição com a chave | Executa normalmente |
| Mesma chave e mesmo corpo | Devolve a resposta original, sem novo efeito, com o cabeçalho `Idempotent-Replayed: true` |
| Mesma chave enviada várias vezes ao mesmo tempo | Apenas uma aplica o efeito; as outras recebem a resposta dela |
| Mesma chave com outro corpo | 422, sem efeito |
| Requisição que falhou | A chave não é gravada e pode ser reutilizada |

O frontend gera uma chave (UUID) por ação do usuário e a reaproveita se a mesma ação for reenviada. Detalhes em [concorrência e idempotência](concorrencia.md).
