import { Router } from "express";

import {
  autenticarToken,
  autorizarPerfil,
} from "../middlewares/auth.js";
import type { RequestAutenticada } from "../middlewares/auth.js";

import { prisma } from "../config/prisma.js";

const router = Router();

// Valida os campos numéricos do produto. Retorna a mensagem de erro,
// ou null se estiver tudo certo. Campos não informados são ignorados.
function validarNumeros(dados: {
  preco?: unknown;
  estoque?: unknown;
  estoqueMinimo?: unknown;
}): string | null {
  if (dados.preco !== undefined) {
    const preco = Number(dados.preco);

    if (!Number.isFinite(preco) || preco < 0) {
      return "O preço deve ser um número maior ou igual a zero.";
    }
  }

  for (const [campo, nome] of [
    ["estoque", "O estoque"],
    ["estoqueMinimo", "O estoque mínimo"],
  ] as const) {
    const valor = dados[campo];

    if (valor !== undefined && valor !== null) {
      const numero = Number(valor);

      if (!Number.isInteger(numero) || numero < 0) {
        return `${nome} deve ser um número inteiro maior ou igual a zero.`;
      }
    }
  }

  return null;
}

// CADASTRAR PRODUTO
router.post("/", autenticarToken, async (req, res) => {
  try {
    const {
      nome,
      codigo,
      descricao,
      preco,
      estoque,
      estoqueMinimo,
    } = req.body;

    if (!nome || !codigo || preco === undefined) {
      return res.status(400).json({
        erro: "Nome, código e preço são obrigatórios.",
      });
    }

    const erroNumeros = validarNumeros({ preco, estoque, estoqueMinimo });

    if (erroNumeros) {
      return res.status(400).json({
        erro: erroNumeros,
      });
    }

    const produtoExistente = await prisma.produto.findUnique({
      where: { codigo },
    });

    if (produtoExistente) {
      return res.status(409).json({
        erro: "Já existe um produto com este código.",
      });
    }

    const estoqueInicial = Number(estoque ?? 0);

    const produto = await prisma.$transaction(async (tx) => {
      const criado = await tx.produto.create({
        data: {
          nome,
          codigo,
          descricao: descricao || null,
          preco: Number(preco),
          estoque: estoqueInicial,
          estoqueMinimo: Number(estoqueMinimo ?? 0),
        },
      });

      // Saldo inicial também entra no histórico de movimentações
      if (estoqueInicial > 0) {
        await tx.movimentacaoEstoque.create({
          data: {
            produtoId: criado.id,
            usuarioId: (req as RequestAutenticada).usuario!.usuarioId,
            tipo: "ENTRADA",
            quantidade: estoqueInicial,
            observacao: "Estoque inicial",
          },
        });
      }

      return criado;
    });

    return res.status(201).json(produto);

  } catch (erro) {
    console.error(erro);

    return res.status(500).json({
      erro: "Erro interno ao cadastrar produto.",
    });
  }
});

// LISTAR PRODUTOS
router.get("/", autenticarToken, async (req, res) => {
  try {
    const produtos = await prisma.produto.findMany({
      orderBy: {
        nome: "asc",
      },
    });

    return res.status(200).json(produtos);

  } catch (erro) {
    console.error(erro);

    return res.status(500).json({
      erro: "Erro interno ao listar produtos.",
    });
  }
});

// BUSCAR PRODUTO POR ID
router.get("/:id", autenticarToken, async (req, res) => {
  try {
    const idParam = req.params.id;

    if (typeof idParam !== "string") {
      return res.status(400).json({
        erro: "ID do produto não informado.",
      });
    }

    const produto = await prisma.produto.findUnique({
      where: {
        id: idParam,
      },
    });

    if (!produto) {
      return res.status(404).json({
        erro: "Produto não encontrado.",
      });
    }

    return res.status(200).json(produto);

  } catch (erro) {
    console.error(erro);

    return res.status(500).json({
      erro: "Erro interno ao buscar produto.",
    });
  }
});

// EDITAR PRODUTO
router.put("/:id", autenticarToken, async (req, res) => {
  try {
    const idParam = req.params.id;

    if (typeof idParam !== "string") {
      return res.status(400).json({
        erro: "ID do produto não informado.",
      });
    }

    const id = idParam;

    const {
      nome,
      codigo,
      descricao,
      preco,
      estoqueMinimo,
      ativo,
    } = req.body;

    if (!nome || !codigo || preco === undefined) {
      return res.status(400).json({
        erro: "Nome, código e preço são obrigatórios.",
      });
    }

    const erroNumeros = validarNumeros({ preco, estoqueMinimo });

    if (erroNumeros) {
      return res.status(400).json({
        erro: erroNumeros,
      });
    }

    const produtoExistente = await prisma.produto.findUnique({
      where: { id },
    });

    if (!produtoExistente) {
      return res.status(404).json({
        erro: "Produto não encontrado.",
      });
    }

    const produtoComMesmoCodigo =
      await prisma.produto.findUnique({
        where: { codigo },
      });

    if (
      produtoComMesmoCodigo &&
      produtoComMesmoCodigo.id !== id
    ) {
      return res.status(409).json({
        erro: "Já existe outro produto com este código.",
      });
    }

    const produtoAtualizado = await prisma.produto.update({
      where: { id },

      data: {
        nome,
        codigo,
        descricao: descricao || null,
        preco: Number(preco),
        // O saldo só muda por entrada/saída de estoque ou venda, para
        // que toda alteração fique registrada nas movimentações
        estoqueMinimo: Number(
          estoqueMinimo ?? produtoExistente.estoqueMinimo
        ),
        ativo:
          (req as RequestAutenticada).usuario?.perfil === "ADMIN" &&
          typeof ativo === "boolean"
            ? ativo
            : produtoExistente.ativo,
      },
    });

    return res.status(200).json(produtoAtualizado);

  } catch (erro) {
    console.error(erro);

    return res.status(500).json({
      erro: "Erro interno ao atualizar produto.",
    });
  }
});

// EXCLUIR PRODUTO - ADMIN
router.delete(
  "/:id",
  autenticarToken,
  autorizarPerfil("ADMIN"),
  async (req, res) => {
    try {
      const idParam = req.params.id;

      if (typeof idParam !== "string") {
        return res.status(400).json({
          erro: "ID do produto não informado.",
        });
      }

      const produto = await prisma.produto.findUnique({
        where: {
          id: idParam,
        },
      });

      if (!produto) {
        return res.status(404).json({
          erro: "Produto não encontrado.",
        });
      }

      const [movimentacoes, itens] = await Promise.all([
        prisma.movimentacaoEstoque.count({
          where: { produtoId: idParam },
        }),
        prisma.itemPedido.count({
          where: { produtoId: idParam },
        }),
      ]);

      // Produto com histórico não pode sumir: as movimentações e os
      // pedidos apontam para ele. Nesse caso ele só é desativado.
      if (movimentacoes > 0 || itens > 0) {
        await prisma.produto.update({
          where: { id: idParam },
          data: { ativo: false },
        });

        return res.status(200).json({
          mensagem:
            "O produto tem histórico de estoque ou vendas e foi desativado.",
        });
      }

      await prisma.produto.delete({
        where: {
          id: idParam,
        },
      });

      return res.status(200).json({
        mensagem: "Produto excluído com sucesso.",
      });

    } catch (erro) {
      console.error(erro);

      return res.status(500).json({
        erro: "Erro interno ao excluir produto.",
      });
    }
  }
);

export default router;