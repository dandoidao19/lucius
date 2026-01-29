'use client'

import { useState, useEffect } from 'react'
import { obterConfigLogos } from '@/lib/gerador-pdf-utils'

export default function CabecalhoSistema() {
  const [logos, setLogos] = useState<{ empresa?: string; cliente?: string }>({})

  useEffect(() => {
    const config = obterConfigLogos()
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLogos({
      empresa: config.logoEmpresa,
      cliente: config.logoCliente
    })
  }, [])

  return (
    <div className="bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 text-white py-1.5 px-4 shadow-lg border-b-2 border-blue-600">
      <div className="container mx-auto flex items-center justify-center gap-8">
        {/* Logo Empresa (Esquerda) */}
        {logos.empresa && (
          <div className="flex-shrink-0">
            <img 
              src={logos.empresa}
              alt="Logo Empresa" 
              className="h-8 object-contain"
            />
          </div>
        )}

        {/* Nome do Sistema (Centro) */}
        <div className="text-center">
          <h1 className="text-2xl font-black tracking-widest bg-gradient-to-r from-blue-400 to-blue-600 bg-clip-text text-transparent italic relative">
            LUCIUS
            <span className="absolute -top-1 -right-8 text-[9px] font-normal tracking-normal text-blue-400/80 not-italic">v3.0</span>
          </h1>
        </div>

        {/* Logo Cliente (Direita) */}
        {logos.cliente && (
          <div className="flex-shrink-0">
            <img 
              src={logos.cliente}
              alt="Logo Cliente" 
              className="h-8 object-contain"
            />
          </div>
        )}
      </div>
    </div>
  )
}
