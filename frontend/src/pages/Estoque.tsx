import { API_URL } from "../api";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";

type Produto = {
  id: string;
  nome: string;
  codigo: string;
  estoque: number;
  estoqueMinimo: number;
  ativo: boolean;
};

type Movimentacao = {
  id: string;
  tipo: "ENTRADA" | "SAIDA";
  quantidade: number;
  observacao: string | null;
  criadoEm: string;
  data?: string;
  hora?: string;

  produto: {
    id: string;
    nome: string;
    codigo: string;
  };

  usuario: {
    id: string;
    nome: string;
    email: string;
    perfil: string;
  };
};

function Estoque() {
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [movimentacoes, setMovimentacoes] = useState<Movimentacao[]>([]);

  const [produtoId, setProdutoId] = useState("");
  const [tipo, setTipo] = useState<"entrada" | "saida">("entrada");
  const [quantidade, setQuantidade] = useState("");
  const [observacao, setObservacao] = useState("");

  const [erro, setErro] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [carregando, setCarregando] = useState(false);

  const token = localStorage.getItem("token");

  async function carregarDados() {
    if (!token) {
      return;
    }

    try {
      const [resProdutos, resMovimentacoes] = await Promise.all([
        fetch(`${API_URL}/api/produtos`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }),

        fetch(`${API_URL}/api/estoque/movimentacoes`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }),
      ]);

      if (!resProdutos.ok || !resMovimentacoes.ok) {
        throw new Error("Erro ao carregar estoque.");
      }

      const dadosProdutos = await resProdutos.json();
      const dadosMovimentacoes = await resMovimentacoes.json();

      setProdutos(dadosProdutos);
      setMovimentacoes(dadosMovimentacoes);

    } catch {
      setErro("Não foi possível carregar os dados do estoque.");
    }
  }

  useEffect(() => {
    carregarDados();
  }, []);

  async function registrarMovimentacao(e: FormEvent) {
    e.preventDefault();

    setErro("");
    setMensagem("");

    if (!produtoId || !quantidade) {
      setErro("Selecione o produto e informe a quantidade.");
      return;
    }

    setCarregando(true);

    try {
      const resposta = await fetch(
        `${API_URL}/api/estoque/${tipo}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            produtoId,
            quantidade: Number(quantidade),
            observacao,
          }),
        }
      );

      const dados = await resposta.json();

      if (!resposta.ok) {
        setErro(dados.erro || "Erro ao registrar movimentação.");
        return;
      }

      setMensagem(
        tipo === "entrada"
          ? "Entrada registrada com sucesso."
          : "Saída registrada com sucesso."
      );

      setQuantidade("");
      setObservacao("");

      await carregarDados();

    } catch {
      setErro("Não foi possível conectar ao servidor.");
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className="space-y-8">

      <div>
        <h1 className="text-3xl font-bold text-white">
          Estoque
        </h1>

        <p className="text-slate-400 mt-1">
          Controle de entradas, saídas e movimentações
        </p>
      </div>

      {/* RESUMO DO ESTOQUE */}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <p className="text-slate-400">
            Produtos
          </p>

          <h2 className="text-3xl font-bold text-white mt-2">
            {produtos.length}
          </h2>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <p className="text-slate-400">
            Unidades em estoque
          </p>

          <h2 className="text-3xl font-bold text-white mt-2">
            {produtos.reduce(
              (total, produto) => total + produto.estoque,
              0
            )}
          </h2>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <p className="text-slate-400">
            Estoque baixo
          </p>

          <h2 className="text-3xl font-bold text-yellow-400 mt-2">
            {
              produtos.filter(
                (produto) =>
                  produto.estoque <= produto.estoqueMinimo
              ).length
            }
          </h2>
        </div>

      </div>

      {/* MOVIMENTAÇÃO */}

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">

        <h2 className="text-xl font-semibold text-white mb-6">
          Nova movimentação
        </h2>

        <form
          onSubmit={registrarMovimentacao}
          className="grid grid-cols-1 md:grid-cols-2 gap-5"
        >

          <div>
            <label className="block text-slate-300 mb-2">
              Produto
            </label>

            <select
              value={produtoId}
              onChange={(e) => setProdutoId(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-4 py-3"
            >
              <option value="">
                Selecione um produto
              </option>

              {produtos.map((produto) => (
                <option
                  key={produto.id}
                  value={produto.id}
                >
                  {produto.nome} - estoque: {produto.estoque}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-slate-300 mb-2">
              Tipo
            </label>

            <select
              value={tipo}
              onChange={(e) =>
                setTipo(
                  e.target.value as "entrada" | "saida"
                )
              }
              className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-4 py-3"
            >
              <option value="entrada">
                Entrada
              </option>

              <option value="saida">
                Saída
              </option>
            </select>
          </div>

          <div>
            <label className="block text-slate-300 mb-2">
              Quantidade
            </label>

            <input
              type="number"
              min="1"
              value={quantidade}
              onChange={(e) => setQuantidade(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-4 py-3"
            />
          </div>

          <div>
            <label className="block text-slate-300 mb-2">
              Observação
            </label>

            <input
              type="text"
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              placeholder="Ex: reposição de estoque"
              className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-4 py-3"
            />
          </div>

          <div className="md:col-span-2">

            {erro && (
              <div className="mb-4 bg-red-950 border border-red-800 text-red-300 p-3 rounded-lg">
                {erro}
              </div>
            )}

            {mensagem && (
              <div className="mb-4 bg-green-950 border border-green-800 text-green-300 p-3 rounded-lg">
                {mensagem}
              </div>
            )}

            <button
              type="submit"
              disabled={carregando}
              className="bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-slate-950 font-semibold px-6 py-3 rounded-lg"
            >
              {carregando
                ? "Registrando..."
                : "Registrar movimentação"}
            </button>

          </div>

        </form>
      </div>

      {/* PRODUTOS */}

      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">

        <div className="p-6">
          <h2 className="text-xl font-semibold text-white">
            Estoque atual
          </h2>
        </div>

        <table className="w-full">
          <thead className="bg-slate-800">
            <tr className="text-left text-slate-300">
              <th className="p-4">Código</th>
              <th className="p-4">Produto</th>
              <th className="p-4">Estoque</th>
              <th className="p-4">Mínimo</th>
              <th className="p-4">Status</th>
            </tr>
          </thead>

          <tbody>
            {produtos.map((produto) => {

              const baixo =
                produto.estoque <= produto.estoqueMinimo;

              return (
                <tr
                  key={produto.id}
                  className="border-t border-slate-800 text-slate-200"
                >
                  <td className="p-4">
                    {produto.codigo}
                  </td>

                  <td className="p-4 font-medium">
                    {produto.nome}
                  </td>

                  <td className="p-4">
                    {produto.estoque}
                  </td>

                  <td className="p-4">
                    {produto.estoqueMinimo}
                  </td>

                  <td className="p-4">
                    {baixo ? (
                      <span className="text-yellow-400">
                        Estoque baixo
                      </span>
                    ) : (
                      <span className="text-green-400">
                        Normal
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

      </div>

      {/* HISTÓRICO */}

      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">

        <div className="p-6">
          <h2 className="text-xl font-semibold text-white">
            Histórico de movimentações
          </h2>
        </div>

        <table className="w-full">
          <thead className="bg-slate-800">
            <tr className="text-left text-slate-300">
              <th className="p-4">Produto</th>
              <th className="p-4">Tipo</th>
              <th className="p-4">Quantidade</th>
              <th className="p-4">Usuário</th>
              <th className="p-4">Data</th>
              <th className="p-4">Hora</th>
              <th className="p-4">Observação</th>
            </tr>
          </thead>

          <tbody>
            {movimentacoes.map((movimentacao) => (
              <tr
                key={movimentacao.id}
                className="border-t border-slate-800 text-slate-200"
              >
                <td className="p-4">
                  {movimentacao.produto.nome}
                </td>

                <td className="p-4">
                  <span
                    className={
                      movimentacao.tipo === "ENTRADA"
                        ? "text-green-400"
                        : "text-red-400"
                    }
                  >
                    {movimentacao.tipo}
                  </span>
                </td>

                <td className="p-4">
                  {movimentacao.quantidade}
                </td>

                <td className="p-4">
                  {movimentacao.usuario.nome}
                </td>

                <td className="p-4">
                  {movimentacao.data ||
                    new Date(
                      movimentacao.criadoEm
                    ).toLocaleDateString("pt-BR")}
                </td>

                <td className="p-4">
                  {movimentacao.hora ||
                    new Date(
                      movimentacao.criadoEm
                    ).toLocaleTimeString("pt-BR")}
                </td>

                <td className="p-4">
                  {movimentacao.observacao || "-"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

      </div>

    </div>
  );
}

export default Estoque;