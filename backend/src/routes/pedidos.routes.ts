import { Router } from "express";

import { autenticarToken } from "../middlewares/auth.js";
import type { RequestAutenticada } from "../middlewares/auth.js";

import { prisma } from "../config/prisma.js";

const router = Router();

// ========================================
// CRIAR PEDIDO
// POST /api/pedidos
// ========================================

router.post("/", autenticarToken, async (req, res) => {
  try {
    const requisicao = req as RequestAutenticada;

    if (!requisicao.usuario) {
      return res.status(401).json({
        erro: "Usuário não autenticado.",
      });
    }

    const { clienteId } = req.body;

    if (clienteId) {
      const cliente = await prisma.cliente.findUnique({
        where: {
          id: clienteId,
        },
      });

      if (!cliente) {
        return res.status(404).json({
          erro: "Cliente não encontrado.",
        });
      }
    }

    const pedido = await prisma.pedido.create({
      data: {
        clienteId: clienteId || null,
        usuarioId: requisicao.usuario.usuarioId,
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

    return res.status(201).json({
      mensagem: "Pedido criado com sucesso.",
      pedido,
    });

  } catch (erro) {
    console.error(erro);

    return res.status(500).json({
      erro: "Erro interno ao criar pedido.",
    });
  }
});

// ========================================
// ADICIONAR ITEM AO PEDIDO
// POST /api/pedidos/:id/itens
// ========================================

router.post("/:id/itens", autenticarToken, async (req, res) => {
  try {
    const idParam = req.params.id;

    if (typeof idParam !== "string") {
      return res.status(400).json({
        erro: "ID do pedido não informado.",
      });
    }

    const pedidoId: string = idParam;

    const {
      produtoId,
      quantidade,
    } = req.body;

    const quantidadeNumero = Number(quantidade);

    if (!produtoId) {
      return res.status(400).json({
        erro: "Produto é obrigatório.",
      });
    }

    if (
      !Number.isInteger(quantidadeNumero) ||
      quantidadeNumero <= 0
    ) {
      return res.status(400).json({
        erro: "A quantidade deve ser um número inteiro maior que zero.",
      });
    }

    const pedido = await prisma.pedido.findUnique({
      where: {
        id: pedidoId,
      },
    });

    if (!pedido) {
      return res.status(404).json({
        erro: "Pedido não encontrado.",
      });
    }

    if (pedido.status !== "ABERTO") {
      return res.status(409).json({
        erro: "Só é possível adicionar itens a pedidos abertos.",
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

    if (!produto.ativo) {
      return res.status(409).json({
        erro: "Produto inativo.",
      });
    }

    const precoUnitario = Number(produto.preco);
    const subtotal = precoUnitario * quantidadeNumero;

    const resultado = await prisma.$transaction(async (tx) => {
      const item = await tx.itemPedido.create({
        data: {
          pedidoId,
          produtoId,
          quantidade: quantidadeNumero,
          precoUnitario,
          subtotal,
        },
      });

      const pedidoAtualizado = await tx.pedido.update({
        where: {
          id: pedidoId,
        },
        data: {
          total: {
            increment: subtotal,
          },
        },
      });

      return {
        item,
        pedidoAtualizado,
      };
    });

    return res.status(201).json({
      mensagem: "Item adicionado ao pedido com sucesso.",
      item: resultado.item,
      totalPedido: resultado.pedidoAtualizado.total,
    });

  } catch (erro) {
    console.error(erro);

    return res.status(500).json({
      erro: "Erro interno ao adicionar item ao pedido.",
    });
  }
});

// ========================================
// FINALIZAR PEDIDO
// POST /api/pedidos/:id/finalizar
// ========================================

router.post(
  "/:id/finalizar",
  autenticarToken,
  async (req, res) => {
    try {
      const requisicao = req as RequestAutenticada;

      if (!requisicao.usuario) {
        return res.status(401).json({
          erro: "Usuário não autenticado.",
        });
      }

      const idParam = req.params.id;

      if (typeof idParam !== "string") {
        return res.status(400).json({
          erro: "ID do pedido não informado.",
        });
      }

      const pedidoId: string = idParam;

      const pedido = await prisma.pedido.findUnique({
        where: {
          id: pedidoId,
        },

        include: {
          itens: {
            include: {
              produto: true,
            },
          },
        },
      });

      if (!pedido) {
        return res.status(404).json({
          erro: "Pedido não encontrado.",
        });
      }

      if (pedido.status !== "ABERTO") {
        return res.status(409).json({
          erro: "Este pedido não está aberto.",
        });
      }

      if (pedido.itens.length === 0) {
        return res.status(409).json({
          erro: "Não é possível finalizar um pedido sem itens.",
        });
      }

      const resultado = await prisma.$transaction(async (tx) => {
        for (const item of pedido.itens) {
          const atualizacao = await tx.produto.updateMany({
            where: {
              id: item.produtoId,
              estoque: {
                gte: item.quantidade,
              },
            },

            data: {
              estoque: {
                decrement: item.quantidade,
              },
            },
          });

          if (atualizacao.count === 0) {
            throw new Error(
              `ESTOQUE_INSUFICIENTE:${item.produto.nome}`
            );
          }

          await tx.movimentacaoEstoque.create({
            data: {
              produtoId: item.produtoId,
              usuarioId: requisicao.usuario!.usuarioId,
              tipo: "SAIDA",
              quantidade: item.quantidade,
              observacao: `Venda - Pedido ${pedidoId}`,
            },
          });
        }

        const pedidoFinalizado = await tx.pedido.update({
          where: {
            id: pedidoId,
          },

          data: {
            status: "FINALIZADO",
            finalizadoEm: new Date(),
          },
        });

        return pedidoFinalizado;
      });

      return res.status(200).json({
        mensagem: "Pedido finalizado com sucesso.",
        pedido: resultado,
      });

    } catch (erro) {
      if (
        erro instanceof Error &&
        erro.message.startsWith("ESTOQUE_INSUFICIENTE:")
      ) {
        const produto = erro.message.split(":")[1];

        return res.status(409).json({
          erro: `Estoque insuficiente para o produto: ${produto}.`,
        });
      }

      console.error(erro);

      return res.status(500).json({
        erro: "Erro interno ao finalizar pedido.",
      });
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

      const pedidoCancelado = await prisma.pedido.update({
        where: {
          id: idParam,
        },

        data: {
          status: "CANCELADO",
          canceladoEm: new Date(),
        },
      });

      return res.status(200).json({
        mensagem: "Pedido cancelado com sucesso.",
        pedido: pedidoCancelado,
      });

    } catch (erro) {
      console.error(erro);

      return res.status(500).json({
        erro: "Erro interno ao cancelar pedido.",
      });
    }
  }
);

export default router;