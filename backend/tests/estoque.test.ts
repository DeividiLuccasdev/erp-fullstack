import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import {
  app,
  conferirInvariante,
  contarStatus,
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

function saida(produtoId: string, quantidade = 1, chave?: string) {
  const req = request(app)
    .post("/api/estoque/saida")
    .set("Authorization", `Bearer ${token}`);

  if (chave) {
    req.set("Idempotency-Key", chave);
  }

  return req.send({ produtoId, quantidade });
}

function entrada(produtoId: string, quantidade = 1, chave?: string) {
  const req = request(app)
    .post("/api/estoque/entrada")
    .set("Authorization", `Bearer ${token}`);

  if (chave) {
    req.set("Idempotency-Key", chave);
  }

  return req.send({ produtoId, quantidade });
}

describe("saída de estoque concorrente", () => {
  it("estoque 5 e 10 saídas simultâneas de 1: exatamente 5 passam e o saldo fica 0", async () => {
    const produto = await criarProduto(token, { estoque: 5 });

    const respostas = await Promise.all(
      Array.from({ length: 10 }, () => saida(produto.id))
    );

    expect(contarStatus(respostas)).toEqual({ 201: 5, 409: 5 });
    expect(await estoqueDe(produto.id)).toBe(0);

    const saidas = await prisma.movimentacaoEstoque.count({
      where: { produtoId: produto.id, tipo: "SAIDA" },
    });
    expect(saidas).toBe(5);

    const { estoque, calculado } = await conferirInvariante(produto.id);
    expect(estoque).toBe(calculado);
  });

  it("entradas e saídas misturadas mantêm estoque = Σentrada − Σsaída", async () => {
    const produto = await criarProduto(token, { estoque: 3 });

    const respostas = await Promise.all(
      Array.from({ length: 20 }, (_, i) =>
        i % 2 === 0 ? entrada(produto.id, 2) : saida(produto.id, 3)
      )
    );

    expect(respostas.every((r) => r.status === 201 || r.status === 409)).toBe(true);

    const { estoque, calculado } = await conferirInvariante(produto.id);
    expect(estoque).toBe(calculado);
    expect(estoque).toBeGreaterThanOrEqual(0);
  });

  it("produto inexistente responde 404 e não 500", async () => {
    expect((await saida("nao-existe")).status).toBe(404);
    expect((await entrada("nao-existe")).status).toBe(404);
  });
});

describe("Idempotency-Key em entrada/saída", () => {
  it("a mesma chave repetida aplica o efeito uma vez e devolve a resposta original", async () => {
    const produto = await criarProduto(token, { estoque: 10 });

    const primeira = await saida(produto.id, 2, "chave-saida-1");
    const segunda = await saida(produto.id, 2, "chave-saida-1");

    expect(primeira.status).toBe(201);
    expect(segunda.status).toBe(201);
    expect(segunda.headers["idempotent-replayed"]).toBe("true");
    expect(segunda.body).toEqual(primeira.body);
    expect(await estoqueDe(produto.id)).toBe(8);
  });

  it("a mesma chave enviada várias vezes AO MESMO TEMPO aplica o efeito uma vez", async () => {
    const produto = await criarProduto(token, { estoque: 10 });

    const respostas = await Promise.all(
      Array.from({ length: 5 }, () => entrada(produto.id, 3, "chave-entrada-paralela"))
    );

    expect(contarStatus(respostas)).toEqual({ 201: 5 });
    expect(await estoqueDe(produto.id)).toBe(13);

    const ids = new Set(respostas.map((r) => r.body.movimentacao.id));
    expect(ids.size).toBe(1);
  });

  it("a mesma chave com outro corpo responde 422 sem efeito", async () => {
    const produto = await criarProduto(token, { estoque: 10 });

    expect((await saida(produto.id, 1, "chave-x")).status).toBe(201);

    const outra = await saida(produto.id, 5, "chave-x");
    expect(outra.status).toBe(422);
    expect(await estoqueDe(produto.id)).toBe(9);
  });

  it("falha não grava a chave: corrigido o saldo, a mesma chave funciona", async () => {
    const produto = await criarProduto(token, { estoque: 0 });

    expect((await saida(produto.id, 1, "chave-retry")).status).toBe(409);

    await entrada(produto.id, 1);

    expect((await saida(produto.id, 1, "chave-retry")).status).toBe(201);
    expect(await estoqueDe(produto.id)).toBe(0);
  });

  it("chaves são separadas por usuário", async () => {
    const produto = await criarProduto(token, { estoque: 10 });
    const outro = await criarUsuario("OPERADOR");

    await saida(produto.id, 1, "mesma-chave");

    const doOutro = await request(app)
      .post("/api/estoque/saida")
      .set("Authorization", `Bearer ${outro.token}`)
      .set("Idempotency-Key", "mesma-chave")
      .send({ produtoId: produto.id, quantidade: 1 });

    expect(doOutro.status).toBe(201);
    expect(doOutro.headers["idempotent-replayed"]).toBeUndefined();
    expect(await estoqueDe(produto.id)).toBe(8);
  });
});

describe("invariantes no banco", () => {
  it("CHECK impede estoque negativo mesmo fora da API", async () => {
    const produto = await criarProduto(token, { estoque: 1 });

    await expect(
      prisma.produto.update({
        where: { id: produto.id },
        data: { estoque: -1 },
      })
    ).rejects.toThrow();

    expect(await estoqueDe(produto.id)).toBe(1);
  });
});
