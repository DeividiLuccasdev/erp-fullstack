import { Router } from "express";

import { autenticarToken } from "../middlewares/auth.js";
import type { RequestAutenticada } from "../middlewares/auth.js";

import { prisma } from "../config/prisma.js";
import { Prisma } from "../../generated/prisma/client.ts";
import { ErroHttp, responderErro } from "../lib/erros.js";
import {
  enviarResposta,
  executarIdempotente,
} from "../lib/idempotencia.js";

const router = Router();

function lerIdPedido(idParam: unknown): string {
  if (typeof idParam !== "string") {
    throw new ErroHttp(400, "ID do pedido não informado.");
  }

  return idParam;
}

// ========================================
// CRIAR PEDIDO
// POST /api/pedidos
// Aceita o cabeçalho Idempotency-Key
// ========================================

router.post("/", autenticarToken, async (req, res) => {
  try {
    const requisicao = req as RequestAutenticada;
    const { clienteId } = req.body ?? {};

    const resposta = await executarIdempotente(requisicao, async (tx) => {
      if (clienteId) {
        const cliente = await tx.cliente.findUnique({
          where: {
            id: clienteId,
          },
        });

        if (!cliente || !cliente.ativo) {
          throw new ErroHttp(404, "Cliente não encontrado.");
        }
      }

      const pedido = await tx.pedido.create({
        data: {
          clienteId: clienteId || null,
          usuarioId: requisicao.usuario!.usuarioId,
          status: "ABERTO",
          total: 0,
        },

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
      });

      return {
        status: 201,
        corpo: {
          mensagem: "Pedido criado com sucesso.",
          pedido,
        },
      };
    });

    return enviarResposta(res, resposta);

  } catch (erro) {
    return responderErro(res, erro, "Erro interno ao criar pedido.", {
      referencia: "Cliente não encontrado.",
    });
  }
});

// ========================================
// ADICIONAR ITEM AO PEDIDO
// POST /api/pedidos/:id/itens
// Aceita o cabeçalho Idempotency-Key
// ========================================

router.post("/:id/itens", autenticarToken, async (req, res) => {
  try {
    const requisicao = req as RequestAutenticada;
    const pedidoId = lerIdPedido(req.params.id);

    const {
      produtoId,
      quantidade,
    } = req.body ?? {};

    const quantidadeNumero = Number(quantidade);

    if (!produtoId || typeof produtoId !== "string") {
      throw new ErroHttp(400, "Produto é obrigatório.");
    }

    if (
      !Number.isInteger(quantidadeNumero) ||
      quantidadeNumero <= 0
    ) {
      throw new ErroHttp(
        400,
        "A quantidade deve ser um número inteiro maior que zero."
      );
    }

    const resposta = await executarIdempotente(requisicao, async (tx) => {
      // Preço e "ativo" lidos dentro da transação, junto com a escrita
      const produto = await tx.produto.findUnique({
        where: {
          id: produtoId,
        },
      });

      if (!produto) {
        throw new ErroHttp(404, "Produto não encontrado.");
      }

      if (!produto.ativo) {
        throw new ErroHttp(409, "Produto inativo.");
      }

      // Decimal evita erro de arredondamento de ponto flutuante
      const precoUnitario = produto.preco;
      const subtotal = precoUnitario.mul(quantidadeNumero);

      // Soma o total só se o pedido ainda estiver ABERTO. Este UPDATE trava
      // a linha do pedido até o commit: a finalização simultânea espera por
      // ele (e então enxerga o item) ou já terminou (e aqui count = 0).
      const atualizacao = await tx.pedido.updateMany({
        where: {
          id: pedidoId,
          status: "ABERTO",
        },
        data: {
          total: {
            increment: subtotal,
          },
        },
      });

      if (atualizacao.count === 0) {
        const existe = await tx.pedido.findUnique({
          where: {
            id: pedidoId,
          },
          select: {
            id: true,
          },
        });

        if (!existe) {
          throw new ErroHttp(404, "Pedido não encontrado.");
        }

        throw new ErroHttp(
          409,
          "Só é possível adicionar itens a pedidos abertos."
        );
      }

      const item = await tx.itemPedido.create({
        data: {
          pedidoId,
          produtoId,
          quantidade: quantidadeNumero,
          precoUnitario,
          subtotal,
        },
      });

      const pedidoAtualizado = await tx.pedido.findUniqueOrThrow({
        where: {
          id: pedidoId,
        },
      });

      return {
        status: 201,
        corpo: {
          mensagem: "Item adicionado ao pedido com sucesso.",
          item,
          totalPedido: pedidoAtualizado.total,
        },
      };
    });

    return enviarResposta(res, resposta);

  } catch (erro) {
    return responderErro(
      res,
      erro,
      "Erro interno ao adicionar item ao pedido."
    );
  }
});

