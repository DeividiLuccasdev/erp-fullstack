# Concorrência e idempotência

Introduzido no PR #5 (`fix: corrige corridas na finalização de pedidos e adiciona idempotência`). O objetivo é que duplo clique, retry após timeout de rede e requisições simultâneas não deixem o estoque negativo nem apliquem um efeito duas vezes.

## Baixa de estoque condicional

`POST /api/estoque/saida` baixa o saldo num único `UPDATE ... WHERE estoque >= quantidade`. Não há leitura seguida de escrita, então duas saídas simultâneas não passam ambas pela conferência. Se nenhuma linha for atualizada, a rota distingue produto inexistente (404) de saldo insuficiente (409).

Código: `backend/src/routes/estoque.routes.ts`.

## Finalização de pedido

Em `POST /api/pedidos/:id/finalizar`, dentro de uma transação:

1. O status muda para `FINALIZADO` com um `UPDATE` condicionado a `status = ABERTO`. Esse `UPDATE` trava a linha do pedido: finalizações simultâneas do mesmo pedido resultam em uma resposta 200 e as demais em 409.
2. Os itens são lidos **depois** da trava. Um item adicionado ao mesmo tempo ou já foi gravado (e entra na baixa) ou recebe 409.
3. As quantidades são agrupadas por produto e baixadas em ordem fixa de id. Duas vendas com os mesmos produtos em ordens diferentes travam as linhas na mesma ordem e não entram em deadlock.
4. Qualquer produto sem saldo ou desativado desfaz a transação inteira.

Código: `backend/src/routes/pedidos.routes.ts`.

## Repetição de transação

`backend/src/lib/transacao.ts` executa transações interativas com `maxWait` de 5 s e `timeout` de 10 s e repete até 3 vezes quando o PostgreSQL desfaz a transação por deadlock (`40P01`), falha de serialização (`40001`) ou conflito de escrita (`P2034` no Prisma), com uma espera aleatória curta entre tentativas. É seguro porque nada da tentativa anterior foi gravado. Outros erros sobem na primeira vez.

## Idempotency-Key

`backend/src/lib/idempotencia.ts`:

- A chave é gravada na tabela `ChaveIdempotencia` **na mesma transação** que o efeito, com índice único em `(usuarioId, chave)`.
- Um hash SHA-256 de método, rota e corpo (com as chaves do JSON ordenadas) identifica a requisição. Mesma chave com outro hash responde 422.
- Uma requisição simultânea com a mesma chave fica bloqueada no `INSERT` até a primeira terminar, falha com violação de unicidade (`P2002`) e então devolve a resposta gravada.
- Só respostas de sucesso ficam gravadas; se a operação falhar, tudo é desfeito e a chave pode ser reutilizada.

No frontend (`frontend/src/api.ts`), cada ação do usuário recebe um UUID que é reaproveitado se a mesma ação for reenviada e trocado depois de uma resposta definitiva.

## Invariantes no banco

Migration `20261114121540_concorrencia_idempotencia`:

- `CHECK` em `Produto`: `estoque`, `estoqueMinimo` e `preco` nunca negativos.
- `CHECK` em `ItemPedido` e `MovimentacaoEstoque`: `quantidade > 0`.

Campos únicos (código do produto, CPF, e-mail) são decididos pelo índice do banco, não por consulta prévia: duplicado responde 409 mesmo em cadastros simultâneos. Mesmo que algum caminho do código deixe de conferir, o PostgreSQL recusa o estado inválido.

## Testes

Os cenários acima são cobertos em `backend/tests/estoque.test.ts`, `backend/tests/pedidos.test.ts` e `backend/tests/cadastros.test.ts`, contra um PostgreSQL real. Veja a seção [Testes](../README.md#testes) do README.
