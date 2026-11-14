import bcrypt from "bcryptjs";
import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { app, criarUsuario, limparBanco, prisma } from "./ajuda.ts";
import {
  deveGarantirUsuarioDemo,
  EMAIL_USUARIO_DEMO,
  garantirUsuarioDemo,
  garantirUsuarioDemoSeHabilitado,
  NOME_USUARIO_DEMO,
  SENHA_USUARIO_DEMO,
} from "../src/lib/usuarioDemo.ts";

beforeEach(async () => {
  await limparBanco();
});

afterAll(async () => {
  await prisma.$disconnect();
});

function login(email: string, senha: string) {
  return request(app).post("/api/auth/login").send({ email, senha });
}

describe("conta de demonstração: criação no deploy", () => {
  it("só é criada com RENDER ou CRIAR_USUARIO_DEMO=true", async () => {
    expect(deveGarantirUsuarioDemo({})).toBe(false);
    expect(deveGarantirUsuarioDemo({ CRIAR_USUARIO_DEMO: "false" })).toBe(false);
    expect(deveGarantirUsuarioDemo({ RENDER: "true" })).toBe(true);
    expect(deveGarantirUsuarioDemo({ CRIAR_USUARIO_DEMO: "true" })).toBe(true);

    expect(await garantirUsuarioDemoSeHabilitado({})).toBe(false);
    expect(await prisma.usuario.count()).toBe(0);

    expect(await garantirUsuarioDemoSeHabilitado({ RENDER: "true" })).toBe(true);
    expect(await prisma.usuario.count()).toBe(1);
  });

  it("cria OPERADOR ativo e permite login com a senha publicada", async () => {
    await garantirUsuarioDemo();

    const usuario = await prisma.usuario.findUniqueOrThrow({
      where: { email: EMAIL_USUARIO_DEMO },
    });

    expect(usuario).toMatchObject({
      nome: NOME_USUARIO_DEMO,
      perfil: "OPERADOR",
      ativo: true,
    });

    const resposta = await login(EMAIL_USUARIO_DEMO, SENHA_USUARIO_DEMO);

    expect(resposta.status).toBe(200);
    expect(resposta.body.usuario.perfil).toBe("OPERADOR");
  });

  it("é idempotente, inclusive em paralelo", async () => {
    await Promise.all(Array.from({ length: 5 }, () => garantirUsuarioDemo()));
    await garantirUsuarioDemo();

    expect(
      await prisma.usuario.count({ where: { email: EMAIL_USUARIO_DEMO } })
    ).toBe(1);
  });

  it("restaura uma conta desativada, promovida e com outra senha", async () => {
    const { id } = await garantirUsuarioDemo();

    await prisma.usuario.update({
      where: { id },
      data: {
        ativo: false,
        perfil: "ADMIN",
        nome: "Alterado",
        senhaHash: await bcrypt.hash("outra-senha", 4),
      },
    });

    expect((await login(EMAIL_USUARIO_DEMO, SENHA_USUARIO_DEMO)).status).toBe(403);

    const restaurado = await garantirUsuarioDemo();

    expect(restaurado).toMatchObject({
      id,
      nome: NOME_USUARIO_DEMO,
      perfil: "OPERADOR",
      ativo: true,
    });
    expect((await login(EMAIL_USUARIO_DEMO, SENHA_USUARIO_DEMO)).status).toBe(200);
  });
});

describe("conta de demonstração: proteções", () => {
  it("o e-mail da demo não pode ser recadastrado, nem com outra caixa (403)", async () => {
    await garantirUsuarioDemo();
    const { token } = await criarUsuario("ADMIN");

    for (const email of [EMAIL_USUARIO_DEMO, " DEMO@Example.com "]) {
      const resposta = await request(app)
        .post("/api/usuarios")
        .set("Authorization", `Bearer ${token}`)
        .send({ nome: "Outro", email, senha: "123456", perfil: "ADMIN" });

      expect(resposta.status).toBe(403);
      expect(resposta.body.erro).toMatch(/conta de demonstração/);
    }

    expect(await prisma.usuario.count()).toBe(2);
  });

  it("a demo não cadastra usuários (nem ADMIN) nem exclui registros", async () => {
    await garantirUsuarioDemo();
    const { token } = (await login(EMAIL_USUARIO_DEMO, SENHA_USUARIO_DEMO)).body;

    const cadastro = await request(app)
      .post("/api/usuarios")
      .set("Authorization", `Bearer ${token}`)
      .send({ nome: "Invasor", email: "x@teste.com", senha: "123456", perfil: "ADMIN" });

    expect(cadastro.status).toBe(403);

    const cliente = await request(app)
      .post("/api/clientes")
      .set("Authorization", `Bearer ${token}`)
      .send({ nome: "Cliente da demo" });

    expect(cliente.status).toBe(201);

    const exclusao = await request(app)
      .delete(`/api/clientes/${cliente.body.id}`)
      .set("Authorization", `Bearer ${token}`);

    expect(exclusao.status).toBe(403);
    expect(await prisma.usuario.count()).toBe(1);
  });
});
