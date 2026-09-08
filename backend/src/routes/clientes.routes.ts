import { Router } from "express";

import {
  autenticarToken,
  autorizarPerfil,
} from "../middlewares/auth.js";

import { prisma } from "../config/prisma.js";

const router = Router();

// ========================================
// CADASTRAR CLIENTE
// POST /api/clientes
// ========================================

router.post("/", autenticarToken, async (req, res) => {
  try {
    const {
      nome,
      cpf,
      email,
      telefone,
      cidade,
    } = req.body;

    if (!nome) {
      return res.status(400).json({
        erro: "Nome do cliente é obrigatório.",
      });
    }

    if (cpf) {
      const clienteExistente =
        await prisma.cliente.findUnique({
          where: {
            cpf,
          },
        });

      if (clienteExistente) {
        return res.status(409).json({
          erro: "Já existe um cliente com este CPF.",
        });
      }
    }

    const cliente = await prisma.cliente.create({
      data: {
        nome,
        cpf: cpf || null,
        email: email || null,
        telefone: telefone || null,
        cidade: cidade || null,
      },
    });

    return res.status(201).json(cliente);

  } catch (erro) {
    console.error(erro);

    return res.status(500).json({
      erro: "Erro interno ao cadastrar cliente.",
    });
  }
});

// ========================================
// LISTAR CLIENTES
// GET /api/clientes
// ========================================

router.get("/", autenticarToken, async (req, res) => {
  try {
    const clientes = await prisma.cliente.findMany({
      where: {
        ativo: true,
      },
      orderBy: {
        nome: "asc",
      },
    });

    return res.status(200).json(clientes);

  } catch (erro) {
    console.error(erro);

    return res.status(500).json({
      erro: "Erro interno ao listar clientes.",
    });
  }
});

// ========================================
// BUSCAR CLIENTE POR ID
// GET /api/clientes/:id
// ========================================

router.get("/:id", autenticarToken, async (req, res) => {
  try {
    const idParam = req.params.id;

    if (typeof idParam !== "string") {
      return res.status(400).json({
        erro: "ID do cliente não informado.",
      });
    }

    const id: string = idParam;

    const cliente = await prisma.cliente.findUnique({
      where: {
        id,
      },
    });

    if (!cliente) {
      return res.status(404).json({
        erro: "Cliente não encontrado.",
      });
    }

    return res.status(200).json(cliente);

  } catch (erro) {
    console.error(erro);

    return res.status(500).json({
      erro: "Erro interno ao buscar cliente.",
    });
  }
});

// ========================================
// EDITAR CLIENTE
// PUT /api/clientes/:id
// ========================================

router.put("/:id", autenticarToken, async (req, res) => {
  try {
    const idParam = req.params.id;

    if (typeof idParam !== "string") {
      return res.status(400).json({
        erro: "ID do cliente não informado.",
      });
    }

    const id: string = idParam;

    const {
      nome,
      cpf,
      email,
      telefone,
      cidade,
      ativo,
    } = req.body;

    if (!nome) {
      return res.status(400).json({
        erro: "Nome do cliente é obrigatório.",
      });
    }

    const clienteExistente =
      await prisma.cliente.findUnique({
        where: {
          id,
        },
      });

    if (!clienteExistente) {
      return res.status(404).json({
        erro: "Cliente não encontrado.",
      });
    }

    if (cpf) {
      const clienteComCpf =
        await prisma.cliente.findUnique({
          where: {
            cpf,
          },
        });

      if (
        clienteComCpf &&
        clienteComCpf.id !== id
      ) {
        return res.status(409).json({
          erro: "Já existe outro cliente com este CPF.",
        });
      }
    }

    const clienteAtualizado =
      await prisma.cliente.update({
        where: {
          id,
        },
        data: {
          nome,
          cpf: cpf || null,
          email: email || null,
          telefone: telefone || null,
          cidade: cidade || null,
          ativo: ativo ?? clienteExistente.ativo,
        },
      });

    return res.status(200).json(clienteAtualizado);

  } catch (erro) {
    console.error(erro);

    return res.status(500).json({
      erro: "Erro interno ao atualizar cliente.",
    });
  }
});

// ========================================
// EXCLUIR CLIENTE
// DELETE /api/clientes/:id
// SOMENTE ADMIN
// ========================================

router.delete(
  "/:id",
  autenticarToken,
  autorizarPerfil("ADMIN"),
  async (req, res) => {
    try {
      const idParam = req.params.id;

      if (typeof idParam !== "string") {
        return res.status(400).json({
          erro: "ID do cliente não informado.",
        });
      }

      const id: string = idParam;

      const cliente = await prisma.cliente.findUnique({
        where: {
          id,
        },
      });

      if (!cliente) {
        return res.status(404).json({
          erro: "Cliente não encontrado.",
        });
      }

      await prisma.cliente.update({
        where: {
          id,
        },
        data: {
          ativo: false,
          excluidoEm: new Date(),
        },
      });

      return res.status(200).json({
        mensagem: "Cliente excluído com sucesso.",
      });

    } catch (erro) {
      console.error(erro);

      return res.status(500).json({
        erro: "Erro interno ao excluir cliente.",
      });
    }
  }
);

export default router;