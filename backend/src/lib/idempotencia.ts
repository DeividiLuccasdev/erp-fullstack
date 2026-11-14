import { createHash } from "node:crypto";
import type { Response } from "express";

import { prisma } from "../config/prisma.js";
import { Prisma } from "../../generated/prisma/client.ts";
import type { RequestAutenticada } from "../middlewares/auth.js";

import { ErroHttp } from "./erros.js";
import { executarTransacao } from "./transacao.js";
import type { Tx } from "./transacao.js";

export const CABECALHO_IDEMPOTENCIA = "Idempotency-Key";

const TAMANHO_MAXIMO_CHAVE = 255;

export interface RespostaRota {
  status: number;
  corpo: unknown;
}

// JSON com as chaves em ordem, para que {a,b} e {b,a} tenham o mesmo hash
function ordenar(valor: unknown): unknown {
  if (Array.isArray(valor)) {
    return valor.map(ordenar);
  }

  if (valor && typeof valor === "object") {
    return Object.fromEntries(
      Object.keys(valor as Record<string, unknown>)
        .sort()
        .map((chave) => [
          chave,
          ordenar((valor as Record<string, unknown>)[chave]),
        ])
    );
  }

  return valor;
}

function hashDaRequisicao(req: RequestAutenticada): string {
  const conteudo = JSON.stringify({
    metodo: req.method,
    rota: `${req.baseUrl}${req.path}`,
    corpo: ordenar(req.body ?? null),
  });

  return createHash("sha256").update(conteudo).digest("hex");
}

async function respostaGravada(
  usuarioId: string,
  chave: string,
  hash: string
): Promise<RespostaRota | null> {
  const registro = await prisma.chaveIdempotencia.findUnique({
    where: {
      usuarioId_chave: {
        usuarioId,
        chave,
      },
    },
  });

  if (!registro) {
    return null;
  }

  if (registro.hashRequisicao !== hash) {
    throw new ErroHttp(
      422,
      "Esta Idempotency-Key já foi usada com outra requisição."
    );
  }

  return {
    status: registro.statusResposta,
    corpo: registro.corpoResposta,
  };
}

// Executa a operação numa transação. Com o cabeçalho Idempotency-Key, a
// chave é gravada na MESMA transação que o efeito: uma repetição (duplo
// clique, retry após timeout de rede) devolve a resposta original em vez
// de aplicar o efeito de novo. Só respostas de sucesso ficam gravadas;
// se a operação falhar, tudo é desfeito e a chave pode ser reutilizada.
export async function executarIdempotente(
  req: RequestAutenticada,
  operacao: (tx: Tx) => Promise<RespostaRota>
): Promise<RespostaRota & { repetida: boolean }> {
  const chaveBruta = req.get(CABECALHO_IDEMPOTENCIA);

  if (chaveBruta === undefined) {
    const resposta = await executarTransacao(operacao);
    return { ...resposta, repetida: false };
  }

  const chave = chaveBruta.trim();

  if (!chave || chave.length > TAMANHO_MAXIMO_CHAVE) {
    throw new ErroHttp(
      400,
      `Idempotency-Key deve ter entre 1 e ${TAMANHO_MAXIMO_CHAVE} caracteres.`
    );
  }

  const usuarioId = req.usuario!.usuarioId;
  const hash = hashDaRequisicao(req);

  const anterior = await respostaGravada(usuarioId, chave, hash);

  if (anterior) {
    return { ...anterior, repetida: true };
  }

  try {
    const resposta = await executarTransacao(async (tx) => {
      // Grava a chave antes do efeito: uma requisição simultânea com a
      // mesma chave fica bloqueada neste INSERT até esta terminar e então
      // falha com P2002, desfazendo o que ela própria tentaria fazer.
      const registro = await tx.chaveIdempotencia.create({
        data: {
          usuarioId,
          chave,
          hashRequisicao: hash,
          statusResposta: 0,
          corpoResposta: Prisma.JsonNull,
        },
      });

      const resultado = await operacao(tx);

      await tx.chaveIdempotencia.update({
        where: {
          id: registro.id,
        },
        data: {
          statusResposta: resultado.status,
          corpoResposta: JSON.parse(
            JSON.stringify(resultado.corpo ?? null)
          ) as Prisma.InputJsonValue,
        },
      });

      return resultado;
    });

    return { ...resposta, repetida: false };
  } catch (erro) {
    if (
      erro instanceof Prisma.PrismaClientKnownRequestError &&
      erro.code === "P2002"
    ) {
      const concorrente = await respostaGravada(usuarioId, chave, hash);

      if (concorrente) {
        return { ...concorrente, repetida: true };
      }
    }

    throw erro;
  }
}

export function enviarResposta(
  res: Response,
  resposta: RespostaRota & { repetida: boolean }
) {
  if (resposta.repetida) {
    res.set("Idempotent-Replayed", "true");
  }

  return res.status(resposta.status).json(resposta.corpo);
}
