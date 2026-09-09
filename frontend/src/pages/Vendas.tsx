import { API_URL } from "../api";
import { useEffect, useState } from "react";

type Pedido = {
  id: string;
  status: "ABERTO" | "FINALIZADO" | "CANCELADO";
  total: number;
  criadoEm: string;
  finalizadoEm: string | null;
  canceladoEm: string | null;

  cliente: {
    id: string;
    nome: string;
  } | null;

  usuario: {
    id: string;
    nome: string;
  };

  _count: {
    itens: number;
  };
};

type Cliente = {
  id: string;
  nome: string;
};
type Produto = {
  id: string;
  nome: string;
  codigo: string;
  preco: number;
  estoque: number;
};

type ItemPedido = {
  id: string;
  quantidade: number;
  precoUnitario: number | string;
  subtotal: number | string;

  produto: {
    id: string;
    nome: string;
    codigo: string;
  };
};

type PedidoDetalhado = {
  id: string;
  status: "ABERTO" | "FINALIZADO" | "CANCELADO";
  total: number | string;
  criadoEm: string;
  finalizadoEm: string | null;
  canceladoEm: string | null;

  cliente: {
    id: string;
    nome: string;
  } | null;

  usuario: {
    id: string;
    nome: string;
  };

  itens: ItemPedido[];
};


function Vendas() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [mostrarNovaVenda, setMostrarNovaVenda] = useState(false);
  const [clienteId, setClienteId] = useState("");
  const [criandoVenda, setCriandoVenda] = useState(false);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [pedidoSelecionado, setPedidoSelecionado] = useState("");
  const [produtoId, setProdutoId] = useState("");
  const [quantidade, setQuantidade] = useState("1");
  const [adicionandoItem, setAdicionandoItem] = useState(false);
  const [detalhesPedido, setDetalhesPedido] =
  useState<PedidoDetalhado | null>(null);

const [carregandoDetalhes, setCarregandoDetalhes] =
  useState(false);

  const token = localStorage.getItem("token");

  async function carregarPedidos() {
    try {
      const resposta = await fetch(
        `${API_URL}/api/pedidos`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!resposta.ok) {
        throw new Error();
      }

      const dados = await resposta.json();

      setPedidos(dados);

    } catch {
      setErro("Não foi possível carregar as vendas.");
    } finally {
      setCarregando(false);
    }
  }

  async function carregarClientes() {
  try {
    const resposta = await fetch(
      `${API_URL}/api/clientes`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!resposta.ok) {
      throw new Error();
    }

    const dados = await resposta.json();
    setClientes(dados);

  } catch {
    setErro("Não foi possível carregar os clientes.");
  }
}

async function carregarProdutos() {
  try {
    const resposta = await fetch(
      `${API_URL}/api/produtos`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!resposta.ok) {
      throw new Error();
    }

    const dados = await resposta.json();

    setProdutos(dados);

  } catch {
    setErro("Não foi possível carregar os produtos.");
  }
}

useEffect(() => {
  carregarPedidos();
  carregarClientes();
  carregarProdutos();
}, []);

async function criarVenda() {
  setErro("");
  setCriandoVenda(true);

  try {
    const resposta = await fetch(
      `${API_URL}/api/pedidos`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          clienteId: clienteId || null,
        }),
      }
    );

    const dados = await resposta.json();

if (!resposta.ok) {
  setErro(dados.erro || "Erro ao criar venda.");
  return;
}

// Guarda o pedido que acabou de ser criado
const novoPedidoId = dados.pedido?.id ?? dados.id;

if (!novoPedidoId) {
  setErro("Pedido criado, mas não foi possível identificar o ID.");
  await carregarPedidos();
  return;
}

setPedidoSelecionado(novoPedidoId);

setMostrarNovaVenda(false);

setClienteId("");

await carregarPedidos();
   
  } catch {
    setErro("Não foi possível conectar ao servidor.");
  } finally {
    setCriandoVenda(false);
  }
}
async function adicionarItem() {
  if (!pedidoSelecionado) {
    setErro("Selecione um pedido.");
    return;
  }

  if (!produtoId) {
    setErro("Selecione um produto.");
    return;
  }

  if (Number(quantidade) <= 0) {
    setErro("Informe uma quantidade válida.");
    return;
  }

  setErro("");
  setAdicionandoItem(true);

  try {
    const resposta = await fetch(
      `${API_URL}/api/pedidos/${pedidoSelecionado}/itens`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          produtoId,
          quantidade: Number(quantidade),
        }),
      }
    );

    const dados = await resposta.json();

    if (!resposta.ok) {
      setErro(dados.erro || "Erro ao adicionar produto.");
      return;
    }

    setProdutoId("");
    setQuantidade("1");

    await carregarPedidos();

  } catch {
    setErro("Não foi possível conectar ao servidor.");
  } finally {
    setAdicionandoItem(false);
  }
}

