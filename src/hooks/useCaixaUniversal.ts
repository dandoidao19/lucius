// hooks/useCaixaUniversal.ts - VERSÃO REFATORADA COM REACT QUERY
import { useState, useMemo, useCallback } from 'react';
import { useLancamentosFinanceiros } from './useLancamentosFinanceiros';
import { useTransacoesLoja } from './useTransacoesLoja';
import { getDataAtualBrasil, formatarDataParaExibicao } from '@/lib/dateUtils';

interface DiaCaixa {
  data: string;
  data_formatada: string;
  receitas: number;
  despesas: number;
  saldo_acumulado: number;
}

type Filtro = '30dias' | 'mes' | 'tudo';

export function useCaixaUniversal() {
  const [filtro, setFiltro] = useState<Filtro>('30dias');
  const [mesFiltro, setMesFiltro] = useState(() => {
    const hoje = new Date();
    return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;
  });

  // 1. Consumir dados do cache do React Query
  const { data: transacoesLoja = [], isLoading: carregandoTransacoes } = useTransacoesLoja();
  const { data: lancamentosCasa = [], isLoading: carregandoLancamentos } = useLancamentosFinanceiros();

  const carregando = carregandoTransacoes || carregandoLancamentos;

  const calcularDataNDias = useCallback((dataBase: string, dias: number) => {
    const data = new Date(`${dataBase}T12:00:00`);
    data.setDate(data.getDate() + dias);
    return data.toISOString().split('T')[0];
  }, []);

  // 2. Realizar todos os cálculos complexos com useMemo
  const dadosCalculados = useMemo(() => {
    console.log('[DEBUG] Recalculando useCaixaUniversal com dados em cache...');
    const hoje = getDataAtualBrasil();
    const ontem = calcularDataNDias(hoje, -1);

    // Calcular o Caixa Real
    const realLoja = transacoesLoja
      .filter(t => t.status_pagamento === 'pago')
      .reduce((acc, t) => acc + (t.tipo === 'entrada' ? (t.valor_pago ?? t.total) : -(t.valor_pago ?? t.total)), 0);

    const realCasa = lancamentosCasa
      .filter(l => l.status === 'realizado')
      .reduce((acc, l) => acc + (l.tipo === 'entrada' ? l.valor : -l.valor), 0);

    const realGeral = realLoja + realCasa;

    // Calcular o saldo inicial para a projeção (tudo que foi pago/realizado ATÉ ONTEM)
    const saldoAteOntemLoja = transacoesLoja
      .filter(t => t.status_pagamento === 'pago' && t.data_pagamento && t.data_pagamento <= ontem)
      .reduce((acc, t) => acc + (t.tipo === 'entrada' ? (t.valor_pago ?? t.total) : -(t.valor_pago ?? t.total)), 0);

    const saldoAteOntemCasa = lancamentosCasa
      .filter(l => l.status === 'realizado' && l.data_lancamento && l.data_lancamento <= ontem)
      .reduce((acc, l) => acc + (l.tipo === 'entrada' ? l.valor : -l.valor), 0);

    const saldoInicialProjecao = saldoAteOntemLoja + saldoAteOntemCasa;

    // Unificar TODAS as movimentações a partir de HOJE para o fluxo de caixa
    const allEntries: { data: string; valor: number }[] = [];
    transacoesLoja.forEach(t => {
      const data = t.status_pagamento === 'pago' ? t.data_pagamento : t.data;
      if (!data || data < hoje) return;
      const valor = t.valor_pago ?? t.total;
      allEntries.push({ data: data.split('T')[0], valor: t.tipo === 'entrada' ? valor : -valor });
    });
    lancamentosCasa.forEach(l => {
      const data = l.status === 'realizado' ? l.data_lancamento : l.data_prevista;
      if (!data || data < hoje) return;
      allEntries.push({ data: data.split('T')[0], valor: l.tipo === 'entrada' ? l.valor : -l.valor });
    });

    // Agrupar por data
    const groupedByDate = allEntries.reduce((acc, curr) => {
      if (!acc[curr.data]) {
        acc[curr.data] = { receitas: 0, despesas: 0 };
      }
      if (curr.valor > 0) acc[curr.data].receitas += curr.valor;
      else acc[curr.data].despesas += Math.abs(curr.valor);
      return acc;
    }, {} as Record<string, { receitas: number; despesas: number }>);

    // Calcular Entradas e Saídas de Hoje
    const hojeData = groupedByDate[hoje] || { receitas: 0, despesas: 0 };
    const entradasHoje = hojeData.receitas;
    const saidasHoje = hojeData.despesas;

    // Construir a série de Caixa Previsto
    const sortedDates = Object.keys(groupedByDate).sort();
    const maxDate = sortedDates[sortedDates.length - 1] || calcularDataNDias(hoje, 30);
    const series: DiaCaixa[] = [];
    let saldoAcumulado = saldoInicialProjecao;
    const currentDate = new Date(`${hoje}T12:00:00`);
    const finalDate = new Date(`${maxDate}T12:00:00`);

    while (currentDate <= finalDate) {
      const dateStr = currentDate.toISOString().split('T')[0];
      const { receitas, despesas } = groupedByDate[dateStr] || { receitas: 0, despesas: 0 };
      saldoAcumulado += receitas - despesas;
      series.push({
        data: dateStr,
        data_formatada: formatarDataParaExibicao(dateStr),
        receitas,
        despesas,
        saldo_acumulado: saldoAcumulado,
      });
      currentDate.setDate(currentDate.getDate() + 1);
    }

    let displaySeries = series;
    if (filtro === '30dias') {
      const dataLimite = calcularDataNDias(hoje, 29);
      displaySeries = series.filter(dia => dia.data <= dataLimite);
    }

    return {
      caixaRealGeral: realGeral,
      caixaRealLoja: realLoja,
      caixaRealCasa: realCasa,
      caixaPrevistoGeral: displaySeries,
      entradasHoje,
      saidasHoje,
    };
  }, [transacoesLoja, lancamentosCasa, filtro, calcularDataNDias]);

  return {
    ...dadosCalculados,
    carregando,
    filtro,
    setFiltro,
    mesFiltro,
    setMesFiltro,
    ultimaAtualizacao: 0, // Este campo não é mais necessário, mas mantido para evitar quebras
    getTituloPrevisao: () => {
      if (filtro === 'tudo') return 'Histórico e Futuro';
      if (filtro === '30dias') {
        const hoje = getDataAtualBrasil();
        const fim30Dias = calcularDataNDias(hoje, 29);
        return `Próximos 30 Dias: ${formatarDataParaExibicao(hoje)} a ${formatarDataParaExibicao(fim30Dias)}`;
      }
      if (filtro === 'mes' && mesFiltro) {
        const [ano, mes] = mesFiltro.split('-');
        return `Mês: ${mes}/${ano}`;
      }
      return 'Período';
    },
  };
}
