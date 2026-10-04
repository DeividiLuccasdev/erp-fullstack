import { API_URL } from "./api";
import { useEffect, useState } from "react";

import {
  LockKeyhole,
  Eye,
  EyeOff,
  ShieldCheck,
  LayoutDashboard,
  Users,
  Package,
  Boxes,
  ShoppingCart,
  LogOut,
  CircleDollarSign,
  ShoppingBag,
  XCircle,
  TriangleAlert,
  Menu,
  X,
} from "lucide-react";

import Clientes from "./pages/Clientes";
import Produtos from "./pages/Produtos";
import Estoque from "./pages/Estoque";
import Vendas from "./pages/Vendas";


type DashboardDados = {
  resumo: {
    totalClientes: number;
    totalProdutos: number;
    pedidosAbertos: number;
    vendasFinalizadas: number;
    pedidosCancelados: number;
    faturamentoTotal: number;
    produtosEstoqueBaixo: number;
  };
};
type CardProps = {
  titulo: string;
  valor: string | number;
  icone: React.ReactNode;
};

function Card({ titulo, valor, icone }: CardProps) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 hover:border-slate-700 transition">

      <div className="flex items-center justify-between">

        <div>
          <p className="text-slate-400 text-sm">
            {titulo}
          </p>

          <h2 className="text-3xl font-bold text-white mt-2">
            {valor}
          </h2>
        </div>

        <div className="w-12 h-12 shrink-0 rounded-xl bg-slate-800 flex items-center justify-center text-cyan-400">
          {icone}
        </div>

      </div>

    </div>
  );
}

const PAGINAS = [
  { id: "dashboard", titulo: "Dashboard", Icone: LayoutDashboard },
  { id: "clientes", titulo: "Clientes", Icone: Users },
  { id: "produtos", titulo: "Produtos", Icone: Package },
  { id: "estoque", titulo: "Estoque", Icone: Boxes },
  { id: "vendas", titulo: "Vendas", Icone: ShoppingCart },
];

// Devolve o token salvo só se ele ainda não expirou; um token vencido
// é descartado para que a tela de login apareça
function tokenValido(token: string | null) {
  if (!token) return null;

  try {
    const payload = JSON.parse(
      atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))
    );

    if (typeof payload.exp === "number" && payload.exp * 1000 > Date.now()) {
      return token;
    }
  } catch {
    // token corrompido: trata como sessão encerrada
  }

  localStorage.removeItem("token");
  localStorage.removeItem("usuario");
  return null;
}

function sair() {
  localStorage.removeItem("token");
  localStorage.removeItem("usuario");
  window.location.reload();
}

