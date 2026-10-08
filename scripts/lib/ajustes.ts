/**
 * Grava enriquecimento no lugar certo: `ajustes-manuais.json`, nao `/data`.
 *
 * Por que isto existe: os scripts de coordenada e de imagem escreviam
 * direto nos arquivos de `/data`. Funcionava ate alguem rodar
 * `npm run importar:pesquisa` de novo — o conversor regenera `/data` a
 * partir de `/pesquisa` e levava junto tudo o que os scripts tinham
 * achado. Perdi duas coordenadas assim e so percebi porque olhei o diff.
 *
 * `ajustes-manuais.json` e mesclado POR CIMA do resultado do conversor,
 * entao o que entra aqui sobrevive a qualquer reimportacao.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ConfigDeDestino } from '../destinos/tipos.ts';
import { colombia } from '../destinos/colombia.ts';
import { mexico } from '../destinos/mexico.ts';
import { nordeste } from '../destinos/nordeste.ts';

export const DESTINOS: Record<string, ConfigDeDestino> = { colombia, mexico, nordeste };

export function configDe(id: string): ConfigDeDestino {
  const c = DESTINOS[id];
  if (!c) {
    throw new Error(`Destino desconhecido: "${id}". Disponiveis: ${Object.keys(DESTINOS).join(', ')}.`);
  }
  return c;
}

type Json = Record<string, unknown>;

export class Ajustes {
  private readonly caminho: string;
  private readonly arquivo: Json;

  constructor(config: ConfigDeDestino) {
    this.caminho = join(config.pastaDePesquisa, 'ajustes-manuais.json');
    this.arquivo = existsSync(this.caminho)
      ? (JSON.parse(readFileSync(this.caminho, 'utf8')) as Json)
      : {
          _leia:
            'Ajustes mesclados por cima do resultado do conversor. Reexecutar o conversor nao perde nada daqui. Lista substitui lista inteira; null apaga a chave.',
        };
    this.arquivo.itens ??= {};
  }

  /** Mescla um patch no item, preservando o que ja houver ali. */
  paraItem(id: string, patch: Json): void {
    const itens = this.arquivo.itens as Record<string, Json>;
    itens[id] = { ...itens[id], ...patch };
  }

  temItem(id: string): boolean {
    return Boolean((this.arquivo.itens as Record<string, Json>)[id]);
  }

  gravar(): void {
    writeFileSync(this.caminho, `${JSON.stringify(this.arquivo, null, 1)}\n`);
    console.log(`\nGravado em ${this.caminho}. Rode: npm run importar:pesquisa -- <destino>`);
  }
}
