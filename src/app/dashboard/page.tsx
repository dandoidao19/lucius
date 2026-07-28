// app/dashboard/page.tsx - VERSÃO MÓVEL-FIRST MODULO CASA
'use client'

import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { useEffect, useState, type TouchEvent as ReactTouchEvent } from 'react'
import { User } from '@supabase/supabase-js'
import { DadosFinanceirosProvider } from '@/context/DadosFinanceirosContext'
import { FilterProvider } from '@/context/FilterContext'
import { FormDraftProvider } from '@/context/FormDraftContext'
import { RealtimeSubscriber } from '@/components/RealtimeSubscriber'
import AtalhosGlobais from '@/components/AtalhosGlobais'
import { isDevFeaturesEnabled } from '@/lib/envUtils'
import CaixaMobileTab from '@/components/CaixaMobileTab'
import TransacoesTab from '@/components/TransacoesTab'
import DashboardFinanceiroTab from '@/components/DashboardFinanceiroTab'
import ModuloConfiguracoes from '@/components/ModuloConfiguracoes'
import ModalNotasAtualizacao from '@/components/ModalNotasAtualizacao'

export default function Dashboard() {
  const [, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'transacoes' | 'dashboard' | 'configuracoes'>('transacoes')
  const [showDashboardDesktop, setShowDashboardDesktop] = useState(false)
  const [showConfigDesktop, setShowConfigDesktop] = useState(false)
  const [touchStartX, setTouchStartX] = useState<number | null>(null)
  const [touchStartY, setTouchStartY] = useState<number | null>(null)
  const router = useRouter()

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession()

      if (!session) {
        router.push('/')
      } else {
        setUser(session.user)
        setLoading(false)
      }
    }

    checkAuth()
  }, [router])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  const tabsOrder = ['transacoes', 'dashboard', 'configuracoes'] as const

  const handleSwipe = (direction: 'left' | 'right') => {
    const currentIndex = tabsOrder.indexOf(activeTab)
    if (direction === 'left' && currentIndex < tabsOrder.length - 1) {
      setActiveTab(tabsOrder[currentIndex + 1])
    }
    if (direction === 'right' && currentIndex > 0) {
      setActiveTab(tabsOrder[currentIndex - 1])
    }
  }

  const onTouchStart = (event: ReactTouchEvent<HTMLDivElement>) => {
    setTouchStartX(event.touches[0].clientX)
    setTouchStartY(event.touches[0].clientY)
  }

  const onTouchEnd = (event: ReactTouchEvent<HTMLDivElement>) => {
    if (touchStartX === null || touchStartY === null) return
    const deltaX = event.changedTouches[0].clientX - touchStartX
    const deltaY = event.changedTouches[0].clientY - touchStartY

    if (Math.abs(deltaX) > 50 && Math.abs(deltaX) > Math.abs(deltaY)) {
      handleSwipe(deltaX < 0 ? 'left' : 'right')
    }

    setTouchStartX(null)
    setTouchStartY(null)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
        <div className="text-lg font-semibold text-gray-700">⏳ Carregando...</div>
      </div>
    )
  }

  const tabs = [
    { id: 'transacoes', label: 'Transações', icon: '📋' },
    { id: 'dashboard', label: 'Dashboard', icon: '📊' },
    { id: 'configuracoes', label: 'Config', icon: '⚙️' }
  ] as const

  return (
    <DadosFinanceirosProvider>
      <FilterProvider>
        <FormDraftProvider>
          <RealtimeSubscriber />
          <ModalNotasAtualizacao />

          <div className="min-h-[calc(100dvh-30px)] bg-gradient-to-br from-gray-50 via-white to-gray-50">
            {/* 
              Estrutura para “congelar topo”:
              - layout do dashboard ocupa toda a altura
              - topo (tabs/menu/filtros) fica fixo “no container”
              - rolagem acontece só na área de dados
            */}
            <div className="max-w-full mx-auto px-1 py-1 flex flex-col h-[calc(100dvh-30px)] overflow-hidden" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
              <div className="bg-white/95 backdrop-blur-md border-b border-slate-200 py-1 z-40">
                <div className="flex flex-wrap items-center justify-between gap-1 px-1">
                  {/* Mobile: Abas Normais */}
                  <div className="flex-1 min-w-0 flex flex-wrap items-center gap-1 overflow-x-auto lg:hidden">
                    {tabs.map(tab => (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as typeof activeTab)}
                        className={`px-2 py-1 rounded-md font-semibold text-[11px] transition-all whitespace-nowrap flex items-center gap-1 ${
                          activeTab === tab.id
                            ? 'bg-blue-600 text-white shadow-lg'
                            : 'bg-white text-gray-700 border border-gray-300 hover:border-blue-300'
                        }`}
                      >
                        <span>{tab.icon}</span>
                        <span className="hidden sm:inline">{tab.label}</span>
                      </button>
                    ))}
                  </div>

                  {/* Desktop: Apenas Configurações */}
                  <div className="hidden lg:flex flex-1 items-center gap-1">
                    <button
                      onClick={() => setShowDashboardDesktop(false)}
                      className={`px-2 py-1 rounded-md font-semibold text-xs transition-all flex items-center gap-1.5 ${
                        !showDashboardDesktop
                          ? 'bg-blue-600 text-white shadow-lg'
                          : 'bg-white text-gray-700 border border-gray-300 hover:border-blue-300'
                      }`}
                    >
                      <span>📋</span>
                      <span>Transações</span>
                    </button>
                    <button
                      onClick={() => setShowDashboardDesktop(!showDashboardDesktop)}
                      className={`px-2 py-1 rounded-md font-semibold text-xs transition-all flex items-center gap-1.5 ${
                        showDashboardDesktop
                          ? 'bg-blue-600 text-white shadow-lg'
                          : 'bg-white text-gray-700 border border-gray-300 hover:border-blue-300'
                      }`}
                    >
                      <span>📊</span>
                      <span>Dashboard</span>
                    </button>
                    <button
                      onClick={() => setShowConfigDesktop(!showConfigDesktop)}
                      className={`px-2 py-1 rounded-md font-semibold text-xs transition-all flex items-center gap-1.5 ${
                        showConfigDesktop
                          ? 'bg-purple-600 text-white shadow-lg'
                          : 'bg-white text-gray-700 border border-gray-300 hover:border-purple-300'
                      }`}
                    >
                      <span>⚙️</span>
                      <span>Configurações</span>
                    </button>
                  </div>

                  {/* Globais */}
                  <div className="flex items-center gap-1.5">
                    <AtalhosGlobais inline />
                    <button
                      onClick={handleLogout}
                      className="bg-red-500 hover:bg-red-600 text-white px-2 py-1 rounded-md font-medium transition-colors shadow-sm text-[11px] whitespace-nowrap"
                    >
                      🚪 Sair
                    </button>
                  </div>
                </div>
              </div>

              {/* DADOS ROLAM APENAS AQUI */}
              <div className="flex-1 min-h-0 overflow-y-auto mt-1 lg:overflow-hidden">
                <div className="bg-white rounded-md shadow-sm border border-gray-200 p-1 lg:h-full lg:min-h-0 lg:overflow-hidden">
                  {/* Mobile: Abas Exclusivas - Transações */}
                  {activeTab === 'transacoes' && (
                    <div className="block lg:hidden flex flex-col">
                      <TransacoesTab />
                    </div>
                  )}

                  {/* Mobile: Abas Exclusivas - Dashboard */}
                  {activeTab === 'dashboard' && (
                    <div className="block lg:hidden flex flex-col">
                      <DashboardFinanceiroTab />
                    </div>
                  )}

                  {/* Mobile: Abas Exclusivas - Configurações */}
                  {activeTab === 'configuracoes' && (
                    <div className="block lg:hidden">
                      <ModuloConfiguracoes />
                    </div>
                  )}

                  {/* Desktop: Caixa + Transações lado a lado (scroll independente de verdade) */}
                  {showDashboardDesktop ? (
                    <div className="hidden lg:flex min-h-0 overflow-hidden h-full">
                      <div className="flex flex-col min-h-0 h-full bg-white rounded-lg border border-gray-200 shadow-sm p-1.5 w-full">
                        <div className="flex-1 min-h-0 h-full overflow-y-auto max-h-[calc(100dvh-95px)]">
                          <DashboardFinanceiroTab />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="hidden lg:flex lg:gap-2 min-h-0 overflow-hidden h-full">
                      <div className="flex flex-col min-h-0 h-full bg-white rounded-lg border border-gray-200 shadow-sm p-1.5 w-[33%]">
                        <div className="flex-1 min-h-0 h-full overflow-y-auto max-h-[calc(100dvh-95px)]">
                          <div className="h-full min-h-0">
                            <CaixaMobileTab />
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col min-h-0 h-full bg-white rounded-lg border border-gray-200 shadow-sm p-1.5 w-[67%] max-h-[calc(100dvh-95px)] overflow-hidden">
                        <div className="flex-1 min-h-0 h-full overflow-hidden">
                          <div className="h-full min-h-0">
                            <TransacoesTab />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Desktop: Configurações em painel separado */}
                {showConfigDesktop && (
                  <div className="hidden lg:block mt-2 bg-white rounded-lg border border-gray-200 shadow-sm p-2 overflow-y-auto">
                    <ModuloConfiguracoes />
                  </div>
                )}

                {/* Debug - Mostrar apenas em dev */}
                {isDevFeaturesEnabled() && (
                  <div className="mt-4 p-2 bg-yellow-50 border border-yellow-300 rounded text-xs text-yellow-800">
                    ℹ️ Modo desenvolvimento ativado
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Atalhos Globais (Somente botão superior) */}
          {/* Removido o balão flutuante lateral para manter apenas o botão de lançamento no cabeçalho. */}
        </FormDraftProvider>
      </FilterProvider>
    </DadosFinanceirosProvider>
  )
}
