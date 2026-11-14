import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import {
  app,
  conferirInvariante,
  contarStatus,
  criarPedido,
  criarProduto,
  criarUsuario,
  estoqueDe,
  limparBanco,
  prisma,
} from "./ajuda.ts";

let token: string;

beforeEach(async () => {
  await limparBanco();
  ({ token } = await criarUsuario());
});

afterAll(async () => {
  await prisma.$disconnect();
});

function finalizar(pedidoId: string, chave?: string) {
  const req = request(app)
    .post(`/api/pedidos/${pedidoId}/finalizar`)
    .set("Authorization", `Bearer ${token}`);

  if (chave) {
    req.set("Idempotency-Key", chave);
  }

  return req.send();
}

function adicionarItem(
  pedidoId: string,
  produtoId: string,
  quantidade: number,
  chave?: string
) {
  const req = request(app)
    .post(`/api/pedidos/${pedidoId}/itens`)
    .set("Authorization", `Bearer ${token}`);

  if (chave) {
    req.set("Idempotency-Key", chave);
  }

  return req.send({ produtoId, quantidade });
}

describe("finalização concorrente", () => {
  it("5 finalizações simultâneas do mesmo pedido: uma 200, quatro 409, uma baixa", async () => {
    const produto = await criarProduto(token, { estoque: 10 });
    const pedidoId = await criarPedido(token, [
      { produtoId: produto.id, quantidade: 3 },
    ]);

    const respostas = await Promise.all(
      Array.from({ length: 5 }, () => finalizar(pedidoId))
    );

    expect(contarStatus(respostas)).toEqual({ 200: 1, 409: 4 });
    expect(await estoqueDe(produto.id)).toBe(7);

    const saidas = await prisma.movimentacaoEstoque.count({
      where: { produtoId: produto.id, tipo: "SAIDA" },
    });
    expect(saidas).toBe(1);
  });

  it("item adicionado durante a finalização: baixa de estoque = itens do pedido finalizado", async () => {
    for (let rodada = 0; rodada < 8; rodada++) {
      await limparBanco();
      ({ token } = await criarUsuario());

      const produto = await criarProduto(token, { estoque: 1_000 });
      const pedidoId = await criarPedido(token, [
        { produtoId: produto.id, quantidade: 1 },
      ]);

      const respostas = await Promise.all([
        adicionarItem(pedidoId, produto.id, 2),
        adicionarItem(pedidoId, produto.id, 4),
        finalizar(pedidoId),
        adicionarItem(pedidoId, produto.id, 8),
        adicionarItem(pedidoId, produto.id, 16),
      ]);

      expect(respostas.some((r) => r.status === 500)).toBe(false);

      const pedido = await prisma.pedido.findUniqueOrThrow({
        where: { id: pedidoId },
        include: { itens: true },
      });

      expect(pedido.status).toBe("FINALIZADO");

      const quantidadeNoPedido = pedido.itens.reduce(
        (soma, item) => soma + item.quantidade,
        0
      );
      const somaSubtotais = pedido.itens.reduce(
        (soma, item) => soma + Number(item.subtotal),
        0
      );

      expect(1_000 - (await estoqueDe(produto.id))).toBe(quantidadeNoPedido);
      expect(Number(pedido.total)).toBe(somaSubtotais);

      const { estoque, calculado } = await conferirInvariante(produto.id);
      expect(estoque).toBe(calculado);
    }
  });

  it("pedidos [A,B] e [B,A] finalizados ao mesmo tempo não dão deadlock/500", async () => {
    const a = await criarProduto(token, { estoque: 1_000 });
    const b = await criarProduto(token, { estoque: 1_000 });

    const pedidos: string[] = [];

    for (let i = 0; i < 6; i++) {
      pedidos.push(
        await criarPedido(
          token,
          i % 2 === 0
            ? [
                { produtoId: a.id, quantidade: 1 },
                { produtoId: b.id, quantidade: 1 },
              ]
            : [
                { produtoId: b.id, quantidade: 1 },
                { produtoId: a.id, quantidade: 1 },
              ]
        )
      );
    }

    const respostas = await Promise.all(pedidos.map((id) => finalizar(id)));

    expect(contarStatus(respostas)).toEqual({ 200: 6 });
    expect(await estoqueDe(a.id)).toBe(994);
    expect(await estoqueDe(b.id)).toBe(994);
  });

  it("pedido com o último item sem estoque: nada muda", async () => {
    const a = await criarProduto(token, { estoque: 10 });
    const b = await criarProduto(token, { estoque: 10 });
    const c = await criarProduto(token, { estoque: 1, nome: "Curto" });

    const pedidoId = await criarPedido(token, [
      { produtoId: a.id, quantidade: 2 },
      { produtoId: b.id, quantidade: 2 },
      { produtoId: c.id, quantidade: 5 },
    ]);

    const resposta = await finalizar(pedidoId);

    expect(resposta.status).toBe(409);
    expect(resposta.body.erro).toContain("Curto");

    expect(await estoqueDe(a.id)).toBe(10);
    expect(await estoqueDe(b.id)).toBe(10);
    expect(await estoqueDe(c.id)).toBe(1);

    const pedido = await prisma.pedido.findUniqueOrThrow({
      where: { id: pedidoId },
    });
    expect(pedido.status).toBe("ABERTO");

    const saidas = await prisma.movimentacaoEstoque.count({
      where: { tipo: "SAIDA" },
    });
    expect(saidas).toBe(0);
  });

  it("o mesmo produto em vários itens é baixado pela soma", async () => {
    const produto = await criarProduto(token, { estoque: 5 });

    const pedidoId = await criarPedido(token, [
      { produtoId: produto.id, quantidade: 3 },
      { produtoId: produto.id, quantidade: 3 },
    ]);

    expect((await finalizar(pedidoId)).status).toBe(409);
    expect(await estoqueDe(produto.id)).toBe(5);
  });

  it("produto desativado depois de entrar no pedido bloqueia a finalização", async () => {
    const produto = await criarProduto(token, { estoque: 5 });
    const pedidoId = await criarPedido(token, [
      { produtoId: produto.id, quantidade: 1 },
    ]);

    await prisma.produto.update({
      where: { id: produto.id },
      data: { ativo: false },
    });

    const resposta = await finalizar(pedidoId);
    expect(resposta.status).toBe(409);
    expect(await estoqueDe(produto.id)).toBe(5);
  });

  it("pedido inexistente responde 404", async () => {
    expect((await finalizar("nao-existe")).status).toBe(404);
    expect((await adicionarItem("nao-existe", "x", 1)).status).toBe(404);
  });
});

