// hooks/useCaixaUniversal.ts - VERSÃO COM DEBUG
import { useState, useEffect, useCallback } from 'react'
import { getDataAtualBrasil, formatarDataParaExibicao } from '@/lib/dateUtils'
import { useDadosFinanceiros } from '@/context/DadosFinanceirosContext'

interface DiaCaixa {
  data: string
  data_formatada: string
  receitas: number
  despesas: number
  saldo_acumulado: number
}

type Filtro = '30dias' | 'mes' | 'tudo'

export function useCaixaUniversal() {
  const [caixaRealGeral, setCaixaRealGeral] = useState(0)
  const [caixaRealLoja, setCaixaRealLoja] = useState(0)
  const [caixaRealCasa, setCaixaRealCasa] = useState(0)
  const [caixaPrevistoGeral, setCaixaPrevistoGeral] = useState<DiaCaixa[]>([])
  const [entradasHoje, setEntradasHoje] = useState(0)
  const [saidasHoje, setSaidasHoje] = useState(0)
  const [carregando, setCarregando] = useState(true)
  const [filtro, setFiltro] = useState<Filtro>('30dias')
  const [mesFiltro, setMesFiltro] = useState(() => {
    const hoje = new Date();
    return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;
  })
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState(0)
  const { dados } = useDadosFinanceiros()

  const calcularDataNDias = useCallback((dataBase: string, dias: number) => {
    const data = new Date(`${dataBase}T12:00:00`)
    data.setDate(data.getDate() + dias)
    return data.toISOString().split('T')[0]
  }, [])

  useEffect(() => {
    const fetchData = async () => {
      setCarregando(true);
      const hoje = getDataAtualBrasil();
      const ontem = calcularDataNDias(hoje, -1);

      try {
        const transacoesLoja = dados.lancamentosLoja;
        const lancamentosCasa = dados.lancamentosCasa;

        const realLoja = transacoesLoja
          .filter(t => t.status_pagamento === 'pago')
          .reduce((acc, t) => {
            const valor = t.valor_pago ?? t.total ?? 0;
            return acc + (t.tipo === 'entrada' ? valor : -valor);
          }, 0);

        const realCasa = lancamentosCasa
          .filter(l => l.status === 'realizado')
          .reduce((acc, l) => acc + (l.tipo === 'entrada' ? l.valor : -l.valor), 0);

        setCaixaRealLoja(realLoja);
        setCaixaRealCasa(realCasa);
        setCaixaRealGeral(realLoja + realCasa);

        const saldoAteOntemLoja = transacoesLoja
          .filter(t => t.status_pagamento === 'pago' && t.data_pagamento && t.data_pagamento <= ontem)
        .reduce((acc, t) => {
          const valor = t.valor_pago ?? t.total ?? 0;
          return acc + (t.tipo === 'entrada' ? valor : -valor);
        }, 0);

        const saldoAteOntemCasa = lancamentosCasa
          .filter(l => l.status === 'realizado' && l.data_lancamento && l.data_lancamento <= ontem)
          .reduce((acc, l) => acc + (l.tipo === 'entrada' ? l.valor : -l.valor), 0);

        const saldoInicialProjecao = saldoAteOntemLoja + saldoAteOntemCasa;

        const allEntries: { data: string; valor: number }[] = [];
        transacoesLoja.forEach(t => {
          const data = t.status_pagamento === 'pago' ? t.data_pagamento : t.data;
          if (!data || data < hoje) return;
          const valor = t.valor_pago ?? t.total ?? 0;
          allEntries.push({ data: data.split('T')[0], valor: t.tipo === 'entrada' ? valor : -valor });
        });
        lancamentosCasa.forEach(l => {
          const data = l.status === 'realizado' ? l.data_lancamento : l.data_prevista;
          if (!data || data < hoje) return;
          allEntries.push({ data: data.split('T')[0], valor: l.tipo === 'entrada' ? l.valor : -l.valor });
        });

        const groupedByDate = allEntries.reduce((acc, curr) => {
          if (!acc[curr.data]) {
            acc[curr.data] = { receitas: 0, despesas: 0 };
          }
          if (curr.valor > 0) acc[curr.data].receitas += curr.valor;
          else acc[curr.data].despesas += Math.abs(curr.valor);
          return acc;
        }, {} as Record<string, { receitas: number; despesas: number }>);

        const hojeData = groupedByDate[hoje] || { receitas: 0, despesas: 0 };
        setEntradasHoje(hojeData.receitas);
        setSaidasHoje(hojeData.despesas);

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

        setCaixaPrevistoGeral(displaySeries);

      } catch (error) {
        console.error("[DEBUG] Erro ao buscar dados do caixa universal:", error);
      } finally {
        setCarregando(false);
        setUltimaAtualizacao(Date.now());
      }
    };

    if (dados.lancamentosCasa.length > 0 || dados.lancamentosLoja.length > 0) {
      fetchData();
    }
  }, [dados, filtro, mesFiltro, calcularDataNDias]);

  return {
    caixaRealGeral,
    caixaRealLoja,
    caixaRealCasa,
    caixaPrevistoGeral,
    entradasHoje,
    saidasHoje,
    carregando,
    filtro,
    setFiltro,
    mesFiltro,
    setMesFiltro,
    ultimaAtualizacao,
    getTituloPrevisao: () => {
      if (filtro === 'tudo') return 'Histórico e Futuro'
      if (filtro === '30dias') {
        const hoje = getDataAtualBrasil()
        const fim30Dias = calcularDataNDias(hoje, 29)
        return `Próximos 30 Dias: ${formatarDataParaExibicao(hoje)} a ${formatarDataParaExibicao(fim30Dias)}`
      }
      if (filtro === 'mes' && mesFiltro) {
        const [ano, mes] = mesFiltro.split('-')
        return `Mês: ${mes}/${ano}`
      }
      return 'Período'
    }
  }
}