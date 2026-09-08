import clientesRoutes from "./routes/clientes.routes.ts";
import produtosRoutes from "./routes/produtos.routes.ts";
import estoqueRoutes from "./routes/estoque.routes.ts";
import pedidosRoutes from "./routes/pedidos.routes.ts";
import dashboardRoutes from "./routes/dashboard.routes.ts";
import usuariosRoutes from "./routes/usuarios.routes.ts";
import authRoutes from "./routes/auth.routes.ts";

import express from "express";
import cors from "cors";
import "dotenv/config";

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/clientes", clientesRoutes);
app.use("/api/produtos", produtosRoutes);
app.use("/api/estoque", estoqueRoutes);
app.use("/api/pedidos", pedidosRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/auth", authRoutes);
app.use("/api", usuariosRoutes);

app.get("/", (req, res) => {
  res.json({
    mensagem: "ERP Full-Stack API funcionando!"
  });
});

const PORT = Number(process.env.PORT) || 3000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});