// ========================================
// FINALIZAR PEDIDO
// POST /api/pedidos/:id/finalizar
// Aceita o cabeçalho Idempotency-Key
// ========================================

router.post(
  "/:id/finalizar",
  autenticarToken,
  async (req, res) => {
    try {
      const requisicao = req as RequestAutenticada;
      const pedidoId = lerIdPedido(req.params.id);

      const resposta = await executarIdempotente(requisicao, async (tx) => {
        // Muda o status primeiro e só se ainda estiver ABERTO. O UPDATE
        // trava a linha do pedido: duas finalizações simultâneas não baixam
        // o estoque em dobro, e um item sendo adicionado ao mesmo tempo ou
        // já foi gravado (e entra abaixo) ou recebe 409.
        const mudanca = await tx.pedido.updateMany({
          where: {
            id: pedidoId,
            status: "ABERTO",
          },

          data: {
            status: "FINALIZADO",
            finalizadoEm: new Date(),
          },
        });

        if (mudanca.count === 0) {
          const existe = await tx.pedido.findUnique({
            where: {
              id: pedidoId,
            },
            select: {
              id: true,
            },
          });

          if (!existe) {
            throw new ErroHttp(404, "Pedido não encontrado.");
          }

          throw new ErroHttp(409, "Este pedido não está aberto.");
        }

        // Itens lidos DEPOIS da trava, dentro da transação: é exatamente
        // o que ficará no pedido finalizado
        const itens = await tx.itemPedido.findMany({
          where: {
            pedidoId,
          },
        });

        if (itens.length === 0) {
          throw new ErroHttp(
            409,
            "Não é possível finalizar um pedido sem itens."
          );
        }

        // Agrupa por produto e baixa em ordem de id: duas vendas com os
        // mesmos produtos em ordens diferentes travam as linhas na mesma
        // ordem e não entram em deadlock
        const quantidadePorProduto = new Map<string, number>();

        for (const item of itens) {
          quantidadePorProduto.set(
            item.produtoId,
            (quantidadePorProduto.get(item.produtoId) ?? 0) +
              item.quantidade
          );
        }

        const produtosOrdenados = [...quantidadePorProduto.keys()].sort();

        for (const produtoId of produtosOrdenados) {
          const quantidade = quantidadePorProduto.get(produtoId)!;

          const atualizacao = await tx.produto.updateMany({
            where: {
              id: produtoId,
              ativo: true,
              estoque: {
                gte: quantidade,
              },
            },

            data: {
              estoque: {
                decrement: quantidade,
              },
            },
          });

          if (atualizacao.count === 0) {
            const produto = await tx.produto.findUniqueOrThrow({
              where: {
                id: produtoId,
              },
            });

            throw new ErroHttp(
              409,
              produto.ativo
                ? `Estoque insuficiente para o produto: ${produto.nome}.`
                : `Produto inativo: ${produto.nome}.`
            );
          }

          await tx.movimentacaoEstoque.create({
            data: {
              produtoId,
              usuarioId: requisicao.usuario!.usuarioId,
              tipo: "SAIDA",
              quantidade,
              observacao: `Venda - Pedido ${pedidoId}`,
            },
          });
        }

        // Recalcula o total a partir dos itens que de fato foram vendidos
        const total = itens.reduce(
          (soma, item) => soma.add(item.subtotal),
          new Prisma.Decimal(0)
        );

        const pedido = await tx.pedido.update({
          where: {
            id: pedidoId,
          },
          data: {
            total,
          },
        });

        return {
          status: 200,
          corpo: {
            mensagem: "Pedido finalizado com sucesso.",
            pedido,
          },
        };
      });

      return enviarResposta(res, resposta);

    } catch (erro) {
      return responderErro(res, erro, "Erro interno ao finalizar pedido.");
    }
  }
);

