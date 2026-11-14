import type { Response } from "express";

import { Prisma } from "../../generated/prisma/client.ts";

// Erro de regra de negócio com o status HTTP que deve ser devolvido.
// Lançado dentro das transações faz o rollback e vira a resposta.
export class ErroHttp extends Error {
  readonly status: number;
  readonly extra: Record<string, unknown>;

  constructor(
    status: number,
    mensagem: string,
    extra: Record<string, unknown> = {}
  ) {
    super(mensagem);
    this.status = status;
    this.extra = extra;
  }
}

export interface MensagensErroBanco {
  // Violação de campo único (P2002), ex.: "Já existe um produto com este código."
  unico?: string;
  // Registro não encontrado (P2025)
  naoEncontrado?: string;
  // Violação de chave estrangeira (P2003)
  referencia?: string;
}

function codigoDoErro(erro: unknown): string | undefined {
  if (erro instanceof Prisma.PrismaClientKnownRequestError) {
    return erro.code;
  }

  return undefined;
}

// Conflito de escrita, deadlock (40P01) ou falha de serialização (40001):
// a transação inteira foi desfeita e pode ser repetida com segurança.
export function ehConflitoDeTransacao(erro: unknown): boolean {
  if (codigoDoErro(erro) === "P2034") {
    return true;
  }

  const texto = String((erro as { message?: unknown })?.message ?? "");

  return /\b40P01\b|\b40001\b|deadlock detected/i.test(texto);
}

// Converte erros do Prisma/PostgreSQL no status HTTP adequado.
// Devolve null quando o erro não é conhecido (vira 500).
export function mapearErroBanco(
  erro: unknown,
  mensagens: MensagensErroBanco = {}
): { status: number; erro: string } | null {
  if (ehConflitoDeTransacao(erro)) {
    return {
      status: 409,
      erro: "Conflito com outra operação simultânea. Tente novamente.",
    };
  }

  const codigo = codigoDoErro(erro);

  switch (codigo) {
    case "P2002":
      return {
        status: 409,
        erro: mensagens.unico ?? "Registro duplicado.",
      };

    case "P2025":
      return {
        status: 404,
        erro: mensagens.naoEncontrado ?? "Registro não encontrado.",
      };

    case "P2003":
      return {
        status: 409,
        erro:
          mensagens.referencia ??
          "O registro está vinculado a outros dados.",
      };

    // Tempo da transação esgotado ou sem conexão livre no pool
    case "P2028":
    case "P2024":
    case "P2037":
      return {
        status: 503,
        erro: "Servidor ocupado no momento. Tente novamente.",
      };
  }

  const texto = String((erro as { message?: unknown })?.message ?? "");

  // CHECK do banco (ex.: estoque >= 0) barrou a escrita
  if (/\b23514\b|check constraint/i.test(texto)) {
    return {
      status: 409,
      erro: "A operação deixaria os dados em estado inválido.",
    };
  }

  return null;
}

// Resposta padrão dos blocos catch das rotas
export function responderErro(
  res: Response,
  erro: unknown,
  mensagemPadrao: string,
  mensagens: MensagensErroBanco = {}
) {
  if (erro instanceof ErroHttp) {
    return res.status(erro.status).json({
      erro: erro.message,
      ...erro.extra,
    });
  }

  const mapeado = mapearErroBanco(erro, mensagens);

  if (mapeado) {
    return res.status(mapeado.status).json({
      erro: mapeado.erro,
    });
  }

  console.error(erro);

  return res.status(500).json({
    erro: mensagemPadrao,
  });
}
