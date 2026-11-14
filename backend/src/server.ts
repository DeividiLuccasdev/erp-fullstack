import app from "./app.ts";
import { garantirUsuarioDemoSeHabilitado } from "./lib/usuarioDemo.ts";

const PORT = Number(process.env.PORT) || 3000;

// No Render (ou com CRIAR_USUARIO_DEMO=true) a conta de demonstração é
// criada ou restaurada antes de aceitar conexões; se falhar, não sobe.
try {
  if (await garantirUsuarioDemoSeHabilitado()) {
    console.log("Conta de demonstração garantida.");
  }
} catch (erro) {
  console.error("Falha ao garantir a conta de demonstração:", erro);
  process.exit(1);
}

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
