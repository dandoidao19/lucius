'use client'

import { useCaixaUniversal } from '@/hooks/useCaixaUniversal'

interface CaixaLojaDetalhadoProps {
  titulo?: string;
  onMostrarTudo: (mostrar: boolean) => void;
}

export default function CaixaLojaDetalhado({ titulo, onMostrarTudo }: CaixaLojaDetalhadoProps) {
  // 1. Consumir o hook centralizado e otimizado
  const {
    caixaRealLoja,
    entradasHoje,
    saidasHoje,
    caixaPrevistoGeral,
    carregando,
    filtro,
    setFiltro,
    mesFiltro,
    setMesFiltro,
    getTituloPrevisao,
  } = useCaixaUniversal()

  // 2. Toda a lógica de busca de dados, cálculo, useEffects e useStates foi removida.

  const handleMudarParaMes = () => {
    setFiltro('mes')
  }

  const handleVoltar30Dias = () => {
    setFiltro('30dias')
  }

  const handleMostrarHistorico = () => {
    setFiltro('tudo')
  }

  const handleMesFiltroChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMesFiltro(e.target.value)
  }

  // Estilos permanecem os mesmos
  const caixaTituloStyle: React.CSSProperties = { fontSize: '11px', marginBottom: 2, whiteSpace: 'nowrap' }
  const caixaValorStyle: React.CSSProperties = { fontSize: '1.5rem', fontWeight: 700, lineHeight: '1.05', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }
  const caixaSubContainerStyle: React.CSSProperties = { fontSize: '11px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'flex', gap: 8, alignItems: 'center' }
  const periodoLinhaStyle: React.CSSProperties = { fontSize: '11px', color: '#374151', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: 4, marginBottom: 4, paddingLeft: 4 }
  const botoesContainerStyle: React.CSSProperties = { display: 'flex', gap: 6, alignItems: 'center', whiteSpace: 'nowrap' }

  const formatarMoeda = (valor: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor)
  const formatarMoedaCompacta = (valor: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(valor)

  const renderBotoesModo = () => {
    return filtro !== 'mes' ? (
      <div style={botoesContainerStyle}>
        <button onClick={handleMudarParaMes} disabled={carregando} className="px-1.5 py-0.5 bg-blue-500 text-white rounded text-xs font-medium">Ver Mês</button>
        <button onClick={handleMostrarHistorico} disabled={carregando} className="px-1.5 py-0.5 bg-green-500 text-white rounded text-xs font-medium">TUDO</button>
      </div>
    ) : (
      <div style={botoesContainerStyle}>
        <input type="month" value={mesFiltro} onChange={handleMesFiltroChange} disabled={carregando} className="px-1.5 py-0.5 text-xs border border-gray-300 rounded" />
        <button onClick={handleVoltar30Dias} disabled={carregando} className="px-1.5 py-0.5 bg-gray-500 text-white rounded text-xs font-medium">30 Dias</button>
        <button onClick={handleMostrarHistorico} disabled={carregando} className="px-1.5 py-0.5 bg-green-500 text-white rounded text-xs font-medium">TUDO</button>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-1 space-y-1" style={{ minWidth: 0 }}>
      <h2 className="font-semibold text-gray-800" style={{ fontSize: '12px' }}>{titulo || 'Caixa'}</h2>

      <div className={`rounded p-1.5 ${caixaRealLoja < 0 ? 'bg-red-500' : 'bg-blue-50 border border-blue-200'}`} style={{ minWidth: 0 }}>
        <div>
          <p style={caixaTituloStyle} className={`${caixaRealLoja < 0 ? 'text-red-100' : 'text-gray-600'}`}>Caixa Real:</p>
          <p style={caixaValorStyle} className={`${caixaRealLoja < 0 ? 'text-white' : 'text-blue-600'}`}>{formatarMoeda(caixaRealLoja)}</p>
          <div style={caixaSubContainerStyle} className="mt-0.5">
            <div style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
              <span className="text-green-600">↑ {formatarMoedaCompacta(Number(entradasHoje) || 0)}</span>
              <span className="text-red-600">↓ {formatarMoedaCompacta(Number(saidasHoje) || 0)}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-1">
        <div className="flex justify-between items-center mb-1">
          <div style={{ minWidth: 0 }}></div>
          <div style={botoesContainerStyle}>{renderBotoesModo()}</div>
        </div>

        <div style={periodoLinhaStyle} title={getTituloPrevisao()}>{getTituloPrevisao()}</div>

        {carregando ? (
          <p className="text-gray-500 text-center py-2" style={{ fontSize: '12px' }}>Carregando...</p>
        ) : caixaPrevistoGeral.length > 0 ? (
          <div className="overflow-x-auto">
            <div className="text-[10px] text-gray-500 mb-1">
              Mostrando {caixaPrevistoGeral.length} dias
            </div>
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-gray-100 border-b border-gray-300">
                  <th className="px-1 py-0.5 text-left font-semibold text-gray-700">Data</th>
                  <th className="px-1 py-0.5 text-right font-semibold text-gray-700">Receitas</th>
                  <th className="px-1 py-0.5 text-right font-semibold text-gray-700">Despesas</th>
                  <th className="px-1 py-0.5 text-right font-semibold text-gray-700">Acumulado</th>
                </tr>
              </thead>
              <tbody>
                {caixaPrevistoGeral.map((dia, idx) => (
                  <tr key={`${dia.data}-${idx}`} className="border-b border-gray-200 hover:bg-gray-50">
                    <td className="px-1 py-0.5 text-gray-700 whitespace-nowrap">{dia.data_formatada}</td>
                    <td className="px-1 py-0.5 text-right text-green-600 font-medium">{formatarMoedaCompacta(dia.receitas)}</td>
                    <td className="px-1 py-0.5 text-right text-red-600 font-medium">{formatarMoedaCompacta(dia.despesas)}</td>
                    <td className={`px-1 py-0.5 text-right font-bold ${dia.saldo_acumulado >= 0 ? 'text-blue-600' : 'text-red-600'}`}>{formatarMoedaCompacta(dia.saldo_acumulado)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-3">
            <p className="text-gray-500 text-xs">
              {filtro === 'mes' ? `Nenhuma transação encontrada para ${mesFiltro}` : 'Nenhuma transação prevista'}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
