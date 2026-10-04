import { Router } from "express";

import { autenticarToken } from "../middlewares/auth.js";
import type { RequestAutenticada } from "../middlewares/auth.js";

import { prisma } from "../config/prisma.js";

const router = Router();

class EstoqueInsuficiente extends Error {}

// ========================================
// ENTRADA DE ESTOQUE
// POST /api/estoque/entrada
// ========================================

router.post("/entrada", autenticarToken, async (req, res) => {
  try {
    const requisicao = req as RequestAutenticada;

    if (!requisicao.usuario) {
      return res.status(401).json({
        erro: "Usuário não autenticado.",
      });
    }

    const {
      produtoId,
      quantidade,
      observacao,
    } = req.body;

    if (!produtoId || !quantidade) {
      return res.status(400).json({
        erro: "Produto e quantidade são obrigatórios.",
      });
    }

    const quantidadeNumero = Number(quantidade);

    if (
      !Number.isInteger(quantidadeNumero) ||
      quantidadeNumero <= 0
    ) {
      return res.status(400).json({
        erro: "A quantidade deve ser um número inteiro maior que zero.",
      });
    }

    const produto = await prisma.produto.findUnique({
      where: {
        id: produtoId,
      },
    });

    if (!produto) {
      return res.status(404).json({
        erro: "Produto não encontrado.",
      });
    }

    const resultado = await prisma.$transaction(async (tx) => {
      const produtoAtualizado = await tx.produto.update({
        where: {
          id: produtoId,
        },
        data: {
          estoque: {
            increment: quantidadeNumero,
          },
        },
      });

      const movimentacao = await tx.movimentacaoEstoque.create({
        data: {
          produtoId,
          usuarioId: requisicao.usuario!.usuarioId,
          tipo: "ENTRADA",
          quantidade: quantidadeNumero,
          observacao: observacao || null,
        },
      });

      return {
        produtoAtualizado,
        movimentacao,
      };
    });

    return res.status(201).json({
      mensagem: "Entrada de estoque registrada com sucesso.",
      estoqueAtual: resultado.produtoAtualizado.estoque,
      movimentacao: resultado.movimentacao,
    });

  } catch (erro) {
    console.error(erro);

    return res.status(500).json({
      erro: "Erro interno ao registrar entrada de estoque.",
    });
  }
});

// ========================================
// SAÍDA DE ESTOQUE
// POST /api/estoque/saida
// ========================================

router.post("/saida", autenticarToken, async (req, res) => {
  try {
    const requisicao = req as RequestAutenticada;

    if (!requisicao.usuario) {
      return res.status(401).json({
        erro: "Usuário não autenticado.",
      });
    }

    const {
      produtoId,
      quantidade,
      observacao,
    } = req.body;

    if (!produtoId || !quantidade) {
      return res.status(400).json({
        erro: "Produto e quantidade são obrigatórios.",
      });
    }

    const quantidadeNumero = Number(quantidade);

    if (
      !Number.isInteger(quantidadeNumero) ||
      quantidadeNumero <= 0
    ) {
      return res.status(400).json({
        erro: "A quantidade deve ser um número inteiro maior que zero.",
      });
    }

    const produto = await prisma.produto.findUnique({
      where: {
        id: produtoId,
      },
    });

    if (!produto) {
      return res.status(404).json({
        erro: "Produto não encontrado.",
      });
    }

    // Impede estoque negativo
    if (produto.estoque < quantidadeNumero) {
      return res.status(409).json({
        erro: "Estoque insuficiente.",
        estoqueAtual: produto.estoque,
      });
    }

    const resultado = await prisma.$transaction(async (tx) => {
      // Baixa só se ainda houver saldo: a conferência acima não basta
      // quando duas saídas acontecem ao mesmo tempo
      const baixa = await tx.produto.updateMany({
        where: {
          id: produtoId,
          estoque: {
            gte: quantidadeNumero,
          },
        },
        data: {
          estoque: {
            decrement: quantidadeNumero,
          },
        },
      });

      if (baixa.count === 0) {
        throw new EstoqueInsuficiente();
      }

      const produtoAtualizado = await tx.produto.findUniqueOrThrow({
        where: {
          id: produtoId,
        },
      });

      const movimentacao = await tx.movimentacaoEstoque.create({
        data: {
          produtoId,
          usuarioId: requisicao.usuario!.usuarioId,
          tipo: "SAIDA",
          quantidade: quantidadeNumero,
          observacao: observacao || null,
        },
      });

      return {
        produtoAtualizado,
        movimentacao,
      };
    });

    return res.status(201).json({
      mensagem: "Saída de estoque registrada com sucesso.",
      estoqueAtual: resultado.produtoAtualizado.estoque,
      movimentacao: resultado.movimentacao,
    });

  } catch (erro) {
    if (erro instanceof EstoqueInsuficiente) {
      const atual = await prisma.produto.findUnique({
        where: {
          id: req.body.produtoId,
        },
      });

      return res.status(409).json({
        erro: "Estoque insuficiente.",
        estoqueAtual: atual?.estoque ?? 0,
      });
    }

    console.error(erro);

    return res.status(500).json({
      erro: "Erro interno ao registrar saída de estoque.",
    });
  }
});

// ========================================
// HISTÓRICO DE MOVIMENTAÇÕES
// GET /api/estoque/movimentacoes
// ========================================

router.get("/movimentacoes", autenticarToken, async (req, res) => {
  try {
    const movimentacoes =
      await prisma.movimentacaoEstoque.findMany({
        orderBy: {
          criadoEm: "desc",
        },

        include: {
          produto: {
            select: {
              id: true,
              nome: true,
              codigo: true,
            },
          },

          usuario: {
            select: {
              id: true,
              nome: true,
              email: true,
              perfil: true,
            },
          },
        },
      });

    const historicoFormatado = movimentacoes.map((movimentacao) => {
      const dataHora = new Date(movimentacao.criadoEm);

      const data = dataHora.toLocaleDateString("pt-BR", {
        timeZone: "America/Sao_Paulo",
      });

      const hora = dataHora.toLocaleTimeString("pt-BR", {
        timeZone: "America/Sao_Paulo",
      });

      return {
        ...movimentacao,
        data,
        hora,
      };
    });

    return res.status(200).json(historicoFormatado);

  } catch (erro) {
    console.error(erro);

    return res.status(500).json({
      erro: "Erro interno ao listar movimentações.",
    });
  }
});

// ========================================
// PRODUTOS COM ESTOQUE BAIXO
// GET /api/estoque/baixo
// ========================================

router.get("/baixo", autenticarToken, async (req, res) => {
  try {
    const produtos = await prisma.produto.findMany({
      where: {
        ativo: true,
      },
      orderBy: {
        nome: "asc",
      },
    });

    const estoqueBaixo = produtos.filter(
      (produto) =>
        produto.estoque <= produto.estoqueMinimo
    );

    return res.status(200).json({
      total: estoqueBaixo.length,
      produtos: estoqueBaixo,
    });

  } catch (erro) {
    console.error(erro);

    return res.status(500).json({
      erro: "Erro interno ao consultar estoque baixo.",
    });
  }
});

export default router;