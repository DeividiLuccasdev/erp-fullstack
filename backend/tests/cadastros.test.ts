import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import {
  app,
  contarStatus,
  criarPedido,
  criarProduto,
  criarUsuario,
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

function post(rota: string, corpo: object) {
  return request(app)
    .post(rota)
    .set("Authorization", `Bearer ${token}`)
    .send(corpo);
}

describe("campos únicos", () => {
  it("código de produto duplicado (inclusive em paralelo) responde 409", async () => {
    const produto = { nome: "Caneta", codigo: "CAN-1", preco: 2 };

    const respostas = await Promise.all(
      Array.from({ length: 5 }, () => post("/api/produtos", produto))
    );

    expect(contarStatus(respostas)).toEqual({ 201: 1, 409: 4 });
    expect(await prisma.produto.count()).toBe(1);
  });

  it("editar produto para um código já usado responde 409", async () => {
    await post("/api/produtos", { nome: "A", codigo: "A-1", preco: 1 });
    const b = await post("/api/produtos", { nome: "B", codigo: "B-1", preco: 1 });

    const resposta = await request(app)
      .put(`/api/produtos/${b.body.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ nome: "B", codigo: "A-1", preco: 1 });

    expect(resposta.status).toBe(409);
  });

  it("editar produto inexistente responde 404", async () => {
    const resposta = await request(app)
      .put("/api/produtos/nao-existe")
      .set("Authorization", `Bearer ${token}`)
      .send({ nome: "X", codigo: "X", preco: 1 });

    expect(resposta.status).toBe(404);
  });

  it("CPF duplicado (inclusive em paralelo) responde 409", async () => {
    const cliente = { nome: "Ana", cpf: "12345678900" };

    const respostas = await Promise.all(
      Array.from({ length: 5 }, () => post("/api/clientes", cliente))
    );

    expect(contarStatus(respostas)).toEqual({ 201: 1, 409: 4 });
    expect(await prisma.cliente.count()).toBe(1);
  });

  it("CPF de cliente excluído mantém a mensagem específica", async () => {
    const criado = await post("/api/clientes", { nome: "Ana", cpf: "111" });

    await request(app)
      .delete(`/api/clientes/${criado.body.id}`)
      .set("Authorization", `Bearer ${token}`);

    const resposta = await post("/api/clientes", { nome: "Ana 2", cpf: "111" });

    expect(resposta.status).toBe(409);
    expect(resposta.body.erro).toContain("excluído");
  });

  it("e-mail de usuário duplicado responde 409", async () => {
    const usuario = { nome: "Bia", email: "bia@teste.com", senha: "123456" };

    const respostas = await Promise.all(
      Array.from({ length: 3 }, () => post("/api/usuarios", usuario))
    );

    expect(contarStatus(respostas)).toEqual({ 201: 1, 409: 2 });
  });
});

describe("exclusão de produto", () => {
  it("sem histórico: exclui", async () => {
    const produto = await criarProduto(token);

    const resposta = await request(app)
      .delete(`/api/produtos/${produto.id}`)
      .set("Authorization", `Bearer ${token}`);

    expect(resposta.status).toBe(200);
    expect(await prisma.produto.count()).toBe(0);
  });

  it("com histórico: desativa em vez de falhar", async () => {
    const produto = await criarProduto(token, { estoque: 5 });
    await criarPedido(token, [{ produtoId: produto.id, quantidade: 1 }]);

    const resposta = await request(app)
      .delete(`/api/produtos/${produto.id}`)
      .set("Authorization", `Bearer ${token}`);

    expect(resposta.status).toBe(200);
    expect(resposta.body.mensagem).toContain("desativado");

    const atual = await prisma.produto.findUniqueOrThrow({
      where: { id: produto.id },
    });
    expect(atual.ativo).toBe(false);
  });

  it("inexistente: 404", async () => {
    const resposta = await request(app)
      .delete("/api/produtos/nao-existe")
      .set("Authorization", `Bearer ${token}`);

    expect(resposta.status).toBe(404);
  });
});
