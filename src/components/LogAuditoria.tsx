'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

interface Log {
  id: number
  data_hora: string
  user_id: string
  user_email: string
  action: string
  table_name: string
  record_id: string
  old_data: Record<string, unknown> | null
  new_data: Record<string, unknown> | null
}

const LogAuditoria = () => {
  const [logs, setLogs] = useState<Log[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedLog, setSelectedLog] = useState<Log | null>(null)

  useEffect(() => {
    const fetchLogs = async () => {
      setLoading(true)
      setError(null)

      try {
        // 1. Verificar Sessão (necessário para as políticas de segurança)
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession()

        if (sessionError) {
          setError(`Erro de autenticação: ${sessionError.message}`)
          setLoading(false)
          return
        }

        if (!sessionData.session) {
          setError("Você precisa estar logado para acessar os logs de auditoria.")
          setLoading(false)
          return
        }

        // 2. Buscar Logs
        const { data, error: dbError } = await supabase
          .from('auditoria')
          .select('*')
          .order('data_hora', { ascending: false })
          .limit(1000)

        if (dbError) {
          console.error('Erro Supabase Auditoria:', dbError)
          const detalhe = dbError.details || dbError.hint || ''
          setError(`Erro [${dbError.code}]: ${dbError.message}. ${detalhe} Certifique-se de que a tabela "auditoria" existe e você executou o script SETUP_AUDITORIA.sql.`)
        } else {
          setLogs(data as Log[])
        }
      } catch (err: any) {
        console.error('Erro inesperado auditoria:', err)
        setError(`Erro inesperado: ${err.message || JSON.stringify(err)}`)
      } finally {
        setLoading(false)
      }
    }

    fetchLogs()
  }, [])

  const renderAlteracoes = (log: Log) => {
    const { action, old_data, new_data } = log

    if (action === 'INSERT') {
      const entries = Object.entries(new_data || {})

      if (entries.length === 0) {
        return (
          <div className="bg-gray-50 p-4 rounded border border-dashed border-gray-300 text-center">
            <p className="text-gray-500 text-sm italic">Nenhum dado detalhado foi capturado para esta inclusão.</p>
            <p className="text-[10px] text-gray-400 mt-1">Verifique se o trigger no Supabase está configurado corretamente com row_to_json(NEW).</p>
          </div>
        )
      }

      return (
        <div className="space-y-2">
          <p className="font-semibold text-green-700">Resumo da Inclusão:</p>
          <div className="grid grid-cols-1 gap-1">
            {entries.map(([key, value]) => (
              <div key={key} className="flex border-b border-gray-100 py-1 hover:bg-gray-50/50">
                <span className="font-medium w-1/3 text-gray-600">{key}:</span>
                <span className="w-2/3 break-all">{String(value ?? '—')}</span>
              </div>
            ))}
          </div>
        </div>
      )
    }

    if (action === 'DELETE') {
      const entries = Object.entries(old_data || {})

      if (entries.length === 0) {
        return (
          <div className="bg-red-50 p-4 rounded border border-dashed border-red-200 text-center">
            <p className="text-red-500 text-sm italic">Os dados excluídos não foram capturados.</p>
          </div>
        )
      }

      return (
        <div className="space-y-2">
          <p className="font-semibold text-red-700">Dados Excluídos:</p>
          <div className="grid grid-cols-1 gap-1">
            {entries.map(([key, value]) => (
              <div key={key} className="flex border-b border-gray-100 py-1 text-gray-500 italic">
                <span className="font-medium w-1/3">{key}:</span>
                <span className="w-2/3 break-all">{String(value ?? '—')}</span>
              </div>
            ))}
          </div>
        </div>
      )
    }

    if (action === 'UPDATE') {
      const changes: { field: string; old: unknown; new: unknown }[] = []

      const allKeys = new Set([
        ...Object.keys(old_data || {}),
        ...Object.keys(new_data || {})
      ])

      allKeys.forEach(key => {
        const oldVal = (old_data as Record<string, unknown>)?.[key]
        const newVal = (new_data as Record<string, unknown>)?.[key]

        // Compara valores (convertendo para string para simplificar comparação de datas/números)
        if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
          changes.push({ field: key, old: oldVal, new: newVal })
        }
      })

      if (changes.length === 0) return <p className="text-gray-500 italic">Nenhuma alteração detectada nos campos.</p>

      return (
        <div className="space-y-3">
          <p className="font-semibold text-yellow-700">Campos Alterados:</p>
          <div className="overflow-hidden border border-gray-200 rounded-lg">
            <table className="min-w-full divide-y divide-gray-200 text-xs">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left font-bold text-gray-700">Campo</th>
                  <th className="px-3 py-2 text-left font-bold text-gray-700">Valor Antigo</th>
                  <th className="px-3 py-2 text-left font-bold text-gray-700">Valor Novo</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {changes.map(change => (
                  <tr key={change.field}>
                    <td className="px-3 py-2 font-medium text-gray-900 bg-gray-50/50">{change.field}</td>
                    <td className="px-3 py-2 text-red-600 line-through bg-red-50/30">{String(change.old ?? '—')}</td>
                    <td className="px-3 py-2 text-green-700 font-semibold bg-green-50/30">{String(change.new ?? '—')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )
    }

    return null
  }

  return (
    <div className="bg-white p-4 rounded-lg shadow-md">
      <h2 className="text-lg font-bold mb-4 text-gray-800">Log de Auditoria do Sistema</h2>

      {loading && <p className="text-sm text-gray-600">Carregando logs...</p>}
      {error && <p className="text-sm text-red-600 bg-red-100 p-3 rounded">{error}</p>}
      
      {!loading && !error && (
        <div className="overflow-x-auto max-h-[70vh]">
          <table className="min-w-full text-xs bg-white">
            <thead className="bg-gray-100 sticky top-0">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-gray-600">Data/Hora</th>
                <th className="px-3 py-2 text-left font-medium text-gray-600">Usuário</th>
                <th className="px-3 py-2 text-left font-medium text-gray-600">Ação</th>
                <th className="px-3 py-2 text-left font-medium text-gray-600">Tabela</th>
                <th className="px-3 py-2 text-left font-medium text-gray-600">ID do Registro</th>
                <th className="px-3 py-2 text-center font-medium text-gray-600">Detalhes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2 whitespace-nowrap">{new Date(log.data_hora).toLocaleString('pt-BR')}</td>
                  <td className="px-3 py-2">{log.user_email}</td>
                  <td className="px-3 py-2">
                    <span className={`px-2 py-0.5 rounded-full text-white text-[10px] ${
                      log.action === 'INSERT' ? 'bg-green-500' :
                      log.action === 'UPDATE' ? 'bg-yellow-500' :
                      'bg-red-500'
                    }`}>
                      {log.action}
                    </span>
                  </td>
                  <td className="px-3 py-2">{log.table_name}</td>
                  <td className="px-3 py-2">{log.record_id}</td>
                  <td className="px-3 py-2 text-center">
                    <button 
                      onClick={() => setSelectedLog(log)}
                      className="text-blue-600 hover:underline text-xs"
                    >
                      Ver
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedLog && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={() => setSelectedLog(null)}
        >
          <div 
            className="bg-white rounded-lg shadow-xl p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-bold mb-4">Detalhes do Log #{selectedLog.id}</h3>
            <div className="space-y-3 text-xs">
              <p><strong>Data/Hora:</strong> {new Date(selectedLog.data_hora).toLocaleString('pt-BR')}</p>
              <p><strong>Usuário:</strong> {selectedLog.user_email} ({selectedLog.user_id})</p>
              <p><strong>Ação:</strong> {selectedLog.action}</p>
              <p><strong>Tabela:</strong> {selectedLog.table_name}</p>
              <div className="flex items-center gap-2">
                <strong>ID do Registro:</strong>
                <code className="bg-gray-100 px-1 rounded">{selectedLog.record_id}</code>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(selectedLog.record_id)
                    alert('ID copiado!')
                  }}
                  className="text-[10px] text-blue-600 hover:underline"
                >
                  (Copiar)
                </button>
              </div>
            </div>
            
            <div className="mt-6 border-t pt-4">
              {renderAlteracoes(selectedLog)}
            </div>

            <div className="mt-8 pt-4 border-t border-dashed border-gray-200">
              <button
                onClick={(e) => {
                  const el = e.currentTarget.nextElementSibling
                  if (el) el.classList.toggle('hidden')
                }}
                className="text-[10px] text-gray-400 hover:text-gray-600 underline uppercase tracking-widest"
              >
                Ver JSON Bruto
              </button>
              <div className="hidden mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="text-[10px] font-bold text-gray-400 mb-2 uppercase">Dados Originais (Old)</h4>
                  <pre className="bg-gray-50 p-2 rounded text-[10px] text-gray-500 overflow-x-auto">
                    {JSON.stringify(selectedLog.old_data, null, 2)}
                  </pre>
                </div>
                <div>
                  <h4 className="text-[10px] font-bold text-gray-400 mb-2 uppercase">Novos Dados (New)</h4>
                  <pre className="bg-gray-50 p-2 rounded text-[10px] text-gray-500 overflow-x-auto">
                    {JSON.stringify(selectedLog.new_data, null, 2)}
                  </pre>
                </div>
              </div>
            </div>

            <button
              onClick={() => setSelectedLog(null)}
              className="mt-6 bg-gray-500 text-white px-4 py-1.5 rounded-md text-xs hover:bg-gray-600"
            >
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default LogAuditoria