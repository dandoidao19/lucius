'use client'

import AuthGuard from '@/components/AuthGuard'
import CaixaGeral from '@/components/CaixaGeral'

export default function DashboardPage() {
  return (
    <AuthGuard>
      <main className="min-h-screen bg-gray-100">
        <div className="container mx-auto">
          <CaixaGeral />
        </div>
      </main>
    </AuthGuard>
  )
}