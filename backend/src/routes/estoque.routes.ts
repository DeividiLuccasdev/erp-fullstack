import { Router } from "express";

import { autenticarToken } from "../middlewares/auth.js";
import type { RequestAutenticada } from "../middlewares/auth.js";

import { prisma } from "../config/prisma.js";
import { ErroHttp, responderErro } from "../lib/erros.js";
import {
  enviarResposta,
  executarIdempotente,
} from "../lib/idempotencia.js";

const router = Router();

// Valida o corpo comum de entrada e saída
function lerMovimentacao(corpo: Record<string, unknown> | undefined) {
  const { produtoId, quantidade, observacao } = corpo ?? {};

  if (!produtoId || typeof produtoId !== "string" || !quantidade) {
    throw new ErroHttp(400, "Produto e quantidade são obrigatórios.");
  }

  const quantidadeNumero = Number(quantidade);

  if (
    !Number.isInteger(quantidadeNumero) ||
    quantidadeNumero <= 0
  ) {
    throw new ErroHttp(
      400,
      "A quantidade deve ser um número inteiro maior que zero."
    );
  }

  return {
    produtoId,
    quantidade: quantidadeNumero,
    observacao: typeof observacao === "string" && observacao
      ? observacao
      : null,
  };
}

// ========================================
// ENTRADA DE ESTOQUE
// POST /api/estoque/entrada
// Aceita o cabeçalho Idempotency-Key
// ========================================

router.post("/entrada", autenticarToken, async (req, res) => {
  try {
    const requisicao = req as RequestAutenticada;
    const dados = lerMovimentacao(req.body);

    const resposta = await executarIdempotente(requisicao, async (tx) => {
      // increment é atômico; se o produto não existir, P2025 vira 404
      const produtoAtualizado = await tx.produto.update({
        where: {
          id: dados.produtoId,
        },
        data: {
          estoque: {
            increment: dados.quantidade,
          },
        },
      });

      const movimentacao = await tx.movimentacaoEstoque.create({
        data: {
          produtoId: dados.produtoId,
          usuarioId: requisicao.usuario!.usuarioId,
          tipo: "ENTRADA",
          quantidade: dados.quantidade,
          observacao: dados.observacao,
        },
      });

      return {
        status: 201,
        corpo: {
          mensagem: "Entrada de estoque registrada com sucesso.",
          estoqueAtual: produtoAtualizado.estoque,
          movimentacao,
        },
      };
    });

    return enviarResposta(res, resposta);

  } catch (erro) {
    return responderErro(
      res,
      erro,
      "Erro interno ao registrar entrada de estoque.",
      { naoEncontrado: "Produto não encontrado." }
    );
  }
});

// ========================================
// SAÍDA DE ESTOQUE
// POST /api/estoque/saida
// Aceita o cabeçalho Idempotency-Key
// ========================================

router.post("/saida", autenticarToken, async (req, res) => {
  try {
    const requisicao = req as RequestAutenticada;
    const dados = lerMovimentacao(req.body);

    const resposta = await executarIdempotente(requisicao, async (tx) => {
      // Baixa só se ainda houver saldo, num único UPDATE: duas saídas
      // simultâneas não conseguem passar ambas pela conferência
      const baixa = await tx.produto.updateMany({
        where: {
          id: dados.produtoId,
          estoque: {
            gte: dados.quantidade,
          },
        },
        data: {
          estoque: {
            decrement: dados.quantidade,
          },
        },
      });

      if (baixa.count === 0) {
        const atual = await tx.produto.findUnique({
          where: {
            id: dados.produtoId,
          },
        });

        if (!atual) {
          throw new ErroHttp(404, "Produto não encontrado.");
        }

        throw new ErroHttp(409, "Estoque insuficiente.", {
          estoqueAtual: atual.estoque,
        });
      }

      const produtoAtualizado = await tx.produto.findUniqueOrThrow({
        where: {
          id: dados.produtoId,
        },
      });

      const movimentacao = await tx.movimentacaoEstoque.create({
        data: {
          produtoId: dados.produtoId,
          usuarioId: requisicao.usuario!.usuarioId,
          tipo: "SAIDA",
          quantidade: dados.quantidade,
          observacao: dados.observacao,
        },
      });

      return {
        status: 201,
        corpo: {
          mensagem: "Saída de estoque registrada com sucesso.",
          estoqueAtual: produtoAtualizado.estoque,
          movimentacao,
        },
      };
    });

    return enviarResposta(res, resposta);

  } catch (erro) {
    return responderErro(
      res,
      erro,
      "Erro interno ao registrar saída de estoque."
    );
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