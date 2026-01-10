'use client'

import { useState } from 'react'
import MenuCategorias from './MenuCategorias'
import CasaModulo from './CasaModulo'
import LojaModulo from './LojaModulo'
import ModuloCondicional from './ModuloCondicional'
import ModuloConfiguracoes from './ModuloConfiguracoes'

export default function Dashboard() {
  const [paginaAtiva, setPaginaAtiva] = useState('dashboard')

  const renderPagina = () => {
    switch (paginaAtiva) {
      case 'casa':
        return <CasaModulo />
      case 'loja':
        return <LojaModulo />
      case 'condicional':
        return <ModuloCondicional />
      case 'configuracoes':
        return <ModuloConfiguracoes />
      default:
        return <CaixaGeral />
    }
  }

  return (
    <div>
      <MenuCategorias paginaAtiva={paginaAtiva} setPaginaAtiva={setPaginaAtiva} />
      <div className="mt-4">{renderPagina()}</div>
    </div>
  )
}
