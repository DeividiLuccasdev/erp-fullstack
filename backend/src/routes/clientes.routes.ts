import { Router } from "express";

import {
  autenticarToken,
  autorizarPerfil,
} from "../middlewares/auth.js";
import type { RequestAutenticada } from "../middlewares/auth.js";

import { prisma } from "../config/prisma.js";
import { responderErro } from "../lib/erros.js";
import { Prisma } from "../../generated/prisma/client.ts";

const router = Router();

function podeAlterarAtivo(req: unknown) {
  return (req as RequestAutenticada).usuario?.perfil === "ADMIN";
}

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

    // Sem consultar antes: o índice único de "cpf" decide (P2002 → 409),
    // o que também vale para dois cadastros simultâneos
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
    let unico = "Já existe um cliente com este CPF.";

    if (
      erro instanceof Prisma.PrismaClientKnownRequestError &&
      erro.code === "P2002" &&
      req.body?.cpf
    ) {
      // Só para escolher a mensagem; a decisão já foi do banco
      const existente = await prisma.cliente
        .findUnique({ where: { cpf: req.body.cpf } })
        .catch(() => null);

      if (existente?.excluidoEm) {
        unico = "Este CPF pertence a um cliente excluído.";
      }
    }

    return responderErro(res, erro, "Erro interno ao cadastrar cliente.", {
      unico,
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
          // Ativar ou desativar equivale a excluir, que é só do ADMIN
          ativo: podeAlterarAtivo(req) && typeof ativo === "boolean"
            ? ativo
            : clienteExistente.ativo,
        },
      });

    return res.status(200).json(clienteAtualizado);

  } catch (erro) {
    return responderErro(res, erro, "Erro interno ao atualizar cliente.", {
      unico: "Já existe outro cliente com este CPF.",
      naoEncontrado: "Cliente não encontrado.",
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
      return responderErro(res, erro, "Erro interno ao excluir cliente.", {
        naoEncontrado: "Cliente não encontrado.",
      });
    }
  }
);

export default router;