'use client'

import Image from 'next/image'

export default function CabecalhoSistema() {
  return (
    <div className="sticky top-0 z-50 bg-slate-950/95 text-white py-1 px-2 shadow-sm border-b border-slate-800 backdrop-blur-sm">
      <div className="mx-auto flex items-center justify-between gap-2 max-w-full">
        <div className="flex items-center gap-2">
          <div className="rounded-md bg-white/10 p-1">
            <Image src="/lucius_icon.svg" alt="Lucius" width={20} height={20} className="h-5 w-5" priority />
          </div>
          <span className="text-xs font-semibold tracking-[0.12em] text-white">Lucius</span>
        </div>
        <span className="text-[10px] uppercase tracking-[0.18em] text-slate-400">v5.0</span>
      </div>
    </div>
  )
}
