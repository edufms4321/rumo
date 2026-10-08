/**
 * Mapa do dia com a rota numerada.
 *
 * MapLibre com tiles do OpenFreeMap: gratuito, sem chave, sem cartao. Ver
 * docs/DECISOES.md, D9. O mapa e carregado so quando o painel abre, porque
 * a biblioteca e pesada e a maioria das sessoes nunca o usa.
 */
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useEffect, useRef } from 'react';
import type { DiaResolvido } from '../engine/resolver-dia.ts';
import { paraHHMM } from '../engine/tempo.ts';

const ESTILO = 'https://tiles.openfreemap.org/styles/liberty';

export function MapaDoDia({ resolvido }: { resolvido: DiaResolvido }) {
  const caixa = useRef<HTMLDivElement>(null);
  const mapa = useRef<maplibregl.Map | undefined>(undefined);

  const pontos = resolvido.blocos
    .map((b, indice) => ({
      ordem: indice + 1,
      nome: b.rotulo,
      hora: paraHHMM(b.intervalo.inicio),
      coords: b.entrada?.coords,
    }))
    .filter((p): p is typeof p & { coords: { lat: number; lng: number } } => Boolean(p.coords));

  useEffect(() => {
    if (!caixa.current || pontos.length === 0 || mapa.current) return;

    const m = new maplibregl.Map({
      container: caixa.current,
      style: ESTILO,
      center: [pontos[0]!.coords.lng, pontos[0]!.coords.lat],
      zoom: 12,
      attributionControl: { compact: true },
    });
    mapa.current = m;

    m.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');

    m.on('load', () => {
      for (const p of pontos) {
        const alfinete = document.createElement('div');
        alfinete.textContent = String(p.ordem);
        alfinete.setAttribute('aria-label', `${p.ordem}. ${p.nome}`);
        alfinete.style.cssText =
          'width:26px;height:26px;border-radius:50%;background:var(--cor-acento);' +
          'color:var(--cor-acento-texto);display:flex;align-items:center;justify-content:center;' +
          'font:600 12px/1 var(--font-sans);box-shadow:0 2px 6px rgba(0,0,0,.35);cursor:pointer';

        new maplibregl.Marker({ element: alfinete })
          .setLngLat([p.coords.lng, p.coords.lat])
          .setPopup(
            new maplibregl.Popup({ offset: 16 }).setHTML(
              `<strong>${p.hora}</strong><br>${p.nome.replace(/</g, '&lt;')}`,
            ),
          )
          .addTo(m);
      }

      if (pontos.length > 1) {
        m.addSource('rota', {
          type: 'geojson',
          data: {
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'LineString',
              coordinates: pontos.map((p) => [p.coords.lng, p.coords.lat]),
            },
          },
        });
        m.addLayer({
          id: 'rota',
          type: 'line',
          source: 'rota',
          paint: {
            'line-color': '#1d6a8c',
            'line-width': 2.5,
            'line-dasharray': [2, 1.5],
            'line-opacity': 0.8,
          },
        });

        const limites = new maplibregl.LngLatBounds();
        for (const p of pontos) limites.extend([p.coords.lng, p.coords.lat]);
        m.fitBounds(limites, { padding: 60, maxZoom: 15, duration: 0 });
      }
    });

    return () => {
      m.remove();
      mapa.current = undefined;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (pontos.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-[var(--cor-texto-suave)]">
        Nenhum bloco deste dia tem coordenada no banco, entao nao ha o que desenhar. A pesquisa
        marca esses itens com o aviso &quot;coordenada nao encontrada&quot;.
      </p>
    );
  }

  return (
    <div>
      <div className="h-[26rem] w-full overflow-hidden rounded-[var(--raio)]" ref={caixa} />
      <ol className="mt-3 space-y-1 text-xs">
        {pontos.map((p) => (
          <li className="flex items-center gap-2" key={`${p.ordem}-${p.nome}`}>
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--cor-acento)] text-2xs font-semibold text-[var(--cor-acento-texto)]">
              {p.ordem}
            </span>
            <span className="tabular text-[var(--cor-texto-fraco)]">{p.hora}</span>
            <span className="truncate">{p.nome}</span>
          </li>
        ))}
      </ol>
      <p className="mt-2 text-2xs text-[var(--cor-texto-fraco)]">
        A linha liga os pontos na ordem do dia; nao e o trajeto real da rua.
      </p>
    </div>
  );
}
