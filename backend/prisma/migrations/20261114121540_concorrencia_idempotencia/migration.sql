-- CreateTable
CREATE TABLE "ChaveIdempotencia" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "chave" TEXT NOT NULL,
    "hashRequisicao" TEXT NOT NULL,
    "statusResposta" INTEGER NOT NULL,
    "corpoResposta" JSONB,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChaveIdempotencia_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ChaveIdempotencia_criadoEm_idx" ON "ChaveIdempotencia"("criadoEm");

-- CreateIndex
CREATE UNIQUE INDEX "ChaveIdempotencia_usuarioId_chave_key" ON "ChaveIdempotencia"("usuarioId", "chave");

-- AddForeignKey
ALTER TABLE "ChaveIdempotencia" ADD CONSTRAINT "ChaveIdempotencia_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Invariantes garantidas pelo banco: mesmo que algum caminho do código
-- falhe em conferir, o PostgreSQL recusa estoque negativo e quantidades
-- zeradas ou negativas.
ALTER TABLE "Produto" ADD CONSTRAINT "Produto_estoque_nao_negativo" CHECK ("estoque" >= 0);
ALTER TABLE "Produto" ADD CONSTRAINT "Produto_estoqueMinimo_nao_negativo" CHECK ("estoqueMinimo" >= 0);
ALTER TABLE "Produto" ADD CONSTRAINT "Produto_preco_nao_negativo" CHECK ("preco" >= 0);
ALTER TABLE "ItemPedido" ADD CONSTRAINT "ItemPedido_quantidade_positiva" CHECK ("quantidade" > 0);
ALTER TABLE "MovimentacaoEstoque" ADD CONSTRAINT "MovimentacaoEstoque_quantidade_positiva" CHECK ("quantidade" > 0);