function App() {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [mostrarSenha, setMostrarSenha] = useState(false);

  const [dashboard, setDashboard] =
    useState<DashboardDados | null>(null);

  const token = tokenValido(localStorage.getItem("token"));
  const usuarioSalvo = localStorage.getItem("usuario");

  const usuario = usuarioSalvo
    ? JSON.parse(usuarioSalvo)
    : null;

  const [paginaAtual, setPaginaAtual] = useState("dashboard");
  const [menuAberto, setMenuAberto] = useState(false);

useEffect(() => {
  async function carregarDashboard() {
    if (!token || paginaAtual !== "dashboard") {
      return;
    }

    try {
      const resposta = await fetch(
        `${API_URL}/api/dashboard`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (resposta.status === 401) {
        sair();
        return;
      }

      if (!resposta.ok) {
        throw new Error();
      }

      const dados = await resposta.json();
      setDashboard(dados);

    } catch {
      console.error("Erro ao carregar dashboard.");
    }
  }

  carregarDashboard();
}, [token, paginaAtual]);

  async function fazerLogin(e: React.FormEvent) {
    e.preventDefault();

    setErro("");
    setCarregando(true);

    try {
      const resposta = await fetch(
        `${API_URL}/api/auth/login`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email,
            senha,
          }),
        }
      );

      const dados = await resposta.json();

      if (!resposta.ok) {
        setErro(dados.erro || "Erro ao realizar login.");
        return;
      }

      localStorage.setItem("token", dados.token);
      localStorage.setItem(
        "usuario",
        JSON.stringify(dados.usuario)
      );

      window.location.reload();

    } catch {
      setErro("Não foi possível conectar ao servidor.");
    } finally {
      setCarregando(false);
    }
  }

 if (token && usuario) {
  return (
    <div className="min-h-screen bg-slate-950 text-white md:flex">

      {/* BARRA SUPERIOR (CELULAR) */}
      <header className="md:hidden fixed top-0 inset-x-0 z-30 h-14 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-4">
        <span className="font-bold">ERP Full-Stack</span>

        <button
          onClick={() => setMenuAberto(true)}
          aria-label="Abrir menu"
          className="p-2 -mr-2 rounded-lg text-slate-300 hover:bg-slate-800"
        >
          <Menu size={22} />
        </button>
      </header>

      {/* Fundo escuro atrás do menu aberto no celular */}
      {menuAberto && (
        <div
          onClick={() => setMenuAberto(false)}
          className="md:hidden fixed inset-0 z-40 bg-black/60"
        />
      )}

      {/* MENU LATERAL: gaveta no celular, fixo a partir do tablet */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 border-r border-slate-800 p-5 flex flex-col overflow-y-auto transition-transform md:sticky md:top-0 md:h-screen md:translate-x-0 ${
          menuAberto ? "translate-x-0" : "-translate-x-full"
        }`}
      >

        <div className="mb-10 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold">
              ERP Full-Stack
            </h1>

            <p className="text-slate-500 text-sm mt-1">
              Gestão Comercial
            </p>
          </div>

          <button
            onClick={() => setMenuAberto(false)}
            aria-label="Fechar menu"
            className="md:hidden p-1 rounded-lg text-slate-400 hover:bg-slate-800"
          >
            <X size={22} />
          </button>
        </div>

        <nav className="space-y-2 flex-1">
          {PAGINAS.map(({ id, titulo, Icone }) => (
            <button
              key={id}
              onClick={() => {
                setPaginaAtual(id);
                setMenuAberto(false);
              }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition ${
                paginaAtual === id
                  ? "bg-cyan-500 text-slate-950 font-semibold"
                  : "text-slate-300 hover:bg-slate-800"
              }`}
            >
              <Icone size={20} />
              {titulo}
            </button>
          ))}
        </nav>

        <div className="border-t border-slate-800 pt-5 mt-5">

          <p className="text-sm font-medium">
            {usuario.nome}
          </p>

          <p className="text-xs text-slate-500 mb-4">
            {usuario.perfil}
          </p>

          <button
            onClick={sair}
            className="w-full flex items-center justify-center gap-2 bg-red-600 hover:bg-red-500 py-2.5 rounded-lg transition"
          >
            <LogOut size={18} />
            Sair
          </button>

        </div>

      </aside>

      {/* CONTEÚDO */}
      <main className="flex-1 min-w-0 px-4 pb-6 pt-20 md:p-8">

        {paginaAtual === "dashboard" && (
  <>
        <div className="mb-8">
          <h2 className="text-2xl md:text-3xl font-bold">
            Dashboard
          </h2>

          <p className="text-slate-400 mt-1">
            Bem-vindo, {usuario.nome}
          </p>
        </div>

        {!dashboard ? (
          <p className="text-slate-400">
            Carregando dashboard...
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">

           <Card
  titulo="Clientes"
  valor={dashboard.resumo.totalClientes}
  icone={<Users size={24} />}
/>

<Card
  titulo="Produtos"
  valor={dashboard.resumo.totalProdutos}
  icone={<Package size={24} />}
/>

<Card
  titulo="Pedidos abertos"
  valor={dashboard.resumo.pedidosAbertos}
  icone={<ShoppingBag size={24} />}
/>

<Card
  titulo="Vendas finalizadas"
  valor={dashboard.resumo.vendasFinalizadas}
  icone={<ShoppingCart size={24} />}
/>

<Card
  titulo="Cancelados"
  valor={dashboard.resumo.pedidosCancelados}
  icone={<XCircle size={24} />}
/>

<Card
  titulo="Estoque baixo"
  valor={dashboard.resumo.produtosEstoqueBaixo}
  icone={<TriangleAlert size={24} />}
/>

<div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 hover:border-slate-700 transition">

  <div className="flex items-center justify-between">

    <div>
      <p className="text-slate-400 text-sm">
        Faturamento total
      </p>

      <h2 className="text-3xl font-bold mt-2 text-green-400">
        {dashboard.resumo.faturamentoTotal.toLocaleString(
          "pt-BR",
          {
            style: "currency",
            currency: "BRL",
          }
        )}
      </h2>
    </div>

    <div className="w-12 h-12 shrink-0 rounded-xl bg-green-500/10 flex items-center justify-center text-green-400">
      <CircleDollarSign size={26} />
    </div>

  </div>

</div>

</div>

)}

</>

)}

