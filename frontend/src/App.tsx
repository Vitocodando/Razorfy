import { AppRoutes } from './core/routes/AppRoutes'

// Casca de inicialização: delega todo o roteamento/gate ao AppRoutes (core/routes).
// Toda a lógica de domínio vive em /core e /modules (refatoração do monólito concluída).
export default function App() {
  return <AppRoutes />
}
