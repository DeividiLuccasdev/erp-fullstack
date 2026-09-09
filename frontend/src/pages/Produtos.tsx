import { API_URL } from "../api";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

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

const formatadorMoeda = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

function formatarMoedaDigitacao(valor: string) {
  const somenteNumeros = valor.replace(/\D/g, "");

  if (!somenteNumeros) {
    return "";
  }

  const numero = Number(somenteNumeros) / 100;

  return formatadorMoeda.format(numero);
}

function numeroParaMoeda(valor: number | string) {
  const numero = Number(valor);

  if (Number.isNaN(numero)) {
    return "";
  }

  return formatadorMoeda.format(numero);
}

function moedaParaNumero(valor: string) {
  const valorLimpo = valor
    .replace("R$", "")
    .replace(/\./g, "")
    .replace(",", ".")
    .trim();

  return Number(valorLimpo);
}

function Produtos() {
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [mensagem, setMensagem] = useState("");

  const [mostrarFormulario, setMostrarFormulario] =
    useState(false);

  const [salvando, setSalvando] = useState(false);
  const [busca, setBusca] = useState("");

  const [produtoEditando, setProdutoEditando] =
    useState<Produto | null>(null);

  const [nome, setNome] = useState("");
  const [codigo, setCodigo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [preco, setPreco] = useState("");
  const [estoqueMinimo, setEstoqueMinimo] =
    useState("0");

  const token = localStorage.getItem("token");

  const carregarProdutos = useCallback(async () => {
    try {
      setErro("");

      const resposta = await fetch(
        `${API_URL}/api/produtos`,
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
  }, [token]);

  useEffect(() => {
    carregarProdutos();
  }, [carregarProdutos]);

  const produtosFiltrados = useMemo(() => {
    const texto = busca.trim().toLowerCase();

    if (!texto) {
      return produtos;
    }

    return produtos.filter((produto) => {
      return (
        produto.nome.toLowerCase().includes(texto) ||
        produto.codigo.toLowerCase().includes(texto)
      );
    });
  }, [busca, produtos]);

  function limparFormulario() {
    setNome("");
    setCodigo("");
    setDescricao("");
    setPreco("");
    setEstoqueMinimo("0");
  }

  function abrirFormulario() {
    setProdutoEditando(null);
    limparFormulario();
    setErro("");
    setMensagem("");
    setMostrarFormulario(true);
  }

  function abrirEdicao(produto: Produto) {
    setProdutoEditando(produto);
    setNome(produto.nome);
    setCodigo(produto.codigo);
    setDescricao(produto.descricao ?? "");
    setPreco(numeroParaMoeda(produto.preco));
    setEstoqueMinimo(String(produto.estoqueMinimo));
    setErro("");
    setMensagem("");
    setMostrarFormulario(true);
  }

  function fecharFormulario() {
    if (salvando) {
      return;
    }

    setMostrarFormulario(false);
    setProdutoEditando(null);
    limparFormulario();
  }

  async function salvarProduto(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setErro("");
    setMensagem("");

    if (!nome.trim()) {
      setErro("Informe o nome do produto.");
      return;
    }

    if (!codigo.trim()) {
      setErro("Informe o código do produto.");
      return;
    }

     const precoNumero = moedaParaNumero(preco);

    const estoqueMinimoNumero = Number(estoqueMinimo);

    if (
      Number.isNaN(precoNumero) ||
      precoNumero < 0
    ) {
      setErro("Informe um preço válido.");
      return;
    }

    if (
      Number.isNaN(estoqueMinimoNumero) ||
      estoqueMinimoNumero < 0
    ) {
      setErro("Informe um estoque mínimo válido.");
      return;
    }

    try {
      setSalvando(true);

      const editando = Boolean(produtoEditando);

      const resposta = await fetch(
        editando
          ? `${API_URL}/api/produtos/${produtoEditando!.id}`
          : `${API_URL}/api/produtos`,
        {
          method: editando ? "PUT" : "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            nome: nome.trim(),
            codigo: codigo.trim().toUpperCase(),
            descricao: descricao.trim() || null,
            preco: precoNumero,
            estoqueMinimo: estoqueMinimoNumero,
            ativo: produtoEditando?.ativo ?? true,
          }),
        }
      );

      const dados = await resposta.json().catch(() => ({}));

      if (!resposta.ok) {
        setErro(
          dados?.erro ||
            dados?.mensagem ||
            (editando
              ? "Não foi possível atualizar o produto."
              : "Não foi possível cadastrar o produto.")
        );
        return;
      }

      setMensagem(
        editando
          ? "Produto atualizado com sucesso!"
          : "Produto cadastrado com sucesso!"
      );

      limparFormulario();
      setProdutoEditando(null);
      setMostrarFormulario(false);

      await carregarProdutos();
    } catch {
      setErro("Erro ao conectar com o servidor.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white">
            Produtos
          </h1>

          <p className="text-slate-400 mt-1">
            Cadastre e gerencie os produtos do sistema
          </p>
        </div>

        <button
          onClick={abrirFormulario}
          className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold px-5 py-3 rounded-lg transition"
        >
          + Novo Produto
        </button>
      </div>

      {mensagem && (
        <div className="mb-5 bg-green-950 border border-green-800 text-green-300 p-4 rounded-lg">
          {mensagem}
        </div>
      )}

      {erro && (
        <div className="mb-5 bg-red-950 border border-red-800 text-red-300 p-4 rounded-lg">
          {erro}
        </div>
      )}

      <div className="mb-5">
        <input
          type="text"
          value={busca}
          onChange={(event) => setBusca(event.target.value)}
          placeholder="Pesquisar por nome ou código..."
          className="w-full md:w-96 bg-slate-900 border border-slate-700 text-white px-4 py-3 rounded-lg outline-none focus:border-cyan-500"
        />
      </div>

      {carregando && (
        <p className="text-slate-400">
          Carregando produtos...
        </p>
      )}

      {!carregando && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-800">
                <tr className="text-left text-slate-300">
                  <th className="p-4">Produto</th>
                  <th className="p-4">Código</th>
                  <th className="p-4">Preço</th>
                  <th className="p-4">Estoque</th>
                  <th className="p-4">Estoque mínimo</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Ações</th>
                </tr>
              </thead>

              <tbody>
                {produtosFiltrados.map((produto) => (
                  <tr
                    key={produto.id}
                    className="border-t border-slate-800 text-slate-200 hover:bg-slate-800/50"
                  >
                    <td className="p-4">
                      <div className="font-medium">
                        {produto.nome}
                      </div>

                      {produto.descricao && (
                        <div className="text-sm text-slate-500 mt-1">
                          {produto.descricao}
                        </div>
                      )}
                    </td>

                    <td className="p-4 font-mono text-sm">
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

                    <td className="p-4">
                      <button
                        type="button"
                        onClick={() => abrirEdicao(produto)}
                        className="border border-cyan-500 text-cyan-400 hover:bg-cyan-500 hover:text-slate-950 font-medium px-4 py-2 rounded-lg transition"
                      >
                        Editar
                      </button>
                    </td>
                  </tr>
                ))}

                {produtosFiltrados.length === 0 && (
                  <tr>
                    <td
                      colSpan={7}
                      className="p-8 text-center text-slate-500"
                    >
                      Nenhum produto encontrado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {mostrarFormulario && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-xl shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b border-slate-800">
              <div>
                <h2 className="text-2xl font-bold text-white">
                  {produtoEditando
                    ? "Editar Produto"
                    : "Novo Produto"}
                </h2>

                <p className="text-slate-400 text-sm mt-1">
                  {produtoEditando
                    ? "Atualize os dados do produto"
                    : "Cadastre um novo produto no ERP"}
                </p>
              </div>

              <button
                type="button"
                onClick={fecharFormulario}
                className="text-slate-400 hover:text-white text-2xl"
              >
                ×
              </button>
            </div>

            <form
              onSubmit={salvarProduto}
              className="p-6"
            >
              <div className="mb-4">
                <label className="block text-slate-300 mb-2">
                  Nome do produto *
                </label>

                <input
                  type="text"
                  value={nome}
                  onChange={(event) => setNome(event.target.value)}
                  placeholder="Ex.: Filamento PLA Preto"
                  className="w-full bg-slate-800 border border-slate-700 text-white px-4 py-3 rounded-lg outline-none focus:border-cyan-500"
                  autoFocus
                />
              </div>

              <div className="mb-4">
                <label className="block text-slate-300 mb-2">
                  Código / SKU *
                </label>

                <input
                  type="text"
                  value={codigo}
                  onChange={(event) => setCodigo(event.target.value)}
                  placeholder="Ex.: PLA-PRETO-001"
                  className="w-full bg-slate-800 border border-slate-700 text-white px-4 py-3 rounded-lg outline-none focus:border-cyan-500 uppercase"
                />
              </div>

              <div className="mb-4">
                <label className="block text-slate-300 mb-2">
                  Descrição
                </label>

                <textarea
                  value={descricao}
                  onChange={(event) => setDescricao(event.target.value)}
                  placeholder="Descrição do produto..."
                  rows={3}
                  className="w-full bg-slate-800 border border-slate-700 text-white px-4 py-3 rounded-lg outline-none focus:border-cyan-500 resize-none"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="block text-slate-300 mb-2">
                    Preço *
                  </label>

                  <input
                    type="text"
                    inputMode="numeric"
                    value={preco}
                    onChange={(event) =>
                      setPreco(formatarMoedaDigitacao(event.target.value))
                    }
                    placeholder="R$ 0,00"
                    className="w-full bg-slate-800 border border-slate-700 text-white px-4 py-3 rounded-lg outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 mb-2">
                    Estoque mínimo
                  </label>

                  <input
                    type="number"
                    min="0"
                    value={estoqueMinimo}
                    onChange={(event) =>
                      setEstoqueMinimo(event.target.value)
                    }
                    className="w-full bg-slate-800 border border-slate-700 text-white px-4 py-3 rounded-lg outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div className="bg-slate-800/60 border border-slate-700 rounded-lg p-4 mb-6">
                <p className="text-sm text-slate-400">
                  {produtoEditando ? (
                    <>
                      Alterar os dados do produto não modifica o
                      estoque atual. Para entrada ou saída de
                      unidades, utilize o módulo{" "}
                      <strong className="text-cyan-400">
                        Estoque
                      </strong>
                      .
                    </>
                  ) : (
                    <>
                      O produto será cadastrado inicialmente com{" "}
                      <strong className="text-slate-200">
                        estoque 0
                      </strong>
                      . Para adicionar unidades, utilize o módulo{" "}
                      <strong className="text-cyan-400">
                        Estoque → Entrada
                      </strong>
                      .
                    </>
                  )}
                </p>
              </div>

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={fecharFormulario}
                  disabled={salvando}
                  className="px-5 py-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 disabled:opacity-50"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={salvando}
                  className="px-5 py-3 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold disabled:opacity-50"
                >
                  {salvando
                    ? "Salvando..."
                    : produtoEditando
                      ? "Salvar Alterações"
                      : "Cadastrar Produto"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Produtos;
