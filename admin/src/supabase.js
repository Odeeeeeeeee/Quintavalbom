import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js'

function getClient() {
  if (!window.supabase?.createClient) {
    throw new Error('Supabase library not loaded. Check your internet connection and reload.')
  }
  return window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
}

export const supabase = getClient()
