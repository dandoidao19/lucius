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

  const renderJsonData = (data: Record<string, unknown> | null) => {
    if (!data) return <span className="text-gray-400">N/A</span>
    return (
      <pre className="bg-gray-100 p-2 rounded text-xs whitespace-pre-wrap break-all">
        {JSON.stringify(data, null, 2)}
      </pre>
    )
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
              <p><strong>ID do Registro:</strong> {selectedLog.record_id}</p>
            </div>
            
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h4 className="font-bold text-sm mb-2">Dados Antigos (Old)</h4>
                {renderJsonData(selectedLog.old_data)}
              </div>
              <div>
                <h4 className="font-bold text-sm mb-2">Dados Novos (New)</h4>
                {renderJsonData(selectedLog.new_data)}
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