// Cliente Supabase do projeto usemaju (banco separado dentro do mesmo perfil)
import { createClient } from '@supabase/supabase-js'

const supabaseUsemajuUrl = process.env.NEXT_PUBLIC_USERMAJU_SUPABASE_URL || 'https://placeholder.supabase.co'
const supabaseUsemajuAnonKey = process.env.NEXT_PUBLIC_USERMAJU_SUPABASE_ANON_KEY || 'placeholder'

export const supabaseUsemaju = createClient(supabaseUsemajuUrl, supabaseUsemajuAnonKey)
