/**
 * Cerca de erro.
 *
 * Sem isto, uma excecao em qualquer tela apaga a pagina inteira: fundo
 * branco, nenhuma mensagem, nenhum caminho de volta. O dado nao se perde
 * (ele esta no IndexedDB e no espelho), mas o usuario nao tem como saber
 * disso — e e nessa hora que ele desiste do app.
 *
 * Entao: diz o que aconteceu, garante que a viagem esta salva, e da duas
 * saidas — voltar ao inicio e baixar o backup. O backup e lido direto do
 * armazenamento, nao do estado do React, justamente porque o estado pode
 * ser o que quebrou.
 */
import { Component, type ErrorInfo, type ReactNode } from 'react';

type Estado = { erro?: Error };

function baixarBackupDeEmergencia(): void {
  try {
    const cru = localStorage.getItem('rumo:biblioteca:espelho:v1');
    if (!cru) {
      alert('Nao encontrei nada salvo neste navegador para exportar.');
      return;
    }
    const url = URL.createObjectURL(new Blob([cru], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `rumo-backup-emergencia-${new Date().toISOString().slice(0, 10)}.json`;
    a.style.display = 'none';
    document.body.append(a);
    a.click();
    setTimeout(() => {
      a.remove();
      URL.revokeObjectURL(url);
    }, 0);
  } catch {
    alert('Nao consegui ler o armazenamento deste navegador.');
  }
}

export class Cerca extends Component<{ children: ReactNode }, Estado> {
  state: Estado = {};

  static getDerivedStateFromError(erro: Error): Estado {
    return { erro };
  }

  componentDidCatch(erro: Error, info: ErrorInfo): void {
    // Sem servico de telemetria: o console e o unico lugar onde a pilha
    // sobrevive. Serve para copiar e colar num relato de bug.
    // oxlint-disable-next-line no-console
    console.error('[Rumo] tela quebrou:', erro, info.componentStack);
  }

  render(): ReactNode {
    const { erro } = this.state;
    if (!erro) return this.props.children;

    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="w-full max-w-md rounded-[var(--raio)] border border-[var(--cor-erro-borda)] bg-[var(--cor-erro-fundo)] p-5">
          <h1 className="text-base font-semibold">Esta tela quebrou.</h1>
          <p className="mt-2 text-sm leading-relaxed">
            <strong>A sua viagem nao se perdeu</strong> — ela fica salva neste navegador, nao
            nesta tela. Volte ao inicio e tente de novo.
          </p>
          <p className="mt-3 break-words rounded-[var(--raio)] bg-[var(--cor-fundo-afundado)] p-2 font-mono text-2xs">
            {erro.message || 'erro sem mensagem'}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              className="h-9 rounded-[var(--raio)] bg-[var(--cor-acento)] px-3 text-sm font-medium text-[var(--cor-acento-texto)]"
              onClick={() => {
                window.location.hash = '#/';
                window.location.reload();
              }}
              type="button"
            >
              Voltar ao inicio
            </button>
            <button
              className="h-9 rounded-[var(--raio)] border border-[var(--cor-borda)] px-3 text-sm font-medium"
              onClick={baixarBackupDeEmergencia}
              type="button"
            >
              Baixar backup agora
            </button>
          </div>
        </div>
      </div>
    );
  }
}
