import { Router } from "express";
import bcrypt from "bcryptjs";

import {
  autenticarToken,
  autorizarPerfil
} from "../middlewares/auth.js";

import type { RequestAutenticada } from "../middlewares/auth.js";

import { prisma } from "../config/prisma.js";

const router = Router();

// ========================================
// CADASTRO DE USUÁRIO
// POST /api/usuarios
// ========================================

router.post("/usuarios", async (req, res) => {
  try {
    const {
      nome,
      email,
      senha,
      perfil
    } = req.body;

    if (!nome || !email || !senha) {
      return res.status(400).json({
        erro: "Nome, e-mail e senha são obrigatórios."
      });
    }

    const usuarioExistente = await prisma.usuario.findUnique({
      where: {
        email
      }
    });

    if (usuarioExistente) {
      return res.status(409).json({
        erro: "Já existe um usuário com este e-mail."
      });
    }

    const senhaHash = await bcrypt.hash(senha, 10);

    const usuario = await prisma.usuario.create({
      data: {
        nome,
        email,
        senhaHash,
        perfil: perfil || "OPERADOR"
      },
      select: {
        id: true,
        nome: true,
        email: true,
        perfil: true,
        ativo: true,
        criadoEm: true
      }
    });

    return res.status(201).json(usuario);

  } catch (erro) {
    console.error(erro);

    return res.status(500).json({
      erro: "Erro interno ao cadastrar usuário."
    });
  }
});

// ========================================
// PERFIL DO USUÁRIO LOGADO
// GET /api/perfil
// ========================================

router.get("/perfil", autenticarToken, async (req, res) => {
  try {
    const requisicao = req as RequestAutenticada;

    if (!requisicao.usuario) {
      return res.status(401).json({
        erro: "Usuário não autenticado."
      });
    }

    const usuario = await prisma.usuario.findUnique({
      where: {
        id: requisicao.usuario.usuarioId
      },
      select: {
        id: true,
        nome: true,
        email: true,
        perfil: true,
        ativo: true,
        criadoEm: true
      }
    });

    if (!usuario) {
      return res.status(404).json({
        erro: "Usuário não encontrado."
      });
    }

    return res.json(usuario);

  } catch (erro) {
    console.error(erro);

    return res.status(500).json({
      erro: "Erro interno ao buscar perfil."
    });
  }
});

// ========================================
// TESTE DE ACESSO ADMIN
// GET /api/admin/teste
// ========================================

router.get(
  "/admin/teste",
  autenticarToken,
  autorizarPerfil("ADMIN"),
  (req, res) => {
    res.json({
      mensagem: "Acesso ADMIN autorizado!"
    });
  }
);

export default router;