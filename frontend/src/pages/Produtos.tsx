import { useEffect, useState } from "react";

type Produto = {
  id: string;
  nome: string;
  codigo: string;
  descricao: string | null;
  preco: number;
  estoque: number;
  estoqueMinimo: number;
  ativo: boolean;
};

function Produtos() {
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");

  const token = localStorage.getItem("token");

  useEffect(() => {
    async function carregarProdutos() {
      try {
        const resposta = await fetch(
          "http://localhost:3000/api/produtos",
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (!resposta.ok) {
          throw new Error("Erro ao carregar produtos.");
        }

        const dados = await resposta.json();
        setProdutos(dados);

      } catch {
        setErro("Não foi possível carregar os produtos.");
      } finally {
        setCarregando(false);
      }
    }

    carregarProdutos();
  }, [token]);

  return (
    <div>

      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white">
            Produtos
          </h1>

          <p className="text-slate-400 mt-1">
            Gerencie produtos e estoque
          </p>
        </div>

        <button className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold px-5 py-3 rounded-lg">
          + Novo Produto
        </button>
      </div>

      {carregando && (
        <p className="text-slate-400">
          Carregando produtos...
        </p>
      )}

      {erro && (
        <div className="bg-red-950 border border-red-800 text-red-300 p-4 rounded-lg">
          {erro}
        </div>
      )}

      {!carregando && !erro && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">

          <table className="w-full">

            <thead className="bg-slate-800">
              <tr className="text-left text-slate-300">
                <th className="p-4">Produto</th>
                <th className="p-4">Código</th>
                <th className="p-4">Preço</th>
                <th className="p-4">Estoque</th>
                <th className="p-4">Estoque mínimo</th>
                <th className="p-4">Status</th>
              </tr>
            </thead>

            <tbody>

              {produtos.map((produto) => (
                <tr
                  key={produto.id}
                  className="border-t border-slate-800 text-slate-200"
                >

                  <td className="p-4 font-medium">
                    {produto.nome}
                  </td>

                  <td className="p-4">
                    {produto.codigo}
                  </td>

                  <td className="p-4">
                    {Number(produto.preco).toLocaleString(
                      "pt-BR",
                      {
                        style: "currency",
                        currency: "BRL",
                      }
                    )}
                  </td>

                  <td className="p-4">
                    <span
                      className={
                        produto.estoque <= produto.estoqueMinimo
                          ? "text-red-400 font-semibold"
                          : "text-green-400"
                      }
                    >
                      {produto.estoque}
                    </span>
                  </td>

                  <td className="p-4">
                    {produto.estoqueMinimo}
                  </td>

                  <td className="p-4">
                    {produto.ativo ? (
                      <span className="text-green-400">
                        Ativo
                      </span>
                    ) : (
                      <span className="text-red-400">
                        Inativo
                      </span>
                    )}
                  </td>

                </tr>
              ))}

            </tbody>
          </table>

        </div>
      )}

    </div>
  );
}

export default Produtos;