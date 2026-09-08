import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import type { JwtPayload } from "jsonwebtoken";

export interface UsuarioToken {
    usuarioId: string;
    perfil: string;
}

export interface RequestAutenticada extends Request {
    usuario?: UsuarioToken;
}

export function autenticarToken(
    req: Request,
    res: Response,
    next: NextFunction
) {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({
            erro: "Token não informado."
        });
    }

    const token = authHeader.substring(7).trim();

    const segredoJwt = process.env.JWT_SECRET;

    if (!segredoJwt) {
        return res.status(500).json({
            erro: "JWT_SECRET não configurado."
        });
    }

    try {
        const decoded = jwt.verify(
            token,
            segredoJwt
        ) as JwtPayload;

        if (
            typeof decoded.usuarioId !== "string" ||
            typeof decoded.perfil !== "string"
        ) {
            return res.status(401).json({
                erro: "Token inválido."
            });
        }

        const requisicao = req as RequestAutenticada;

        requisicao.usuario = {
            usuarioId: decoded.usuarioId,
            perfil: decoded.perfil
        };

        next();

    } catch (erro) {
        console.error("Erro ao validar JWT:", erro);

        return res.status(401).json({
            erro: "Token inválido ou expirado."
        });
    }
}
export function autorizarPerfil(...perfisPermitidos: string[]) {
    return (
        req: Request,
        res: Response,
        next: NextFunction
    ) => {
        const requisicao = req as RequestAutenticada;

        if (!requisicao.usuario) {
            return res.status(401).json({
                erro: "Usuário não autenticado."
            });
        }

        if (!perfisPermitidos.includes(requisicao.usuario.perfil)) {
            return res.status(403).json({
                erro: "Você não tem permissão para acessar esta rota."
            });
        }

        next();
    };
}