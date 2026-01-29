// app/dashboard/page.tsx - VERSÃO COM CONTROLE DE AMBIENTE
'use client'

import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { isDevFeaturesEnabled } from '@/lib/envUtils'
import { User } from '@supabase/supabase-js'

const ResumoCaixas = dynamic(() => import('@/components/ResumoCaixas'), { ssr: false })
const CasaModulo = dynamic(() => import('@/components/CasaModulo'), { ssr: false })
const ModuloConfiguracoes = dynamic(() => import('@/components/ModuloConfiguracoes'), { ssr: false })
const LojaModulo = dynamic(() => import('@/components/LojaModulo'), { ssr: false })

export default function Dashboard() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeSection, setActiveSection] = useState('dashboard') // Inicia em 'dashboard' por padrão
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
        <div className="text-lg font-semibold text-gray-700">⏳ Carregando...</div>
      </div>
    )
  }

  // Define itens do menu
  const menuItems = [
    { id: 'dashboard', label: '📊 Dashboard', icon: '📊', color: 'gray' },
    { id: 'casa', label: '🏠 Casa', icon: '🏠', color: 'blue' },
    { id: 'loja', label: '🏪 Loja', icon: '🏪', color: 'purple' },
    { id: 'configuracoes', label: '⚙️ Configurações', icon: '⚙️', color: 'slate' }
  ]

  const getButtonStyle = (id: string, color: string) => {
    const isActive = activeSection === id
    const colors: Record<string, { active: string; inactive: string }> = {
      blue: {
        active: 'bg-blue-600 text-white shadow-lg shadow-blue-500/50 border-blue-600',
        inactive: 'bg-white text-gray-700 border border-gray-200 hover:border-blue-300'
      },
      green: {
        active: 'bg-green-600 text-white shadow-lg shadow-green-500/50 border-green-600',
        inactive: 'bg-white text-gray-700 border border-gray-200 hover:border-green-300'
      },
      purple: {
        active: 'bg-purple-600 text-white shadow-lg shadow-purple-500/50 border-purple-600',
        inactive: 'bg-white text-gray-700 border border-gray-200 hover:border-purple-300'
      },
      gray: {
        active: 'bg-gray-700 text-white shadow-lg shadow-gray-500/50 border-gray-700',
        inactive: 'bg-white text-gray-700 border border-gray-200 hover:border-gray-300'
      },
      slate: {
        active: 'bg-slate-700 text-white shadow-lg shadow-slate-500/50 border-slate-700',
        inactive: 'bg-white text-gray-700 border border-gray-200 hover:border-slate-300'
      }
    }
    const colorStyle = colors[color] || colors.gray
    return isActive ? colorStyle.active : colorStyle.inactive
  }

  const getTitleBySection = () => {
    switch (activeSection) {
      case 'dashboard':
        return '📊 Dashboard Principal'
      case 'casa':
        return '🏠 Módulo Casa'
      case 'loja':
        return '🏪 Módulo Loja'
      case 'configuracoes':
        return '⚙️ Configurações'
      default:
        return '🏠 Módulo Casa'
    }
  }

  const getSectionBg = () => {
    switch (activeSection) {
      case 'casa': return 'bg-blue-50/40'
      case 'loja': return 'bg-purple-50/40'
      case 'dashboard': return 'bg-slate-900'
      default: return 'bg-gray-50/40'
    }
  }

  const isDark = activeSection === 'dashboard'

  return (
    <div className={`min-h-screen transition-all duration-500 ${getSectionBg()}`}>
      <div className="container mx-auto px-3 py-2">
        {/* Header com Usuário e Logout - COMPACTADO */}
        <div className="flex justify-between items-center mb-2">
          <div>
            <h1 className={`text-lg md:text-xl font-bold ${isDark ? 'text-white' : 'text-gray-800'}`}>
              {getTitleBySection()}
            </h1>
            <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-300' : 'text-gray-600'}`}>
              Bem-vindo, <span className={`font-semibold ${isDark ? 'text-white' : 'text-gray-800'}`}>{user?.email}</span>
            </p>
          </div>
          <button
            onClick={handleLogout}
            className="bg-red-500 hover:bg-red-600 text-white px-3 py-1.5 rounded-lg font-medium transition-colors shadow-md text-xs"
          >
            🚪 Sair
          </button>
        </div>

        {/* Menu de Navegação com Ícones - COMPACTADO */}
        <div className={`${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-100'} rounded-lg shadow-md p-1 mb-2 border`}>
          <div className="flex flex-wrap gap-1">
            {menuItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveSection(item.id)}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-all duration-200 flex items-center gap-2 text-xs ${getButtonStyle(item.id, item.color)}`}
              >
                <span>{item.icon}</span>
                <span className="hidden sm:inline">{item.label.split(' ')[1]}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Conteúdo Dinâmico */}
        {isDevFeaturesEnabled() && activeSection === 'dashboard' && (
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-1">
              <ResumoCaixas />
            </div>
            <div className="col-span-2">
              {/* Espaço para futuros componentes */}
            </div>
          </div>
        )}

        {activeSection === 'casa' && (
          <div>
            <CasaModulo />
          </div>
        )}

        {activeSection === 'loja' && (
          <div>
            <LojaModulo />
          </div>
        )}

        {activeSection === 'configuracoes' && (
          <div>
            <ModuloConfiguracoes />
          </div>
        )}
      </div>
    </div>
  )
}
