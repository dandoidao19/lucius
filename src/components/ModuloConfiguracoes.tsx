'use client'

import { useState } from 'react'
import ControleCDC from './ControleCDC'
import LimparTransacoes from './LimparTransacoes'
import ImportacaoExcel from './ImportacaoExcel'
import MenuCategorias from './MenuCategorias'
import ConfiguracaoLogos from './ConfiguracaoLogos'
import ImportacaoExcelLoja from './ImportacaoExcelLoja'
import EdicaoEmLote from './EdicaoEmLote'
import LogAuditoria from './LogAuditoria'

// Define os grupos e submenus - REORGANIZADO
const gruposConfig = [
  {
    id: 'casa',
    titulo: '🏠 CASA',
    submenus: [
      { id: 'cdc', title: 'Centros de Custo', component: ControleCDC },
      { id: 'edicao-lote', title: 'Edição em Lote', component: EdicaoEmLote },
      { id: 'limpeza', title: 'Limpar Transações', component: LimparTransacoes },
      { id: 'importacao', title: 'Importar Excel', component: ImportacaoExcel },
    ]
  },
  {
    id: 'loja',
    titulo: '🏪 LOJA',
    submenus: [
      { id: 'logos', title: 'Logomarcas e PDFs', component: ConfiguracaoLogos },
      { id: 'categorias', title: 'Categorias', component: MenuCategorias },
      { id: 'importacao-loja', title: 'Importar Dados', component: ImportacaoExcelLoja },
    ]
  },
  {
    id: 'sistema',
    titulo: '💻 SISTEMA',
    submenus: [
      { id: 'auditoria', title: 'Log de Auditoria', component: LogAuditoria },
    ]
  }
]

export default function ModuloConfiguracoes() {
  const [menuAtivo, setMenuAtivo] = useState('cdc')
  
  const todosSubmenus = gruposConfig.flatMap(grupo => grupo.submenus)
  
  const renderConteudo = () => {
    const menu = todosSubmenus.find(m => m.id === menuAtivo)
    if (!menu) return <div className="text-xs">Selecione uma opção.</div>

    const handleDataChange = () => {
      console.log('Dados alterados.')
    }

    const handleImportacaoConcluida = () => {
      console.log('Importação concluída. Recarregar dados se necessário.')
    }

    switch (menuAtivo) {
      case 'cdc':
        return <ControleCDC onDataChange={handleDataChange} />
      case 'edicao-lote':
        return <EdicaoEmLote onDataChange={handleDataChange} />
      case 'categorias':
        return <MenuCategorias />
      case 'logos':
        return <ConfiguracaoLogos />
      case 'limpeza':
        return <LimparTransacoes onDataChange={handleDataChange} />
      case 'importacao':
        return <ImportacaoExcel onImportacaoConcluida={handleImportacaoConcluida} />
      case 'importacao-loja':
        return <ImportacaoExcelLoja onImportacaoConcluida={handleImportacaoConcluida} />
      case 'auditoria':
        return <LogAuditoria />
      default:
        return <div className="text-xs">Componente não encontrado.</div>
    }
  }

  return (
    <div className="space-y-3">
      <h1 className="text-base font-bold text-gray-800">⚙️ Configurações do Sistema LUCIUS</h1>
      
      <div className="flex space-x-3">
        <div className="w-56 bg-white p-3 rounded-lg shadow-md flex-shrink-0">
          <nav className="space-y-4">
            {gruposConfig.map(grupo => (
              <div key={grupo.id}>
                <h3 className="text-xs font-bold mb-2 text-gray-700 border-b pb-1">
                  {grupo.titulo}
                </h3>
                <div className="space-y-1">
                  {grupo.submenus.map(menu => (
                    <button
                      key={menu.id}
                      onClick={() => setMenuAtivo(menu.id)}
                      className={`w-full text-left px-2 py-1.5 rounded-md transition-colors text-xs ${
                        menuAtivo === menu.id
                          ? 'bg-blue-500 text-white font-medium'
                          : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      {menu.title}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </nav>
        </div>
        
        <div className="flex-1">
          {renderConteudo()}
        </div>
      </div>
    </div>
  )
}
