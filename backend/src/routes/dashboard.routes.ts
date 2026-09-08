import { Router } from "express";

import { autenticarToken } from "../middlewares/auth.js";
import { prisma } from "../config/prisma.js";

const router = Router();

// ========================================
// DASHBOARD
// GET /api/dashboard
// ========================================

router.get("/", autenticarToken, async (req, res) => {
  try {
    const [
      totalClientes,
      totalProdutos,
      pedidosAbertos,
      vendasFinalizadas,
      pedidosCancelados,
      faturamento,
      produtos,
      ultimasVendas,
    ] = await Promise.all([
      prisma.cliente.count({
        where: {
          ativo: true,
        },
      }),

      prisma.produto.count({
        where: {
          ativo: true,
        },
      }),

      prisma.pedido.count({
        where: {
          status: "ABERTO",
        },
      }),

      prisma.pedido.count({
        where: {
          status: "FINALIZADO",
        },
      }),

      prisma.pedido.count({
        where: {
          status: "CANCELADO",
        },
      }),

      prisma.pedido.aggregate({
        where: {
          status: "FINALIZADO",
        },
        _sum: {
          total: true,
        },
      }),

      prisma.produto.findMany({
        where: {
          ativo: true,
        },
        select: {
          id: true,
          nome: true,
          codigo: true,
          estoque: true,
          estoqueMinimo: true,
        },
      }),

      prisma.pedido.findMany({
        where: {
          status: "FINALIZADO",
        },

        orderBy: {
          finalizadoEm: "desc",
        },

        take: 5,

        include: {
          cliente: {
            select: {
              id: true,
              nome: true,
            },
          },

          usuario: {
            select: {
              id: true,
              nome: true,
            },
          },
        },
      }),
    ]);

    const estoqueBaixo = produtos.filter(
      (produto) =>
        produto.estoque <= produto.estoqueMinimo
    );

    return res.status(200).json({
      resumo: {
        totalClientes,
        totalProdutos,
        pedidosAbertos,
        vendasFinalizadas,
        pedidosCancelados,
        faturamentoTotal: Number(
          faturamento._sum.total ?? 0
        ),
        produtosEstoqueBaixo: estoqueBaixo.length,
      },

      estoqueBaixo,

      ultimasVendas,
    });

  } catch (erro) {
    console.error(erro);

    return res.status(500).json({
      erro: "Erro interno ao carregar dashboard.",
    });
  }
});

export default router;