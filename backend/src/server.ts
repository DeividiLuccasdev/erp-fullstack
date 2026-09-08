import express from "express";
import cors from "cors";
import "dotenv/config";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import {
    autenticarToken,
    autorizarPerfil
} from "./middlewares/auth.js";
import type { RequestAutenticada } from "./middlewares/auth.js";
import { prisma } from "./config/prisma.js";

const app = express();

// ========================================
// MIDDLEWARES
// ========================================

app.use(cors());
app.use(express.json());

// ========================================
// ROTA INICIAL
// ========================================

app.get("/", (req, res) => {
    res.json({
        mensagem: "ERP Full-Stack API funcionando!"
    });
});

// ========================================
// CADASTRO DE USUÁRIO
// POST /api/usuarios
// ========================================

app.post("/api/usuarios", async (req, res) => {
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
// LOGIN
// POST /api/auth/login
// ========================================

app.post("/api/auth/login", async (req, res) => {
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


// ========================================
// PERFIL DO USUÁRIO LOGADO
// GET /api/perfil
// ========================================

app.get("/api/perfil", autenticarToken, async (req, res) => {
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

app.get(
    "/api/admin/teste",
    autenticarToken,
    autorizarPerfil("ADMIN"),
    (req, res) => {
        res.json({
            mensagem: "Acesso ADMIN autorizado!"
        });
    }
);

// ========================================
// CADASTRAR CLIENTE
// POST /api/clientes
// ========================================

app.post("/api/clientes", autenticarToken, async (req, res) => {
    try {
        const {
            nome,
            cpf,
            email,
            telefone,
            cidade
        } = req.body;

        if (!nome) {
            return res.status(400).json({
                erro: "Nome do cliente é obrigatório."
            });
        }

        // Verifica CPF duplicado
        if (cpf) {
            const clienteExistente = await prisma.cliente.findUnique({
                where: {
                    cpf
                }
            });

            if (clienteExistente) {
                return res.status(409).json({
                    erro: "Já existe um cliente com este CPF."
                });
            }
        }

        const cliente = await prisma.cliente.create({
            data: {
                nome,
                cpf: cpf || null,
                email: email || null,
                telefone: telefone || null,
                cidade: cidade || null
            }
        });

        return res.status(201).json(cliente);

    } catch (erro) {
        console.error(erro);

        return res.status(500).json({
            erro: "Erro interno ao cadastrar cliente."
        });
    }
});
// ========================================
// LISTAR CLIENTES
// GET /api/clientes
// ========================================

app.get("/api/clientes", autenticarToken, async (req, res) => {
    try {
       const clientes = await prisma.cliente.findMany({
    where: {
        ativo: true
    },
    orderBy: {
        nome: "asc"
    }
});

        return res.status(200).json(clientes);

    } catch (erro) {
        console.error(erro);

        return res.status(500).json({
            erro: "Erro interno ao listar clientes."
        });
    }
});

// ========================================
// BUSCAR CLIENTE POR ID
// GET /api/clientes/:id
// ========================================
app.get("/api/clientes/:id", autenticarToken, async (req, res) => {
    try {
       const idParam = req.params.id;

if (typeof idParam !== "string") {
    return res.status(400).json({
        erro: "ID do cliente não informado."
    });
}

        const id: string = idParam;

        const cliente = await prisma.cliente.findUnique({
            where: {
                id
            }
        });

        if (!cliente) {
            return res.status(404).json({
                erro: "Cliente não encontrado."
            });
        }

        return res.status(200).json(cliente);

    } catch (erro) {
        console.error(erro);

        return res.status(500).json({
            erro: "Erro interno ao buscar cliente."
        });
    }
});
// ========================================
// EDITAR CLIENTE
// PUT /api/clientes/:id
// ========================================

app.put("/api/clientes/:id", autenticarToken, async (req, res) => {
    try {
        const idParam = req.params.id;

        if (typeof idParam !== "string") {
            return res.status(400).json({
                erro: "ID do cliente não informado."
            });
        }

        const id: string = idParam;

        const {
            nome,
            cpf,
            email,
            telefone,
            cidade,
            ativo
        } = req.body;

        if (!nome) {
            return res.status(400).json({
                erro: "Nome do cliente é obrigatório."
            });
        }

        const clienteExistente = await prisma.cliente.findUnique({
            where: {
                id
            }
        });

        if (!clienteExistente) {
            return res.status(404).json({
                erro: "Cliente não encontrado."
            });
        }

        if (cpf) {
            const clienteComCpf = await prisma.cliente.findUnique({
                where: {
                    cpf
                }
            });

            if (clienteComCpf && clienteComCpf.id !== id) {
                return res.status(409).json({
                    erro: "Já existe outro cliente com este CPF."
                });
            }
        }

        const clienteAtualizado = await prisma.cliente.update({
            where: {
                id
            },
            data: {
                nome,
                cpf: cpf || null,
                email: email || null,
                telefone: telefone || null,
                cidade: cidade || null,
                ativo: ativo ?? clienteExistente.ativo
            }
        });

        return res.status(200).json(clienteAtualizado);

    } catch (erro) {
        console.error(erro);

        return res.status(500).json({
            erro: "Erro interno ao atualizar cliente."
        });
    }
});
// ========================================
// EXCLUIR CLIENTE
// DELETE /api/clientes/:id
// SOMENTE ADMIN
// ========================================

app.delete(
    "/api/clientes/:id",
    autenticarToken,
    autorizarPerfil("ADMIN"),
    async (req, res) => {
        try {
            const idParam = req.params.id;

            if (typeof idParam !== "string") {
                return res.status(400).json({
                    erro: "ID do cliente não informado."
                });
            }

            const id: string = idParam;

            const cliente = await prisma.cliente.findUnique({
                where: {
                    id
                }
            });

            if (!cliente) {
                return res.status(404).json({
                    erro: "Cliente não encontrado."
                });
            }

          await prisma.cliente.update({
            where: {
                id
            },
            data: {
                ativo: false,
                excluidoEm: new Date()
            }
            });

            return res.status(200).json({
                mensagem: "Cliente excluído com sucesso."
            });

        } catch (erro) {
            console.error(erro);

            return res.status(500).json({
                erro: "Erro interno ao excluir cliente."
            });
        }
    }
);
// ========================================
// CADASTRAR PRODUTO
// POST /api/produtos
// ========================================

app.post("/api/produtos", autenticarToken, async (req, res) => {
    try {
        const {
            nome,
            codigo,
            descricao,
            preco,
            estoque,
            estoqueMinimo
        } = req.body;

        if (!nome || !codigo || preco === undefined) {
            return res.status(400).json({
                erro: "Nome, código e preço são obrigatórios."
            });
        }

        if (Number(preco) < 0) {
            return res.status(400).json({
                erro: "O preço não pode ser negativo."
            });
        }

        if (estoque !== undefined && Number(estoque) < 0) {
            return res.status(400).json({
                erro: "O estoque não pode ser negativo."
            });
        }

        const produtoExistente = await prisma.produto.findUnique({
            where: {
                codigo
            }
        });

        if (produtoExistente) {
            return res.status(409).json({
                erro: "Já existe um produto com este código."
            });
        }

        const produto = await prisma.produto.create({
            data: {
                nome,
                codigo,
                descricao: descricao || null,
                preco: Number(preco),
                estoque: Number(estoque ?? 0),
                estoqueMinimo: Number(estoqueMinimo ?? 0)
            }
        });

        return res.status(201).json(produto);

    } catch (erro) {
        console.error(erro);

        return res.status(500).json({
            erro: "Erro interno ao cadastrar produto."
        });
    }
});


// ========================================
// LISTAR PRODUTOS
// GET /api/produtos
// ========================================

app.get("/api/produtos", autenticarToken, async (req, res) => {
    try {
        const produtos = await prisma.produto.findMany({
            orderBy: {
                nome: "asc"
            }
        });

        return res.status(200).json(produtos);

    } catch (erro) {
        console.error(erro);

        return res.status(500).json({
            erro: "Erro interno ao listar produtos."
        });
    }
});
// ========================================
// BUSCAR PRODUTO POR ID
// GET /api/produtos/:id
// ========================================

app.get("/api/produtos/:id", autenticarToken, async (req, res) => {
    try {
        const idParam = req.params.id;

        if (typeof idParam !== "string") {
            return res.status(400).json({
                erro: "ID do produto não informado."
            });
        }

        const id: string = idParam;

        const produto = await prisma.produto.findUnique({
            where: {
                id
            }
        });

        if (!produto) {
            return res.status(404).json({
                erro: "Produto não encontrado."
            });
        }

        return res.status(200).json(produto);

    } catch (erro) {
        console.error(erro);

        return res.status(500).json({
            erro: "Erro interno ao buscar produto."
        });
    }
});
// ========================================
// EDITAR PRODUTO
// PUT /api/produtos/:id
// ========================================

app.put("/api/produtos/:id", autenticarToken, async (req, res) => {
    try {
        const idParam = req.params.id;

        if (typeof idParam !== "string") {
            return res.status(400).json({
                erro: "ID do produto não informado."
            });
        }

        const id: string = idParam;

        const {
            nome,
            codigo,
            descricao,
            preco,
            estoque,
            estoqueMinimo,
            ativo
        } = req.body;

        if (!nome || !codigo || preco === undefined) {
            return res.status(400).json({
                erro: "Nome, código e preço são obrigatórios."
            });
        }

        const produtoExistente = await prisma.produto.findUnique({
            where: {
                id
            }
        });

        if (!produtoExistente) {
            return res.status(404).json({
                erro: "Produto não encontrado."
            });
        }

        const produtoComMesmoCodigo = await prisma.produto.findUnique({
            where: {
                codigo
            }
        });

        if (
            produtoComMesmoCodigo &&
            produtoComMesmoCodigo.id !== id
        ) {
            return res.status(409).json({
                erro: "Já existe outro produto com este código."
            });
        }

        const produtoAtualizado = await prisma.produto.update({
            where: {
                id
            },
            data: {
                nome,
                codigo,
                descricao: descricao || null,
                preco: Number(preco),
                estoque: Number(estoque ?? produtoExistente.estoque),
                estoqueMinimo: Number(
                    estoqueMinimo ?? produtoExistente.estoqueMinimo
                ),
                ativo: ativo ?? produtoExistente.ativo
            }
        });

        return res.status(200).json(produtoAtualizado);

    } catch (erro) {
        console.error(erro);

        return res.status(500).json({
            erro: "Erro interno ao atualizar produto."
        });
    }
});
// ========================================
// EXCLUIR PRODUTO
// DELETE /api/produtos/:id
// SOMENTE ADMIN
// ========================================

app.delete(
    "/api/produtos/:id",
    autenticarToken,
    autorizarPerfil("ADMIN"),
    async (req, res) => {
        try {
            const idParam = req.params.id;

            if (typeof idParam !== "string") {
                return res.status(400).json({
                    erro: "ID do produto não informado."
                });
            }

            const id: string = idParam;

            const produto = await prisma.produto.findUnique({
                where: {
                    id
                }
            });

            if (!produto) {
                return res.status(404).json({
                    erro: "Produto não encontrado."
                });
            }

            await prisma.produto.delete({
                where: {
                    id
                }
            });

            return res.status(200).json({
                mensagem: "Produto excluído com sucesso."
            });

        } catch (erro) {
            console.error(erro);

            return res.status(500).json({
                erro: "Erro interno ao excluir produto."
            });
        }
    }
);
// ========================================
// ENTRADA DE ESTOQUE
// POST /api/estoque/entrada
// ========================================

app.post("/api/estoque/entrada", autenticarToken, async (req, res) => {
    try {
        const requisicao = req as RequestAutenticada;

        if (!requisicao.usuario) {
            return res.status(401).json({
                erro: "Usuário não autenticado."
            });
        }

        const {
            produtoId,
            quantidade,
            observacao
        } = req.body;

        if (!produtoId || !quantidade) {
            return res.status(400).json({
                erro: "Produto e quantidade são obrigatórios."
            });
        }

        const quantidadeNumero = Number(quantidade);

        if (
            !Number.isInteger(quantidadeNumero) ||
            quantidadeNumero <= 0
        ) {
            return res.status(400).json({
                erro: "A quantidade deve ser um número inteiro maior que zero."
            });
        }

        const produto = await prisma.produto.findUnique({
            where: {
                id: produtoId
            }
        });

        if (!produto) {
            return res.status(404).json({
                erro: "Produto não encontrado."
            });
        }

        const resultado = await prisma.$transaction(async (tx) => {

            const produtoAtualizado = await tx.produto.update({
                where: {
                    id: produtoId
                },
                data: {
                    estoque: {
                        increment: quantidadeNumero
                    }
                }
            });

            const movimentacao = await tx.movimentacaoEstoque.create({
                data: {
                    produtoId,
                    usuarioId: requisicao.usuario!.usuarioId,
                    tipo: "ENTRADA",
                    quantidade: quantidadeNumero,
                    observacao: observacao || null
                }
            });

            return {
                produtoAtualizado,
                movimentacao
            };
        });

        return res.status(201).json({
            mensagem: "Entrada de estoque registrada com sucesso.",
            estoqueAtual: resultado.produtoAtualizado.estoque,
            movimentacao: resultado.movimentacao
        });

    } catch (erro) {
        console.error(erro);

        return res.status(500).json({
            erro: "Erro interno ao registrar entrada de estoque."
        });
    }
});
// ========================================
// SAÍDA DE ESTOQUE
// POST /api/estoque/saida
// ========================================

app.post("/api/estoque/saida", autenticarToken, async (req, res) => {
    try {
        const requisicao = req as RequestAutenticada;

        if (!requisicao.usuario) {
            return res.status(401).json({
                erro: "Usuário não autenticado."
            });
        }

        const {
            produtoId,
            quantidade,
            observacao
        } = req.body;

        if (!produtoId || !quantidade) {
            return res.status(400).json({
                erro: "Produto e quantidade são obrigatórios."
            });
        }

        const quantidadeNumero = Number(quantidade);

        if (
            !Number.isInteger(quantidadeNumero) ||
            quantidadeNumero <= 0
        ) {
            return res.status(400).json({
                erro: "A quantidade deve ser um número inteiro maior que zero."
            });
        }

        const produto = await prisma.produto.findUnique({
            where: {
                id: produtoId
            }
        });

        if (!produto) {
            return res.status(404).json({
                erro: "Produto não encontrado."
            });
        }

        if (produto.estoque < quantidadeNumero) {
            return res.status(400).json({
                erro: "Estoque insuficiente.",
                estoqueAtual: produto.estoque
            });
        }

        const resultado = await prisma.$transaction(async (tx) => {

            const produtoAtualizado = await tx.produto.update({
                where: {
                    id: produtoId
                },
                data: {
                    estoque: {
                        decrement: quantidadeNumero
                    }
                }
            });

            const movimentacao = await tx.movimentacaoEstoque.create({
                data: {
                    produtoId,
                    usuarioId: requisicao.usuario!.usuarioId,
                    tipo: "SAIDA",
                    quantidade: quantidadeNumero,
                    observacao: observacao || null
                }
            });

            return {
                produtoAtualizado,
                movimentacao
            };
        });

        return res.status(201).json({
            mensagem: "Saída de estoque registrada com sucesso.",
            estoqueAtual: resultado.produtoAtualizado.estoque,
            movimentacao: resultado.movimentacao
        });

    } catch (erro) {
        console.error(erro);

        return res.status(500).json({
            erro: "Erro interno ao registrar saída de estoque."
        });
    }
});
// ========================================
// HISTÓRICO DE MOVIMENTAÇÕES
// GET /api/estoque/movimentacoes
// ========================================

app.get(
    "/api/estoque/movimentacoes",
    autenticarToken,
    async (req, res) => {
        try {

            const movimentacoes =
                await prisma.movimentacaoEstoque.findMany({

                    orderBy: {
                        criadoEm: "desc"
                    },

                    include: {

                        produto: {
                            select: {
                                id: true,
                                nome: true,
                                codigo: true
                            }
                        },

                        usuario: {
                            select: {
                                id: true,
                                nome: true,
                                email: true,
                                perfil: true
                            }
                        }

                    }

                });

          const historicoFormatado = movimentacoes.map((movimentacao) => {

    const dataHora = new Date(movimentacao.criadoEm);

    const data = dataHora.toLocaleDateString("pt-BR", {
        timeZone: "America/Sao_Paulo"
    });

    const hora = dataHora.toLocaleTimeString("pt-BR", {
        timeZone: "America/Sao_Paulo"
    });

    return {
        ...movimentacao,
        data,
        hora
    };
});

return res.status(200).json(historicoFormatado);

        } catch (erro) {

            console.error(erro);

            return res.status(500).json({
                erro: "Erro interno ao listar movimentações."
            });
        }
    }
);
// ========================================
// PRODUTOS COM ESTOQUE BAIXO
// GET /api/estoque/baixo
// ========================================

app.get("/api/estoque/baixo", autenticarToken, async (req, res) => {
    try {
        const produtos = await prisma.produto.findMany({
            where: {
                ativo: true
            },
            orderBy: {
                nome: "asc"
            }
        });

        const estoqueBaixo = produtos.filter(
            produto => produto.estoque <= produto.estoqueMinimo
        );

        return res.status(200).json({
            total: estoqueBaixo.length,
            produtos: estoqueBaixo
        });

    } catch (erro) {
        console.error(erro);

        return res.status(500).json({
            erro: "Erro interno ao consultar estoque baixo."
        });
    }
});
// ========================================
// HISTÓRICO DE MOVIMENTAÇÕES DE ESTOQUE
// GET /api/estoque/movimentacoes
// ========================================

app.get(
    "/api/estoque/movimentacoes",
    autenticarToken,
    async (req, res) => {
        try {
            const movimentacoes =
                await prisma.movimentacaoEstoque.findMany({
                    orderBy: {
                        criadoEm: "desc"
                    },

                    include: {
                        produto: {
                            select: {
                                id: true,
                                nome: true,
                                codigo: true
                            }
                        },

                        usuario: {
                            select: {
                                id: true,
                                nome: true,
                                email: true,
                                perfil: true
                            }
                        }
                    }
                });

            return res.status(200).json(movimentacoes);

        } catch (erro) {
            console.error(erro);

            return res.status(500).json({
                erro: "Erro interno ao listar movimentações."
            });
        }
    }
);
// ========================================
// SAÍDA DE ESTOQUE
// POST /api/estoque/saida
// ========================================

app.post("/api/estoque/saida", autenticarToken, async (req, res) => {
    try {
        const requisicao = req as RequestAutenticada;

        if (!requisicao.usuario) {
            return res.status(401).json({
                erro: "Usuário não autenticado."
            });
        }

        const {
            produtoId,
            quantidade,
            observacao
        } = req.body;

        if (!produtoId || !quantidade) {
            return res.status(400).json({
                erro: "Produto e quantidade são obrigatórios."
            });
        }

        const quantidadeNumero = Number(quantidade);

        if (
            !Number.isInteger(quantidadeNumero) ||
            quantidadeNumero <= 0
        ) {
            return res.status(400).json({
                erro: "A quantidade deve ser um número inteiro maior que zero."
            });
        }

        const produto = await prisma.produto.findUnique({
            where: {
                id: produtoId
            }
        });

        if (!produto) {
            return res.status(404).json({
                erro: "Produto não encontrado."
            });
        }

        // Impede estoque negativo
        if (produto.estoque < quantidadeNumero) {
            return res.status(409).json({
                erro: "Estoque insuficiente.",
                estoqueAtual: produto.estoque
            });
        }

        const resultado = await prisma.$transaction(async (tx) => {

            const produtoAtualizado = await tx.produto.update({
                where: {
                    id: produtoId
                },
                data: {
                    estoque: {
                        decrement: quantidadeNumero
                    }
                }
            });

            const movimentacao = await tx.movimentacaoEstoque.create({
                data: {
                    produtoId,
                    usuarioId: requisicao.usuario!.usuarioId,
                    tipo: "SAIDA",
                    quantidade: quantidadeNumero,
                    observacao: observacao || null
                }
            });

            return {
                produtoAtualizado,
                movimentacao
            };
        });

        return res.status(201).json({
            mensagem: "Saída de estoque registrada com sucesso.",
            estoqueAtual: resultado.produtoAtualizado.estoque,
            movimentacao: resultado.movimentacao
        });

    } catch (erro) {
        console.error(erro);

        return res.status(500).json({
            erro: "Erro interno ao registrar saída de estoque."
        });
    }
});
// ========================================
// CRIAR PEDIDO
// POST /api/pedidos
// ========================================

app.post("/api/pedidos", autenticarToken, async (req, res) => {
    try {
        const requisicao = req as RequestAutenticada;

        if (!requisicao.usuario) {
            return res.status(401).json({
                erro: "Usuário não autenticado."
            });
        }

        const { clienteId } = req.body;

        // Se clienteId foi informado, verifica se existe
        if (clienteId) {
            const cliente = await prisma.cliente.findUnique({
                where: {
                    id: clienteId
                }
            });

            if (!cliente) {
                return res.status(404).json({
                    erro: "Cliente não encontrado."
                });
            }
        }

        const pedido = await prisma.pedido.create({
            data: {
                clienteId: clienteId || null,
                usuarioId: requisicao.usuario.usuarioId,
                status: "ABERTO",
                total: 0
            },
            include: {
                cliente: {
                    select: {
                        id: true,
                        nome: true
                    }
                },
                usuario: {
                    select: {
                        id: true,
                        nome: true
                    }
                }
            }
        });

        return res.status(201).json({
            mensagem: "Pedido criado com sucesso.",
            pedido
        });

    } catch (erro) {
        console.error(erro);

        return res.status(500).json({
            erro: "Erro interno ao criar pedido."
        });
    }
});
// ========================================
// ADICIONAR ITEM AO PEDIDO
// POST /api/pedidos/:id/itens
// ========================================

app.post("/api/pedidos/:id/itens", autenticarToken, async (req, res) => {
    try {
        const idParam = req.params.id;

        if (typeof idParam !== "string") {
            return res.status(400).json({
                erro: "ID do pedido não informado."
            });
        }

        const pedidoId: string = idParam;

        const {
            produtoId,
            quantidade
        } = req.body;

        const quantidadeNumero = Number(quantidade);

        if (!produtoId) {
            return res.status(400).json({
                erro: "Produto é obrigatório."
            });
        }

        if (
            !Number.isInteger(quantidadeNumero) ||
            quantidadeNumero <= 0
        ) {
            return res.status(400).json({
                erro: "A quantidade deve ser um número inteiro maior que zero."
            });
        }

        const pedido = await prisma.pedido.findUnique({
            where: {
                id: pedidoId
            }
        });

        if (!pedido) {
            return res.status(404).json({
                erro: "Pedido não encontrado."
            });
        }

        if (pedido.status !== "ABERTO") {
            return res.status(409).json({
                erro: "Só é possível adicionar itens a pedidos abertos."
            });
        }

        const produto = await prisma.produto.findUnique({
            where: {
                id: produtoId
            }
        });

        if (!produto) {
            return res.status(404).json({
                erro: "Produto não encontrado."
            });
        }

        if (!produto.ativo) {
            return res.status(409).json({
                erro: "Produto inativo."
            });
        }

        const precoUnitario = Number(produto.preco);
        const subtotal = precoUnitario * quantidadeNumero;

        const resultado = await prisma.$transaction(async (tx) => {

            const item = await tx.itemPedido.create({
                data: {
                    pedidoId,
                    produtoId,
                    quantidade: quantidadeNumero,
                    precoUnitario,
                    subtotal
                }
            });

            const pedidoAtualizado = await tx.pedido.update({
                where: {
                    id: pedidoId
                },
                data: {
                    total: {
                        increment: subtotal
                    }
                }
            });

            return {
                item,
                pedidoAtualizado
            };
        });

        return res.status(201).json({
            mensagem: "Item adicionado ao pedido com sucesso.",
            item: resultado.item,
            totalPedido: resultado.pedidoAtualizado.total
        });

    } catch (erro) {
        console.error(erro);

        return res.status(500).json({
            erro: "Erro interno ao adicionar item ao pedido."
        });
    }
});
// ========================================
// FINALIZAR PEDIDO
// POST /api/pedidos/:id/finalizar
// ========================================

app.post(
    "/api/pedidos/:id/finalizar",
    autenticarToken,
    async (req, res) => {
        try {
            const requisicao = req as RequestAutenticada;

            if (!requisicao.usuario) {
                return res.status(401).json({
                    erro: "Usuário não autenticado."
                });
            }

            const idParam = req.params.id;

            if (typeof idParam !== "string") {
                return res.status(400).json({
                    erro: "ID do pedido não informado."
                });
            }

            const pedidoId: string = idParam;

            const pedido = await prisma.pedido.findUnique({
                where: {
                    id: pedidoId
                },
                include: {
                    itens: {
                        include: {
                            produto: true
                        }
                    }
                }
            });

            if (!pedido) {
                return res.status(404).json({
                    erro: "Pedido não encontrado."
                });
            }

            if (pedido.status !== "ABERTO") {
                return res.status(409).json({
                    erro: "Este pedido não está aberto."
                });
            }

            if (pedido.itens.length === 0) {
                return res.status(409).json({
                    erro: "Não é possível finalizar um pedido sem itens."
                });
            }

            const resultado = await prisma.$transaction(async (tx) => {

                for (const item of pedido.itens) {

                    const atualizacao = await tx.produto.updateMany({
                        where: {
                            id: item.produtoId,
                            estoque: {
                                gte: item.quantidade
                            }
                        },
                        data: {
                            estoque: {
                                decrement: item.quantidade
                            }
                        }
                    });

                    if (atualizacao.count === 0) {
                        throw new Error(
                            `ESTOQUE_INSUFICIENTE:${item.produto.nome}`
                        );
                    }

                    await tx.movimentacaoEstoque.create({
                        data: {
                            produtoId: item.produtoId,
                            usuarioId: requisicao.usuario!.usuarioId,
                            tipo: "SAIDA",
                            quantidade: item.quantidade,
                            observacao: `Venda - Pedido ${pedidoId}`
                        }
                    });
                }

                const pedidoFinalizado = await tx.pedido.update({
                    where: {
                        id: pedidoId
                    },
                    data: {
                        status: "FINALIZADO",
                        finalizadoEm: new Date()
                    }
                });

                return pedidoFinalizado;
            });

            return res.status(200).json({
                mensagem: "Pedido finalizado com sucesso.",
                pedido: resultado
            });

        } catch (erro) {

            if (
                erro instanceof Error &&
                erro.message.startsWith("ESTOQUE_INSUFICIENTE:")
            ) {
                const produto = erro.message.split(":")[1];

                return res.status(409).json({
                    erro: `Estoque insuficiente para o produto: ${produto}.`
                });
            }

            console.error(erro);

            return res.status(500).json({
                erro: "Erro interno ao finalizar pedido."
            });
        }
    }
);
// ========================================
// LISTAR PEDIDOS
// GET /api/pedidos
// ========================================

app.get("/api/pedidos", autenticarToken, async (req, res) => {
    try {
        const pedidos = await prisma.pedido.findMany({
            orderBy: {
                criadoEm: "desc"
            },

            include: {
                cliente: {
                    select: {
                        id: true,
                        nome: true
                    }
                },

                usuario: {
                    select: {
                        id: true,
                        nome: true
                    }
                },

                _count: {
                    select: {
                        itens: true
                    }
                }
            }
        });

        return res.status(200).json(pedidos);

    } catch (erro) {
        console.error(erro);

        return res.status(500).json({
            erro: "Erro interno ao listar pedidos."
        });
    }
});
// ========================================
// DETALHES DO PEDIDO
// GET /api/pedidos/:id
// ========================================

app.get("/api/pedidos/:id", autenticarToken, async (req, res) => {
    try {
        const idParam = req.params.id;

        if (typeof idParam !== "string") {
            return res.status(400).json({
                erro: "ID do pedido não informado."
            });
        }

        const pedido = await prisma.pedido.findUnique({
            where: {
                id: idParam
            },

            include: {
                cliente: {
                    select: {
                        id: true,
                        nome: true,
                        cpf: true,
                        email: true,
                        telefone: true
                    }
                },

                usuario: {
                    select: {
                        id: true,
                        nome: true,
                        email: true,
                        perfil: true
                    }
                },

                itens: {
                    include: {
                        produto: {
                            select: {
                                id: true,
                                nome: true,
                                codigo: true
                            }
                        }
                    }
                }
            }
        });

        if (!pedido) {
            return res.status(404).json({
                erro: "Pedido não encontrado."
            });
        }

        return res.status(200).json(pedido);

    } catch (erro) {
        console.error(erro);

        return res.status(500).json({
            erro: "Erro interno ao buscar pedido."
        });
    }
});
// ========================================
// CANCELAR PEDIDO
// POST /api/pedidos/:id/cancelar
// ========================================

app.post(
    "/api/pedidos/:id/cancelar",
    autenticarToken,
    async (req, res) => {
        try {
            const idParam = req.params.id;

            if (typeof idParam !== "string") {
                return res.status(400).json({
                    erro: "ID do pedido não informado."
                });
            }

            const pedido = await prisma.pedido.findUnique({
                where: {
                    id: idParam
                }
            });

            if (!pedido) {
                return res.status(404).json({
                    erro: "Pedido não encontrado."
                });
            }

            if (pedido.status === "FINALIZADO") {
                return res.status(409).json({
                    erro: "Pedido finalizado não pode ser cancelado."
                });
            }

            if (pedido.status === "CANCELADO") {
                return res.status(409).json({
                    erro: "Este pedido já está cancelado."
                });
            }

            const pedidoCancelado = await prisma.pedido.update({
                where: {
                    id: idParam
                },
                data: {
                    status: "CANCELADO",
                    canceladoEm: new Date()
                }
            });

            return res.status(200).json({
                mensagem: "Pedido cancelado com sucesso.",
                pedido: pedidoCancelado
            });

        } catch (erro) {
            console.error(erro);

            return res.status(500).json({
                erro: "Erro interno ao cancelar pedido."
            });
        }
    }
);
// ========================================
// DASHBOARD
// GET /api/dashboard
// ========================================

app.get("/api/dashboard", autenticarToken, async (req, res) => {
    try {

        const [
            totalClientes,
            totalProdutos,
            pedidosAbertos,
            vendasFinalizadas,
            pedidosCancelados,
            faturamento,
            produtos,
            ultimasVendas
        ] = await Promise.all([

            prisma.cliente.count({
                where: {
                    ativo: true
                }
            }),

            prisma.produto.count({
                where: {
                    ativo: true
                }
            }),

            prisma.pedido.count({
                where: {
                    status: "ABERTO"
                }
            }),

            prisma.pedido.count({
                where: {
                    status: "FINALIZADO"
                }
            }),

            prisma.pedido.count({
                where: {
                    status: "CANCELADO"
                }
            }),

            prisma.pedido.aggregate({
                where: {
                    status: "FINALIZADO"
                },
                _sum: {
                    total: true
                }
            }),

            prisma.produto.findMany({
                where: {
                    ativo: true
                },
                select: {
                    id: true,
                    nome: true,
                    codigo: true,
                    estoque: true,
                    estoqueMinimo: true
                }
            }),

            prisma.pedido.findMany({
                where: {
                    status: "FINALIZADO"
                },

                orderBy: {
                    finalizadoEm: "desc"
                },

                take: 5,

                include: {
                    cliente: {
                        select: {
                            id: true,
                            nome: true
                        }
                    },

                    usuario: {
                        select: {
                            id: true,
                            nome: true
                        }
                    }
                }
            })

        ]);

        const estoqueBaixo = produtos.filter(
            produto => produto.estoque <= produto.estoqueMinimo
        );

        return res.status(200).json({

            resumo: {
                totalClientes,
                totalProdutos,
                pedidosAbertos,
                vendasFinalizadas,
                pedidosCancelados,
                faturamentoTotal: Number(
                    faturamento._sum.total ?? 0
                ),
                produtosEstoqueBaixo: estoqueBaixo.length
            },

            estoqueBaixo,

            ultimasVendas

        });

    } catch (erro) {

        console.error(erro);

        return res.status(500).json({
            erro: "Erro interno ao carregar dashboard."
        });
    }
});
// ========================================
// SERVIDOR
// ========================================

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(
        `Servidor rodando em http://localhost:${PORT}`
    );
});