{/* Tela de Clientes */}
{paginaAtual === "clientes" && (
  <Clientes />
)}


{paginaAtual === "produtos" && (
  <Produtos />
)}

{paginaAtual === "estoque" && (
  <Estoque />
)}

{paginaAtual === "vendas" && <Vendas />}

</main>

</div>
);
}

// ========================================
// TELA DE LOGIN
// ========================================

return (
  <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4 relative overflow-hidden">

    {/* Efeito de fundo */}
    <div className="absolute w-[500px] h-[500px] bg-cyan-500/10 rounded-full blur-3xl top-[-200px] left-[-150px]" />

    <div className="absolute w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-3xl bottom-[-250px] right-[-150px]" />

    <div className="relative w-full max-w-md bg-slate-900/95 border border-slate-800 rounded-2xl p-8 shadow-2xl">

      {/* Cabeçalho */}
      <div className="text-center mb-8">

        <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
          <ShieldCheck
            size={32}
            className="text-cyan-400"
          />
        </div>

        <h1 className="text-3xl font-bold text-white">
          ERP Full-Stack
        </h1>

        <p className="text-slate-400 mt-2">
          Gestão Comercial
        </p>

        <p className="text-slate-500 text-sm mt-1">
          Acesse sua conta para continuar
        </p>

      </div>

      <form
        onSubmit={fazerLogin}
        className="space-y-5"
      >

        {/* E-MAIL */}
        <div>

          <label className="block text-slate-300 text-sm font-medium mb-2">
            E-mail
          </label>

          <div className="relative">

            <LockKeyhole
              size={20}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"
            />

            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="Digite seu e-mail"
              className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl pl-12 pr-4 py-3.5 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 placeholder:text-slate-500"
            />

          </div>

        </div>


        {/* SENHA */}
        <div>

          <label className="block text-slate-300 text-sm font-medium mb-2">
            Senha
          </label>

          <div className="relative">

            <input
              type={mostrarSenha ? "text" : "password"}
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              required
              placeholder="Digite sua senha"
              className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-4 pr-12 py-3.5 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 placeholder:text-slate-500"
            />

            <button
              type="button"
              onClick={() => setMostrarSenha(!mostrarSenha)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-cyan-400 transition"
              title={mostrarSenha ? "Ocultar senha" : "Mostrar senha"}
            >

              {mostrarSenha ? (
                <EyeOff size={20} />
              ) : (
                <Eye size={20} />
              )}

            </button>

          </div>

        </div>


        {/* ERRO */}
        {erro && (
          <div className="bg-red-950/60 border border-red-800 text-red-300 p-3 rounded-xl text-sm">
            {erro}
          </div>
        )}


        {/* BOTÃO */}
        <button
          type="submit"
          disabled={carregando}
          className="w-full bg-cyan-500 hover:bg-cyan-400 active:bg-cyan-600 disabled:opacity-50 text-slate-950 font-bold py-3.5 rounded-xl transition shadow-lg shadow-cyan-500/10"
        >
          {carregando ? "Entrando..." : "Entrar"}
        </button>

      </form>


      <div className="border-t border-slate-800 mt-8 pt-5">

        <p className="text-center text-slate-600 text-xs">
          Sistema de Gestão Comercial
        </p>

      </div>

    </div>

  </div>

);

}
export default App;