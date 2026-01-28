'use client'

import FormularioLancamentoLoja from './FormularioLancamentoLoja'

interface ModalFinanceiroAvulsoProps {
  aberto: boolean
  onClose: () => void
  onSucesso: () => void
}

export default function ModalFinanceiroAvulso({ aberto, onClose, onSucesso }: ModalFinanceiroAvulsoProps) {
  if (!aberto) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="w-full max-w-md">
        <FormularioLancamentoLoja
          onLancamentoAdicionado={() => {
            onSucesso()
            onClose()
          }}
          onCancel={onClose}
        />
      </div>
    </div>
  )
}
