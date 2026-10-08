import { lazy, useEffect } from 'react';
import { Navigate, Route, BrowserRouter as Rotas, Routes } from 'react-router';
import { Layout } from './componentes/Layout.tsx';
import { usarLoja } from './store/viagem.ts';
import { Inicio } from './telas/Inicio.tsx';

/*
  Cada tela vira um pedaco proprio. Quem so abre a tela inicial nao baixa o
  mapa, o motor de exportacao nem a linha do tempo.
*/
const Calendario = lazy(() =>
  import('./telas/Calendario.tsx').then((m) => ({ default: m.Calendario })),
);
const Configuracao = lazy(() =>
  import('./telas/Configuracao.tsx').then((m) => ({ default: m.Configuracao })),
);
const Descobrir = lazy(() =>
  import('./telas/Descobrir.tsx').then((m) => ({ default: m.Descobrir })),
);
const DiaDaViagem = lazy(() =>
  import('./telas/DiaDaViagem.tsx').then((m) => ({ default: m.DiaDaViagem })),
);
const Exportar = lazy(() => import('./telas/Exportar.tsx').then((m) => ({ default: m.Exportar })));
const Orcamento = lazy(() =>
  import('./telas/Orcamento.tsx').then((m) => ({ default: m.Orcamento })),
);
const Reservas = lazy(() => import('./telas/Reservas.tsx').then((m) => ({ default: m.Reservas })));
const Selecao = lazy(() => import('./telas/Selecao.tsx').then((m) => ({ default: m.Selecao })));

export function App() {
  const carregar = usarLoja((e) => e.carregar);
  const carregado = usarLoja((e) => e.carregado);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  if (!carregado) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-[var(--cor-texto-suave)]">
        Abrindo suas viagens...
      </div>
    );
  }

  return (
    <Rotas>
      <Routes>
        <Route element={<Layout />} path="/">
          <Route element={<Inicio />} index />
          <Route path="viagem/:viagemId">
            <Route element={<Navigate replace to="descobrir" />} index />
            <Route element={<Configuracao />} path="config" />
            <Route element={<Descobrir />} path="descobrir" />
            <Route element={<Selecao />} path="selecao" />
            <Route element={<Calendario />} path="calendario" />
            <Route element={<DiaDaViagem />} path="dia/:diaId" />
            <Route element={<Orcamento />} path="orcamento" />
            <Route element={<Reservas />} path="reservas" />
            <Route element={<Exportar />} path="exportar" />
          </Route>
          <Route element={<Navigate replace to="/" />} path="*" />
        </Route>
      </Routes>
    </Rotas>
  );
}
