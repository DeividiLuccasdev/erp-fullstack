import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

import { prisma } from "../config/prisma.js";

const router = Router();

// ========================================
// LOGIN
// POST /api/auth/login
// ========================================

router.post("/login", async (req, res) => {
  try {
    const {
      email,
      senha
    } = req.body;

    if (!email || !senha) {
      return res.status(400).json({
        erro: "E-mail e senha são obrigatórios."
      });
    }

    const usuario = await prisma.usuario.findUnique({
      where: {
        email
      }
    });

    if (!usuario) {
      return res.status(401).json({
        erro: "E-mail ou senha inválidos."
      });
    }

    if (!usuario.ativo) {
      return res.status(403).json({
        erro: "Usuário inativo."
      });
    }

    const senhaValida = await bcrypt.compare(
      senha,
      usuario.senhaHash
    );

    if (!senhaValida) {
      return res.status(401).json({
        erro: "E-mail ou senha inválidos."
      });
    }

    const segredoJwt = process.env.JWT_SECRET;

    if (!segredoJwt) {
      throw new Error("JWT_SECRET não configurado.");
    }

    const token = jwt.sign(
      {
        usuarioId: usuario.id,
        perfil: usuario.perfil
      },
      segredoJwt,
      {
        expiresIn: "8h"
      }
    );

    return res.status(200).json({
      mensagem: "Login realizado com sucesso.",
      usuario: {
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
        perfil: usuario.perfil
      },
      token
    });

  } catch (erro) {
    console.error(erro);

    return res.status(500).json({
      erro: "Erro interno ao realizar login."
    });
  }
});

export default router;