import { lazy, useEffect } from 'react';
import { Navigate, Route, HashRouter as Rotas, Routes } from 'react-router';
import { Layout } from './componentes/Layout.tsx';
import { usarLoja } from './store/viagem.ts';
import { Inicio } from './telas/Inicio.tsx';

/*
  Cada tela vira um pedaco proprio. Quem so abre a tela inicial nao baixa o
  mapa, o motor de exportacao nem a linha do tempo.
*/
const Agora = lazy(() => import('./telas/Agora.tsx').then((m) => ({ default: m.Agora })));
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
const Documentos = lazy(() =>
  import('./telas/Documentos.tsx').then((m) => ({ default: m.Documentos })),
);
const Dormir = lazy(() => import('./telas/Dormir.tsx').then((m) => ({ default: m.Dormir })));
const Exportar = lazy(() => import('./telas/Exportar.tsx').then((m) => ({ default: m.Exportar })));
const Orcamento = lazy(() =>
  import('./telas/Orcamento.tsx').then((m) => ({ default: m.Orcamento })),
);
const Reservas = lazy(() => import('./telas/Reservas.tsx').then((m) => ({ default: m.Reservas })));
const Selecao = lazy(() => import('./telas/Selecao.tsx').then((m) => ({ default: m.Selecao })));

/*
  Rotas com # de proposito.

  O app e um site estatico que precisa rodar em qualquer lugar: GitHub
  Pages numa subpasta, Netlify, um pendrive, uma pasta local. Com rota
  normal, recarregar a pagina em /viagem/abc/dia/xyz pede que o servidor
  devolva o index.html para qualquer caminho — e o GitHub Pages nao faz
  isso sem gambiarra. Com #, recarregar e abrir link direto funcionam em
  todo lugar. O preco e a URL mais feia; o beneficio e nao quebrar.
*/
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
            <Route element={<Agora />} path="agora" />
            <Route element={<Configuracao />} path="config" />
            <Route element={<Descobrir />} path="descobrir" />
            <Route element={<Selecao />} path="selecao" />
            <Route element={<Dormir />} path="dormir" />
            <Route element={<Documentos />} path="documentos" />
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
