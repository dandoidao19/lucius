// src/components/LancamentoCard.tsx
'use client'

import React from 'react'
import { Lancamento } from '@/types'

interface LancamentoCardProps {
  lancamento: Lancamento;
  onCardClick: (lancamento: Lancamento) => void;
}

const LancamentoCard: React.FC<LancamentoCardProps> = ({ lancamento, onCardClick }) => {
  const isEntrada = lancamento.tipo === 'entrada';
  const valorFormatado = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(lancamento.valor);

  const dataFormatada = new Date(lancamento.data_prevista + 'T00:00:00-03:00').toLocaleDateString('pt-BR');

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'realizado':
        return 'bg-green-100 text-green-800';
      case 'pendente':
        return 'bg-yellow-100 text-yellow-800';
      case 'vencido':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div
      className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 w-full mb-3 cursor-pointer hover:bg-gray-50 transition-colors"
      onClick={() => onCardClick(lancamento)}
    >
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <p className="font-semibold text-gray-800 truncate pr-2">{lancamento.descricao}</p>
          <p className="text-sm text-gray-500">{lancamento.centros_de_custo?.nome || 'Sem centro de custo'}</p>
        </div>
        <div className={`font-bold text-lg ${isEntrada ? 'text-green-600' : 'text-red-600'}`}>
          {valorFormatado}
        </div>
      </div>
      <div className="flex justify-between items-center mt-3 pt-3 border-t border-gray-100">
        <div className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusStyle(lancamento.status)}`}>
          {lancamento.status.charAt(0).toUpperCase() + lancamento.status.slice(1)}
        </div>
        <div className="text-sm text-gray-600">
          {dataFormatada}
        </div>
      </div>
    </div>
  );
};

export default LancamentoCard;
