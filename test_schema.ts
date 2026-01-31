import { supabase } from './src/lib/supabase'

async function test() {
  const { data, error } = await supabase.from('compras').select('*').limit(1)
  if (error) console.error('Error fetching compra:', error)
  else console.log('Columns in compras:', Object.keys(data[0] || {}))

  const { data: v, error: ev } = await supabase.from('vendas').select('*').limit(1)
  if (ev) console.error('Error fetching venda:', ev)
  else console.log('Columns in vendas:', Object.keys(v[0] || {}))

  const { data: c, error: ec } = await supabase.from('transacoes_condicionais').select('*').limit(1)
  if (ec) console.error('Error fetching condicional:', ec)
  else console.log('Columns in transacoes_condicionais:', Object.keys(c[0] || {}))
}

test()
