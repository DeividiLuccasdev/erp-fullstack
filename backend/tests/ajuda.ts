import jwt from "jsonwebtoken";
import request from "supertest";

import app from "../src/app.ts";
import { prisma } from "../src/config/prisma.ts";

// Os testes apagam todas as tabelas: só rodam num banco de teste
const nomeBanco = new URL(process.env.DATABASE_URL ?? "").pathname;

if (!/test|ci/i.test(nomeBanco)) {
  throw new Error(
    `Os testes apagam dados: use um banco com "test" ou "ci" no nome (atual: ${nomeBanco}).`
  );
}

export { app, prisma };

export async function limparBanco() {
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      "ChaveIdempotencia",
      "MovimentacaoEstoque",
      "ItemPedido",
      "Pedido",
      "Produto",
      "Cliente",
      "Usuario"
    RESTART IDENTITY CASCADE
  `);
}

export async function criarUsuario(perfil: "ADMIN" | "OPERADOR" = "ADMIN") {
  const usuario = await prisma.usuario.create({
    data: {
      nome: `Usuário ${perfil}`,
      email: `${perfil.toLowerCase()}-${Math.random()}@teste.com`,
      senhaHash: "nao-usado-nos-testes",
      perfil,
    },
  });

  const token = jwt.sign(
    { usuarioId: usuario.id, perfil },
    process.env.JWT_SECRET!,
    { expiresIn: "1h" }
  );

  return { usuario, token };
}

let contadorCodigo = 0;

export async function criarProduto(
  token: string,
  dados: { estoque?: number; preco?: number | string; nome?: string } = {}
) {
  contadorCodigo += 1;

  const resposta = await request(app)
    .post("/api/produtos")
    .set("Authorization", `Bearer ${token}`)
    .send({
      nome: dados.nome ?? `Produto ${contadorCodigo}`,
      codigo: `P-${Date.now()}-${contadorCodigo}`,
      preco: dados.preco ?? 10,
      estoque: dados.estoque ?? 0,
    });

  if (resposta.status !== 201) {
    throw new Error(`Falha ao criar produto: ${resposta.status} ${resposta.text}`);
  }

  return resposta.body as { id: string; nome: string };
}

export async function criarPedido(
  token: string,
  itens: { produtoId: string; quantidade: number }[] = []
) {
  const criado = await request(app)
    .post("/api/pedidos")
    .set("Authorization", `Bearer ${token}`)
    .send({});

  if (criado.status !== 201) {
    throw new Error(`Falha ao criar pedido: ${criado.status} ${criado.text}`);
  }

  const pedidoId = criado.body.pedido.id as string;

  for (const item of itens) {
    const resposta = await request(app)
      .post(`/api/pedidos/${pedidoId}/itens`)
      .set("Authorization", `Bearer ${token}`)
      .send(item);

    if (resposta.status !== 201) {
      throw new Error(`Falha ao adicionar item: ${resposta.status} ${resposta.text}`);
    }
  }

  return pedidoId;
}

export async function estoqueDe(produtoId: string) {
  const produto = await prisma.produto.findUniqueOrThrow({
    where: { id: produtoId },
  });

  return produto.estoque;
}

// Invariante: o saldo é sempre a soma das entradas menos a das saídas
export async function conferirInvariante(produtoId: string) {
  const [estoque, entradas, saidas] = await Promise.all([
    estoqueDe(produtoId),
    prisma.movimentacaoEstoque.aggregate({
      where: { produtoId, tipo: "ENTRADA" },
      _sum: { quantidade: true },
    }),
    prisma.movimentacaoEstoque.aggregate({
      where: { produtoId, tipo: "SAIDA" },
      _sum: { quantidade: true },
    }),
  ]);

  return {
    estoque,
    calculado:
      (entradas._sum.quantidade ?? 0) - (saidas._sum.quantidade ?? 0),
  };
}

export function contarStatus(respostas: { status: number }[]) {
  const contagem: Record<number, number> = {};

  for (const resposta of respostas) {
    contagem[resposta.status] = (contagem[resposta.status] ?? 0) + 1;
  }

  return contagem;
}
