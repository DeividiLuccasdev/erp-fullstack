export const API_URL =
  import.meta.env.VITE_API_URL || "http://localhost:3000";

function gerarUuid(): string {
  if (typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  // Fallback para páginas fora de contexto seguro (http sem localhost)
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;

  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0"));

  return [
    hex.slice(0, 4).join(""),
    hex.slice(4, 6).join(""),
    hex.slice(6, 8).join(""),
    hex.slice(8, 10).join(""),
    hex.slice(10).join(""),
  ].join("-");
}

// Gera o cabeçalho Idempotency-Key de UMA ação do usuário (registrar uma
// saída, adicionar um item...). Se a mesma ação for reenviada sem que o
// servidor tenha respondido (queda de rede, duplo clique, erro 5xx), a mesma
// chave é reaproveitada e o backend não aplica o efeito duas vezes. Depois de
// uma resposta definitiva, a próxima ação recebe uma chave nova.
export function criarChavesIdempotencia() {
  let pendente: { acao: string; chave: string } | null = null;

  return {
    // "acao" identifica o que está sendo enviado; mudou, chave nova
    para(acao: string): string {
      if (!pendente || pendente.acao !== acao) {
        pendente = { acao, chave: gerarUuid() };
      }

      return pendente.chave;
    },

    // Chamar com o status da resposta: 2xx/4xx encerram a ação
    respondeu(status: number) {
      if (status < 500) {
        pendente = null;
      }
    },
  };
}