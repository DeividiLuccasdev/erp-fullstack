// Cria um usuário ADMIN, ou redefine a senha e reativa um usuário existente
// promovendo-o a ADMIN. O cadastro pela API exige um ADMIN logado, então
// este script é o caminho para o primeiro acesso ou para recuperar o acesso.
//
// Uso: npm run criar-admin -- --email voce@exemplo.com --nome "Seu Nome"

import "dotenv/config";
import { parseArgs } from "node:util";
import { createInterface } from "node:readline";
import bcrypt from "bcryptjs";

import { prisma } from "../config/prisma.js";

const TAMANHO_MINIMO_SENHA = 6;

// Uma única interface para todas as perguntas: abrir uma nova a cada
// pergunta perde as respostas quando a entrada vem de um pipe.
const rl = createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: Boolean(process.stdin.isTTY)
});

// Não mostra a senha enquanto ela é digitada
let ocultarDigitacao = false;
const saida = rl as unknown as { _writeToOutput: (texto: string) => void };
const escreverOriginal = saida._writeToOutput.bind(rl);

saida._writeToOutput = (texto: string) => {
  if (!ocultarDigitacao) {
    escreverOriginal(texto);
  }
};

// Lê as respostas linha a linha, em ordem (o iterador guarda as linhas
// que chegam antes da pergunta, como acontece com entrada por pipe).
const linhas = rl[Symbol.asyncIterator]();

async function perguntarSenha(pergunta: string): Promise<string> {
  process.stdout.write(pergunta);
  ocultarDigitacao = true;

  const { value, done } = await linhas.next();

  ocultarDigitacao = false;
  process.stdout.write("\n");

  if (done) {
    throw new Error("A entrada terminou antes de a senha ser informada.");
  }

  return value;
}

async function main() {
  const { values } = parseArgs({
    options: {
      email: { type: "string" },
      nome: { type: "string" }
    }
  });

  const email = values.email?.trim();

  if (!email) {
    console.error('Informe o e-mail: npm run criar-admin -- --email voce@exemplo.com --nome "Seu Nome"');
    rl.close();
    process.exit(1);
  }

  const senha = await perguntarSenha("Senha: ");

  if (senha.length < TAMANHO_MINIMO_SENHA) {
    console.error(`A senha deve ter pelo menos ${TAMANHO_MINIMO_SENHA} caracteres.`);
    process.exit(1);
  }

  if ((await perguntarSenha("Confirme a senha: ")) !== senha) {
    console.error("As senhas não conferem.");
    process.exit(1);
  }

  const senhaHash = await bcrypt.hash(senha, 10);

  const existente = await prisma.usuario.findUnique({
    where: { email }
  });

  if (existente) {
    await prisma.usuario.update({
      where: { email },
      data: {
        senhaHash,
        perfil: "ADMIN",
        ativo: true,
        ...(values.nome ? { nome: values.nome } : {})
      }
    });

    console.log(`Usuário ${email} atualizado: senha redefinida, perfil ADMIN e ativo.`);
  } else {
    await prisma.usuario.create({
      data: {
        nome: values.nome ?? email.split("@")[0] ?? email,
        email,
        senhaHash,
        perfil: "ADMIN"
      }
    });

    console.log(`Administrador ${email} criado com sucesso.`);
  }

  rl.close();
  await prisma.$disconnect();
}

main().catch(async (erro) => {
  console.error(erro);
  rl.close();
  await prisma.$disconnect();
  process.exit(1);
});