async function finalizarVenda(pedidoId: string) {
  setErro("");

  try {
    const resposta = await fetch(
      `${API_URL}/api/pedidos/${pedidoId}/finalizar`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    const dados = await resposta.json();

    if (!resposta.ok) {
      setErro(dados.erro || "Erro ao finalizar venda.");
      return;
    }

    setPedidoSelecionado("");
    await carregarPedidos();
    await carregarProdutos();

  } catch {
    setErro("Não foi possível conectar ao servidor.");
  }
}

async function cancelarVenda(pedidoId: string) {
  setErro("");

  try {
    const resposta = await fetch(
      `${API_URL}/api/pedidos/${pedidoId}/cancelar`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    const dados = await resposta.json();

    if (!resposta.ok) {
      setErro(dados.erro || "Erro ao cancelar venda.");
      return;
    }

    setPedidoSelecionado("");
    await carregarPedidos();

  } catch {
    setErro("Não foi possível conectar ao servidor.");
  }
}

async function verDetalhes(pedidoId: string) {
  setErro("");
  setCarregandoDetalhes(true);

  try {
    const resposta = await fetch(
      `${API_URL}/api/pedidos/${pedidoId}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    const dados = await resposta.json();

    if (!resposta.ok) {
      setErro(dados.erro || "Erro ao carregar detalhes da venda.");
      return;
    }

    setDetalhesPedido(dados);

  } catch {
    setErro("Não foi possível conectar ao servidor.");
  } finally {
    setCarregandoDetalhes(false);
  }
}

  function corStatus(status: Pedido["status"]) {
    if (status === "FINALIZADO") {
      return "text-green-400";
    }

    if (status === "CANCELADO") {
      return "text-red-400";
    }

    return "text-yellow-400";
  }

  return (
    <div className="space-y-8">

      <div className="flex justify-between items-center">

        <div>
          <h1 className="text-3xl font-bold text-white">
            Vendas
          </h1>

          <p className="text-slate-400 mt-1">
            Pedidos e vendas realizadas
          </p>
        </div>

      <button
            onClick={() => setMostrarNovaVenda(true)}
            className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold px-5 py-3 rounded-lg"
          >
            + Nova Venda
      </button>
      </div>

      {carregando && (
        <p className="text-slate-400">
          Carregando vendas...
        </p>
      )}

      {erro && (
        <div className="bg-red-950 border border-red-800 text-red-300 p-4 rounded-lg">
          {erro}
        </div>
      )}

      {mostrarNovaVenda && (
  <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">

    <h2 className="text-xl font-semibold text-white mb-5">
      Nova Venda
    </h2>

    <label className="block text-slate-300 mb-2">
      Cliente
    </label>

    <select
      value={clienteId}
      onChange={(e) => setClienteId(e.target.value)}
      className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-4 py-3 mb-5"
    >
      <option value="">
        Venda sem cliente
      </option>

      {clientes.map((cliente) => (
        <option
          key={cliente.id}
          value={cliente.id}
        >
          {cliente.nome}
        </option>
      ))}
    </select>

    <div className="flex gap-3">

      <button
        onClick={criarVenda}
        disabled={criandoVenda}
        className="bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-slate-950 font-semibold px-5 py-3 rounded-lg"
      >
        {criandoVenda ? "Criando..." : "Criar Venda"}
      </button>

      <button
        onClick={() => setMostrarNovaVenda(false)}
        className="bg-slate-700 hover:bg-slate-600 text-white px-5 py-3 rounded-lg"
      >
        Cancelar
      </button>

    </div>
  </div>
)}

{pedidoSelecionado && (
  <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">

    <h2 className="text-xl font-semibold text-white mb-2">
      Adicionar produto
    </h2>

    <p className="text-slate-400 mb-5">
      Venda criada. Agora escolha o produto e a quantidade.
    </p>

    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

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
            {produto.nome}
          </option> 
        ))}

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

      <div className="flex items-end">
        <button
          onClick={adicionarItem}
          disabled={adicionandoItem}
          className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold px-5 py-3 rounded-lg"
        >
          {adicionandoItem
            ? "Adicionando..."
            : "Adicionar Produto"}
        </button>
      </div>

    </div>
  </div>
)}
{carregandoDetalhes && (
  <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 text-slate-400">
    Carregando detalhes...
  </div>
)}

{detalhesPedido && !carregandoDetalhes && (
  <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">

    <div className="flex justify-between items-center mb-6">

      <div>
        <h2 className="text-xl font-semibold text-white">
          Detalhes da Venda
        </h2>

        <p className="text-slate-400 text-sm mt-1">
          Pedido {detalhesPedido.id.substring(0, 8)}
        </p>
      </div>

      <button
        onClick={() => setDetalhesPedido(null)}
        className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-lg"
      >
        Fechar
      </button>

    </div>

    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">

      <div>
        <p className="text-slate-500 text-sm">
          Cliente
        </p>

        <p className="text-white">
          {detalhesPedido.cliente?.nome || "Sem cliente"}
        </p>
      </div>

      <div>
        <p className="text-slate-500 text-sm">
          Vendedor
        </p>

        <p className="text-white">
          {detalhesPedido.usuario.nome}
        </p>
      </div>

      <div>
        <p className="text-slate-500 text-sm">
          Status
        </p>

        <p className={corStatus(detalhesPedido.status)}>
          {detalhesPedido.status}
        </p>
      </div>

      <div>
        <p className="text-slate-500 text-sm">
          Total
        </p>

        <p className="text-green-400 font-semibold">
          {Number(detalhesPedido.total).toLocaleString(
            "pt-BR",
            {
              style: "currency",
              currency: "BRL",
            }
          )}
        </p>
      </div>

    </div>

    <div className="overflow-hidden rounded-lg border border-slate-800">

      <table className="w-full">

        <thead className="bg-slate-800">
          <tr className="text-left text-slate-300">
            <th className="p-4">Produto</th>
            <th className="p-4">Código</th>
            <th className="p-4">Quantidade</th>
            <th className="p-4">Preço</th>
            <th className="p-4">Subtotal</th>
          </tr>
        </thead>

        <tbody>

          {detalhesPedido.itens.map((item) => (
            <tr
              key={item.id}
              className="border-t border-slate-800 text-slate-200"
            >

              <td className="p-4">
                {item.produto.nome}
              </td>

              <td className="p-4">
                {item.produto.codigo}
              </td>

              <td className="p-4">
                {item.quantidade}
              </td>

              <td className="p-4">
                {Number(item.precoUnitario).toLocaleString(
                  "pt-BR",
                  {
                    style: "currency",
                    currency: "BRL",
                  }
                )}
              </td>

              <td className="p-4 font-semibold">
                {Number(item.subtotal).toLocaleString(
                  "pt-BR",
                  {
                    style: "currency",
                    currency: "BRL",
                  }
                )}
              </td>

            </tr>
          ))}

        </tbody>

      </table>

    </div>

  </div>
)}

      {!carregando && !erro && (

        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">

          <table className="w-full">

            <thead className="bg-slate-800">
              <tr className="text-left text-slate-300">
                <th className="p-4">Pedido</th>
                <th className="p-4">Cliente</th>
                <th className="p-4">Vendedor</th>
                <th className="p-4">Itens</th>
                <th className="p-4">Total</th>
                <th className="p-4">Status</th>
                <th className="p-4">Data</th>
                <th className="p-4">Hora</th>
                <th className="p-4">Ações</th>
              </tr>
            </thead>

            <tbody>

              {pedidos.map((pedido) => {

                const data = new Date(pedido.criadoEm);

                return (
                  <tr
                    key={pedido.id}
                    className="border-t border-slate-800 text-slate-200"
                  >

                    <td className="p-4">
                      {pedido.id.substring(0, 8)}
                    </td>

                    <td className="p-4 font-medium">
                      {pedido.cliente?.nome || "Sem cliente"}
                    </td>

                    <td className="p-4">
                      {pedido.usuario.nome}
                    </td>

                    <td className="p-4">
                      {pedido._count.itens}
                    </td>

                    <td className="p-4 font-semibold">
                      {Number(pedido.total).toLocaleString(
                        "pt-BR",
                        {
                          style: "currency",
                          currency: "BRL",
                        }
                      )}
                    </td>

                    <td className="p-4">
                      <span
                        className={`font-medium ${corStatus(
                          pedido.status
                        )}`}
                      >
                        {pedido.status}
                      </span>
                    </td>

                    <td className="p-4">
                      {data.toLocaleDateString("pt-BR")}
                    </td>

                    <td className="p-4">
                      {data.toLocaleTimeString("pt-BR")}
                    </td>
                    <td className="p-4">
  {pedido.status === "ABERTO" ? (
<div className="flex gap-2">

  <button
    onClick={() => verDetalhes(pedido.id)}
    className="bg-slate-700 hover:bg-slate-600 text-white px-3 py-2 rounded-lg"
  >
    Detalhes
  </button>

  <button
    onClick={() => setPedidoSelecionado(pedido.id)}
    className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-2 rounded-lg"
  >
    Produtos
  </button>

  <button
    onClick={() => finalizarVenda(pedido.id)}
    disabled={pedido._count.itens === 0}
    className="bg-green-600 hover:bg-green-500 disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed text-white px-3 py-2 rounded-lg"
  >
    Finalizar
  </button>

  <button
    onClick={() => cancelarVenda(pedido.id)}
    className="bg-red-600 hover:bg-red-500 text-white px-3 py-2 rounded-lg"
  >
    Cancelar
  </button>

</div>
) : (
  <button
    onClick={() => verDetalhes(pedido.id)}
    className="bg-slate-700 hover:bg-slate-600 text-white px-3 py-2 rounded-lg"
  >
    Detalhes
  </button>
)}
</td>

                  </tr>
                );
              })}

            </tbody>

          </table>

        </div>
      )}

    </div>
  );
}

export default Vendas;