import { useEffect, useState } from "react";
import type { FormEvent } from "react";

type Cliente = {
  id: string;
  nome: string;
  cpf: string | null;
  email: string | null;
  telefone: string | null;
  cidade: string | null;
  ativo: boolean;
  criadoEm: string;
  atualizadoEm: string;
  excluidoEm: string | null;
};

function formatarCpf(valor: string) {
  const numeros = valor.replace(/\D/g, "").slice(0, 11);

  return numeros
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

function formatarTelefone(valor: string) {
  const numeros = valor.replace(/\D/g, "").slice(0, 11);

  if (numeros.length <= 10) {
    return numeros
      .replace(/(\d{2})(\d)/, "($1) $2")
      .replace(/(\d{4})(\d)/, "$1-$2");
  }

  return numeros
    .replace(/(\d{2})(\d)/, "($1) $2")
    .replace(/(\d{5})(\d)/, "$1-$2");
}
function formatarDataHora(valor: string | null) {
  if (!valor) {
    return "-";
  }

  return new Date(valor).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function Clientes() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");

  const [mostrarFormulario, setMostrarFormulario] =
    useState(false);

  const [clienteEditandoId, setClienteEditandoId] =
    useState<string | null>(null);

  const [nome, setNome] = useState("");
  const [cpf, setCpf] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [cidade, setCidade] = useState("");

  const token = localStorage.getItem("token");

  async function carregarClientes() {
    try {
      setCarregando(true);

      const resposta = await fetch(
        "http://localhost:3000/api/clientes",
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
      setErro("");
    } catch {
      setErro("Não foi possível carregar os clientes.");
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregarClientes();
  }, []);

  function limparFormulario() {
    setNome("");
    setCpf("");
    setEmail("");
    setTelefone("");
    setCidade("");
    setClienteEditandoId(null);
  }

  function abrirNovoCliente() {
    limparFormulario();
    setMostrarFormulario(true);
  }

  function editarCliente(cliente: Cliente) {
    setClienteEditandoId(cliente.id);

    setNome(cliente.nome);
    setCpf(
      cliente.cpf
        ? formatarCpf(cliente.cpf)
        : ""
    );

    setEmail(cliente.email || "");

    setTelefone(
      cliente.telefone
        ? formatarTelefone(cliente.telefone)
        : ""
    );

    setCidade(cliente.cidade || "");

    setMostrarFormulario(true);
  }

  function fecharFormulario() {
    setMostrarFormulario(false);
    limparFormulario();
  }

  async function salvarCliente(e: FormEvent) {
    e.preventDefault();

    try {
      setErro("");

      const editando = clienteEditandoId !== null;

      const url = editando
        ? `http://localhost:3000/api/clientes/${clienteEditandoId}`
        : "http://localhost:3000/api/clientes";

      const resposta = await fetch(url, {
        method: editando ? "PUT" : "POST",

        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },

        body: JSON.stringify({
          nome,
          cpf: cpf.replace(/\D/g, ""),
          email,
          telefone: telefone.replace(/\D/g, ""),
          cidade,
        }),
      });

      const dados = await resposta.json();

      if (!resposta.ok) {
        setErro(
          dados.erro ||
            "Não foi possível salvar o cliente."
        );

        return;
      }

      fecharFormulario();

      await carregarClientes();

    } catch {
      setErro("Não foi possível salvar o cliente.");
    }
  }

  async function excluirCliente(cliente: Cliente) {
    const confirmar = window.confirm(
      `Deseja realmente excluir ${cliente.nome}?`
    );

    if (!confirmar) {
      return;
    }

    try {
      const resposta = await fetch(
        `http://localhost:3000/api/clientes/${cliente.id}`,
        {
          method: "DELETE",

          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const dados = await resposta.json();

      if (!resposta.ok) {
        setErro(
          dados.erro ||
            "Não foi possível excluir o cliente."
        );

        return;
      }

      await carregarClientes();

    } catch {
      setErro("Não foi possível excluir o cliente.");
    }
  }

  return (
    <div>

      <div className="flex items-center justify-between mb-8">

        <div>
          <h1 className="text-3xl font-bold text-white">
            Clientes
          </h1>

          <p className="text-slate-400 mt-1">
            Gerencie os clientes cadastrados
          </p>
        </div>

        <button
          onClick={abrirNovoCliente}
          className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold px-5 py-3 rounded-lg"
        >
          + Novo Cliente
        </button>

      </div>

      {mostrarFormulario && (

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 mb-8">

          <div className="flex justify-between items-center mb-6">

            <h2 className="text-xl font-bold text-white">
              {clienteEditandoId
                ? "Editar Cliente"
                : "Novo Cliente"}
            </h2>

            <button
              onClick={fecharFormulario}
              className="text-slate-400 hover:text-white"
            >
              Fechar
            </button>

          </div>

          <form
            onSubmit={salvarCliente}
            className="grid grid-cols-1 md:grid-cols-2 gap-4"
          >

            <input
              type="text"
              placeholder="Nome"
              value={nome}
              onChange={(e) =>
                setNome(e.target.value)
              }
              required
              className="bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white outline-none focus:border-cyan-500"
            />

            <input
              type="text"
              placeholder="CPF"
              value={cpf}
              onChange={(e) =>
                setCpf(
                  formatarCpf(e.target.value)
                )
              }
              maxLength={14}
              className="bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white outline-none focus:border-cyan-500"
            />

            <input
              type="email"
              placeholder="E-mail"
              value={email}
              onChange={(e) =>
                setEmail(e.target.value)
              }
              className="bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white outline-none focus:border-cyan-500"
            />

            <input
              type="text"
              placeholder="Celular"
              value={telefone}
              onChange={(e) =>
                setTelefone(
                  formatarTelefone(
                    e.target.value
                  )
                )
              }
              maxLength={15}
              className="bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white outline-none focus:border-cyan-500"
            />

            <input
              type="text"
              placeholder="Cidade"
              value={cidade}
              onChange={(e) =>
                setCidade(e.target.value)
              }
              className="bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white outline-none focus:border-cyan-500"
            />

            <button
              type="submit"
              className="bg-green-600 hover:bg-green-500 text-white font-semibold rounded-lg px-5 py-3"
            >
              {clienteEditandoId
                ? "Salvar Alterações"
                : "Salvar Cliente"}
            </button>

          </form>

        </div>
      )}

      {erro && (
        <div className="bg-red-950 border border-red-800 text-red-300 p-4 rounded-lg mb-5">
          {erro}
        </div>
      )}

      {carregando ? (

        <p className="text-slate-400">
          Carregando clientes...
        </p>

      ) : (

        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-x-auto">

          <table className="w-full">

            <thead className="bg-slate-800">

              <tr className="text-left text-slate-300">
                <th className="p-4">Nome</th>
                <th className="p-4">CPF</th>
                <th className="p-4">E-mail</th>
                <th className="p-4">Celular</th>
                <th className="p-4">Cidade</th>
                <th className="p-4">Status</th>
                <th className="p-4">Criado em</th>
                <th className="p-4">Excluído em</th>
                <th className="p-4">Ações</th>
              </tr>

            </thead>

            <tbody>

              {clientes.map((cliente) => (

                <tr
                  key={cliente.id}
                  className="border-t border-slate-800 text-slate-200 hover:bg-slate-800/40"
                >

                  <td className="p-4 font-medium">
                    {cliente.nome}
                  </td>

                  <td className="p-4">
                    {cliente.cpf
                      ? formatarCpf(cliente.cpf)
                      : "-"}
                  </td>

                  <td className="p-4">
                    {cliente.email || "-"}
                  </td>

                  <td className="p-4">
                    {cliente.telefone
                      ? formatarTelefone(
                          cliente.telefone
                        )
                      : "-"}
                  </td>

                  <td className="p-4">
                    {cliente.cidade || "-"}
                  </td>

                  <td className="p-4">
                    {cliente.ativo ? (
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
                      {formatarDataHora(cliente.criadoEm)}
                    </td>

                    <td className="p-4">
                      {formatarDataHora(cliente.excluidoEm)}
                    </td>

                    <div className="flex gap-2">

                      <button
                        onClick={() =>
                          editarCliente(cliente)
                        }
                        className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-2 rounded-lg text-sm"
                      >
                        Editar
                      </button>

                      <button
                        onClick={() =>
                          excluirCliente(cliente)
                        }
                        className="bg-red-600 hover:bg-red-500 text-white px-3 py-2 rounded-lg text-sm"
                      >
                        Excluir
                      </button>

                    </div>
                    <td>

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

export default Clientes;