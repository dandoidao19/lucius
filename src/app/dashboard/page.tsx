'use client'

import AuthGuard from '@/components/AuthGuard'
import Dashboard from '@/components/Dashboard'

export default function DashboardPage() {
  return (
    <AuthGuard>
      <main className="min-h-screen bg-gray-100">
        <div className="container mx-auto">
          <Dashboard />
        </div>
      </main>
    </AuthGuard>
  )
}