// ========================================
// LISTAR PEDIDOS
// GET /api/pedidos
// ========================================

router.get("/", autenticarToken, async (req, res) => {
  try {
    const pedidos = await prisma.pedido.findMany({
      orderBy: {
        criadoEm: "desc",
      },

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

        _count: {
          select: {
            itens: true,
          },
        },
      },
    });

    return res.status(200).json(pedidos);

  } catch (erro) {
    console.error(erro);

    return res.status(500).json({
      erro: "Erro interno ao listar pedidos.",
    });
  }
});

// ========================================
// DETALHES DO PEDIDO
// GET /api/pedidos/:id
// ========================================

router.get("/:id", autenticarToken, async (req, res) => {
  try {
    const idParam = req.params.id;

    if (typeof idParam !== "string") {
      return res.status(400).json({
        erro: "ID do pedido não informado.",
      });
    }

    const pedido = await prisma.pedido.findUnique({
      where: {
        id: idParam,
      },

      include: {
        cliente: {
          select: {
            id: true,
            nome: true,
            cpf: true,
            email: true,
            telefone: true,
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

        itens: {
          include: {
            produto: {
              select: {
                id: true,
                nome: true,
                codigo: true,
              },
            },
          },
        },
      },
    });

    if (!pedido) {
      return res.status(404).json({
        erro: "Pedido não encontrado.",
      });
    }

    return res.status(200).json(pedido);

  } catch (erro) {
    console.error(erro);

    return res.status(500).json({
      erro: "Erro interno ao buscar pedido.",
    });
  }
});

// ========================================
// CANCELAR PEDIDO
// POST /api/pedidos/:id/cancelar
// ========================================

router.post(
  "/:id/cancelar",
  autenticarToken,
  async (req, res) => {
    try {
      const idParam = req.params.id;

      if (typeof idParam !== "string") {
        return res.status(400).json({
          erro: "ID do pedido não informado.",
        });
      }

      const pedido = await prisma.pedido.findUnique({
        where: {
          id: idParam,
        },
      });

      if (!pedido) {
        return res.status(404).json({
          erro: "Pedido não encontrado.",
        });
      }

      if (pedido.status === "FINALIZADO") {
        return res.status(409).json({
          erro: "Pedido finalizado não pode ser cancelado.",
        });
      }

      if (pedido.status === "CANCELADO") {
        return res.status(409).json({
          erro: "Este pedido já está cancelado.",
        });
      }

      // Só cancela se ainda estiver ABERTO (evita cancelar um pedido
      // que outra requisição acabou de finalizar)
      const mudanca = await prisma.pedido.updateMany({
        where: {
          id: idParam,
          status: "ABERTO",
        },

        data: {
          status: "CANCELADO",
          canceladoEm: new Date(),
        },
      });

      if (mudanca.count === 0) {
        return res.status(409).json({
          erro: "Este pedido não está mais aberto.",
        });
      }

      const pedidoCancelado = await prisma.pedido.findUniqueOrThrow({
        where: {
          id: idParam,
        },
      });

      return res.status(200).json({
        mensagem: "Pedido cancelado com sucesso.",
        pedido: pedidoCancelado,
      });

    } catch (erro) {
      return responderErro(res, erro, "Erro interno ao cancelar pedido.");
    }
  }
);

export default router;