describe("itens do pedido", () => {
  it("não aceita item em pedido já finalizado", async () => {
    const produto = await criarProduto(token, { estoque: 5 });
    const pedidoId = await criarPedido(token, [
      { produtoId: produto.id, quantidade: 1 },
    ]);

    expect((await finalizar(pedidoId)).status).toBe(200);
    expect((await adicionarItem(pedidoId, produto.id, 1)).status).toBe(409);
  });

  it("subtotal e total usam Decimal (0,10 × 3 = 0,30)", async () => {
    const produto = await criarProduto(token, { estoque: 5, preco: "0.10" });
    const pedidoId = await criarPedido(token);

    const resposta = await adicionarItem(pedidoId, produto.id, 3);

    expect(resposta.status).toBe(201);
    expect(String(resposta.body.item.subtotal)).toBe("0.3");
    expect(String(resposta.body.totalPedido)).toBe("0.3");
  });

  it("Idempotency-Key repetida adiciona o item uma vez só", async () => {
    const produto = await criarProduto(token, { estoque: 5 });
    const pedidoId = await criarPedido(token);

    const respostas = await Promise.all([
      adicionarItem(pedidoId, produto.id, 2, "item-1"),
      adicionarItem(pedidoId, produto.id, 2, "item-1"),
      adicionarItem(pedidoId, produto.id, 2, "item-1"),
    ]);

    expect(contarStatus(respostas)).toEqual({ 201: 3 });

    const itens = await prisma.itemPedido.count({ where: { pedidoId } });
    expect(itens).toBe(1);
  });
});

describe("criação de pedido", () => {
  it("Idempotency-Key repetida cria um único pedido", async () => {
    const criar = () =>
      request(app)
        .post("/api/pedidos")
        .set("Authorization", `Bearer ${token}`)
        .set("Idempotency-Key", "novo-pedido-1")
        .send({});

    const [primeira, segunda] = [await criar(), await criar()];

    expect(primeira.status).toBe(201);
    expect(segunda.status).toBe(201);
    expect(segunda.body.pedido.id).toBe(primeira.body.pedido.id);
    expect(await prisma.pedido.count()).toBe(1);
  });

  it("finalizar com a mesma Idempotency-Key devolve 200 de novo, sem nova baixa", async () => {
    const produto = await criarProduto(token, { estoque: 5 });
    const pedidoId = await criarPedido(token, [
      { produtoId: produto.id, quantidade: 2 },
    ]);

    expect((await finalizar(pedidoId, "fin-1")).status).toBe(200);

    const repetida = await finalizar(pedidoId, "fin-1");
    expect(repetida.status).toBe(200);
    expect(repetida.headers["idempotent-replayed"]).toBe("true");
    expect(await estoqueDe(produto.id)).toBe(3);
  });
});
