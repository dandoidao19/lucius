/**
 * Utilitário para formatação de erros do Supabase e do sistema.
 * Centraliza a lógica para exibição de mensagens amigáveis e instruções técnicas.
 */
export function formatarErro(err: any): string {
  if (!err) return 'Erro desconhecido';
  if (typeof err === 'string') return err;

  // Erros comuns de Schema/Constraint do Supabase (PostgREST)
  if (err.code === 'PGRST204' || err.code === '23505' || err.code === '23502') {
    return `ERRO DE SCHEMA OU CONSTRAINT: ${err.message}. Detalhes: ${err.details || ''}. POR FAVOR, EXECUTE O SCRIPT SQL V4.8 NO SEU SUPABASE (SQL EDITOR).`;
  }

  let mensagem = err.message || 'Erro interno';
  if (err.details) mensagem += ` (Detalhes: ${err.details})`;
  if (err.code) mensagem += ` [Código: ${err.code}]`;
  if (err.hint) mensagem += ` - Dica: ${err.hint}`;

  if (mensagem === 'Erro interno' && typeof err === 'object') {
    try {
      const str = JSON.stringify(err);
      return str !== '{}' ? str : 'Erro não catalogado (Objeto vazio)';
    } catch {
      return 'Erro ao processar objeto de erro';
    }
  }
  return mensagem;
}
