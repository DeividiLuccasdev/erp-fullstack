// Conta pública de demonstração, com as credenciais publicadas no README.
//
// É criada (ou restaurada) a cada deploy, antes de o servidor aceitar
// conexões, e só quando a variável RENDER existe (o Render a define
// sozinho) ou CRIAR_USUARIO_DEMO=true: bancos locais e de teste não
// ganham esse usuário sem pedir.
//
// O perfil é OPERADOR: ele já acessa dashboard, clientes, produtos,
// estoque e vendas, e não pode cadastrar usuários nem excluir registros.

import bcrypt from "bcryptjs";

import { prisma } from "../config/prisma.js";

export const EMAIL_USUARIO_DEMO = "demo@example.com";
export const SENHA_USUARIO_DEMO = "Demo@2026";
export const NOME_USUARIO_DEMO = "Usuário Demo";
export const PERFIL_USUARIO_DEMO = "OPERADOR" as const;

type Ambiente = Record<string, string | undefined>;

export const ERRO_USUARIO_DEMO_PROTEGIDO =
  "A conta de demonstração é protegida: não é possível desativá-la, excluí-la nem alterar senha, e-mail ou perfil.";

// Único ponto que decide se um e-mail é o da conta de demonstração.
// Qualquer rota ou script que altere usuários deve consultá-lo antes e
// responder 403 com ERRO_USUARIO_DEMO_PROTEGIDO.
export function ehUsuarioDemo(email: unknown): boolean {
  return (
    typeof email === "string" &&
    email.trim().toLowerCase() === EMAIL_USUARIO_DEMO
  );
}

export function deveGarantirUsuarioDemo(
  env: Ambiente = process.env
): boolean {
  return Boolean(env.RENDER) || env.CRIAR_USUARIO_DEMO === "true";
}

// Idempotente e seguro com deploys simultâneos (upsert no índice único de
// e-mail). Se a conta já existe, volta a ficar ativa, com o perfil e a
// senha da demonstração: uma demo alterada se recupera no próximo deploy.
export async function garantirUsuarioDemo() {
  const senhaHash = await bcrypt.hash(SENHA_USUARIO_DEMO, 10);

  const dados = {
    nome: NOME_USUARIO_DEMO,
    senhaHash,
    perfil: PERFIL_USUARIO_DEMO,
    ativo: true
  };

  const upsert = () =>
    prisma.usuario.upsert({
      where: { email: EMAIL_USUARIO_DEMO },
      create: { email: EMAIL_USUARIO_DEMO, ...dados },
      update: dados
    });

  try {
    return await upsert();
  } catch (erro) {
    // Se outra instância criou a conta entre a consulta e a inserção, o
    // índice único recusa (P2002) e a nova tentativa cai no update
    if ((erro as { code?: string }).code === "P2002") {
      return upsert();
    }

    throw erro;
  }
}

// Chamada na inicialização do servidor. Devolve true se garantiu a conta.
export async function garantirUsuarioDemoSeHabilitado(
  env: Ambiente = process.env
): Promise<boolean> {
  if (!deveGarantirUsuarioDemo(env)) {
    return false;
  }

  await garantirUsuarioDemo();

  return true;
}
