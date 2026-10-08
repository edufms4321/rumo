/**
 * Valida /data/<destino>/ contra os schemas Zod e contra a coerencia entre
 * registros. Roda com `npm run validate:data`.
 *
 * Sai com codigo 1 se houver qualquer ERRO. Avisos nao reprovam, mas sao
 * impressos - sao exatamente o material do docs/pendencias-de-verificacao.md.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { agruparPorDestino, montarPacote } from '../src/data/montar-pacote.ts';
import { validarPacote } from '../src/schema/pacote.ts';

const RAIZ = resolve(import.meta.dirname, '..');
const PASTA_DE_DADOS = join(RAIZ, 'data');

const cores = {
  reset: '\u001B[0m',
  vermelho: '\u001B[31m',
  amarelo: '\u001B[33m',
  verde: '\u001B[32m',
  cinza: '\u001B[90m',
  negrito: '\u001B[1m',
};

function listarJsonRecursivo(pasta: string): string[] {
  const encontrados: string[] = [];
  for (const entrada of readdirSync(pasta)) {
    const caminho = join(pasta, entrada);
    if (statSync(caminho).isDirectory()) {
      encontrados.push(...listarJsonRecursivo(caminho));
    } else if (entrada.toLowerCase().endsWith('.json')) {
      encontrados.push(caminho);
    }
  }
  return encontrados;
}

function main(): void {
  let pastaExiste = true;
  try {
    pastaExiste = statSync(PASTA_DE_DADOS).isDirectory();
  } catch {
    pastaExiste = false;
  }
  if (!pastaExiste) {
    console.error(`${cores.vermelho}Pasta /data nao encontrada em ${PASTA_DE_DADOS}${cores.reset}`);
    process.exit(1);
  }

  const caminhos = listarJsonRecursivo(PASTA_DE_DADOS);
  if (caminhos.length === 0) {
    console.error(`${cores.vermelho}Nenhum arquivo .json em /data${cores.reset}`);
    process.exit(1);
  }

  const arquivos: Record<string, unknown> = {};
  let houveErroDeLeitura = false;

  for (const caminho of caminhos) {
    const chave = relative(PASTA_DE_DADOS, caminho).replace(/\\/g, '/');
    try {
      arquivos[chave] = JSON.parse(readFileSync(caminho, 'utf8'));
    } catch (erro) {
      houveErroDeLeitura = true;
      const motivo = erro instanceof Error ? erro.message : String(erro);
      console.error(`${cores.vermelho}JSON invalido${cores.reset} em ${chave}: ${motivo}`);
    }
  }
  if (houveErroDeLeitura) process.exit(1);

  const porDestino = agruparPorDestino(arquivos);
  const idsDeDestino = Object.keys(porDestino).sort();

  if (idsDeDestino.length === 0) {
    console.error(
      `${cores.vermelho}Nenhum destino encontrado. Esperado /data/<destino>/destino.json${cores.reset}`,
    );
    process.exit(1);
  }

  let totalDeErros = 0;
  let totalDeAvisos = 0;

  for (const id of idsDeDestino) {
    const destinoArquivos = porDestino[id];
    if (!destinoArquivos) continue;

    console.log(`\n${cores.negrito}${id}${cores.reset}`);

    const { bruto, ignorados, faltando } = montarPacote(destinoArquivos);

    for (const arquivo of faltando) {
      totalDeErros += 1;
      console.log(`  ${cores.vermelho}erro${cores.reset}  arquivo obrigatorio ausente: ${arquivo}`);
    }
    for (const arquivo of ignorados) {
      totalDeAvisos += 1;
      console.log(`  ${cores.amarelo}aviso${cores.reset} fora da convencao, ignorado: ${arquivo}`);
    }
    if (faltando.length > 0) continue;

    const { ok, pacote, problemas } = validarPacote(bruto);

    for (const problema of problemas) {
      if (problema.nivel === 'erro') {
        totalDeErros += 1;
        console.log(
          `  ${cores.vermelho}erro${cores.reset}  ${problema.caminho} ${cores.cinza}->${cores.reset} ${problema.mensagem}`,
        );
      } else {
        totalDeAvisos += 1;
        console.log(
          `  ${cores.amarelo}aviso${cores.reset} ${problema.caminho} ${cores.cinza}->${cores.reset} ${problema.mensagem}`,
        );
      }
    }

    if (ok && pacote) {
      const porConfianca = { verificado: 0, parcial: 0, estimado: 0 };
      for (const item of pacote.itens) porConfianca[item.confianca] += 1;
      console.log(
        `  ${cores.verde}ok${cores.reset}    ${pacote.itens.length} itens, ` +
          `${pacote.cidades.length} cidades, ${pacote.trechos.length} trechos, ` +
          `${pacote.calendario.length} eventos`,
      );
      console.log(
        `  ${cores.cinza}confianca: ${porConfianca.verificado} verificado, ` +
          `${porConfianca.parcial} parcial, ${porConfianca.estimado} estimado${cores.reset}`,
      );
    }
  }

  console.log(
    `\n${totalDeErros === 0 ? cores.verde : cores.vermelho}${totalDeErros} erro(s)${cores.reset}, ` +
      `${cores.amarelo}${totalDeAvisos} aviso(s)${cores.reset}`,
  );

  if (totalDeErros > 0) {
    console.log(`${cores.vermelho}Validacao reprovada.${cores.reset}`);
    process.exit(1);
  }
  console.log(`${cores.verde}Validacao aprovada.${cores.reset}`);
}

main();
