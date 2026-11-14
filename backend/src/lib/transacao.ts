import { prisma } from "../config/prisma.js";
import type { Prisma } from "../../generated/prisma/client.ts";

import { ehConflitoDeTransacao } from "./erros.js";

export type Tx = Prisma.TransactionClient;

// Limites explícitos: maxWait é quanto se espera por uma conexão livre,
// timeout é quanto a transação pode durar antes de ser desfeita.
const OPCOES_TRANSACAO = {
  maxWait: 5_000,
  timeout: 10_000,
};

const TENTATIVAS = 3;

function esperar(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Executa uma transação interativa e a repete quando o PostgreSQL a desfaz
// por deadlock ou conflito de escrita. Isso é seguro porque nada da tentativa
// anterior foi gravado. Outros erros sobem na primeira vez.
export async function executarTransacao<T>(
  operacao: (tx: Tx) => Promise<T>
): Promise<T> {
  for (let tentativa = 1; ; tentativa++) {
    try {
      return await prisma.$transaction(operacao, OPCOES_TRANSACAO);
    } catch (erro) {
      if (tentativa >= TENTATIVAS || !ehConflitoDeTransacao(erro)) {
        throw erro;
      }

      // Pequena espera aleatória para as transações não colidirem de novo
      await esperar(20 * tentativa + Math.random() * 50);
    }
  }
}
