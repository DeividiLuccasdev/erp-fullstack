import { Router } from "express";

import {
  autenticarToken,
  autorizarPerfil,
} from "../middlewares/auth.js";

import { prisma } from "../config/prisma.js";

const router = Router();

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

    if (Number(preco) < 0) {
      return res.status(400).json({
        erro: "O preço não pode ser negativo.",
      });
    }

    if (estoque !== undefined && Number(estoque) < 0) {
      return res.status(400).json({
        erro: "O estoque não pode ser negativo.",
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

    const produto = await prisma.produto.create({
      data: {
        nome,
        codigo,
        descricao: descricao || null,
        preco: Number(preco),
        estoque: Number(estoque ?? 0),
        estoqueMinimo: Number(estoqueMinimo ?? 0),
      },
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
      estoque,
      estoqueMinimo,
      ativo,
    } = req.body;

    if (!nome || !codigo || preco === undefined) {
      return res.status(400).json({
        erro: "Nome, código e preço são obrigatórios.",
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
        estoque: Number(estoque ?? produtoExistente.estoque),
        estoqueMinimo: Number(
          estoqueMinimo ?? produtoExistente.estoqueMinimo
        ),
        ativo: ativo ?? produtoExistente.ativo,
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