import { supabase } from './supabase.js'

export async function getSession() {
  const { data: { session } } = await supabase.auth.getSession()
  return session
}

export async function signInWithMagicLink(email) {
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: window.location.origin + window.location.pathname,
    },
  })
  return { error }
}

export async function signOut() {
  await supabase.auth.signOut()
  window.location.reload()
}

export function onAuthStateChange(callback) {
  supabase.auth.onAuthStateChange((_event, session) => {
    callback(session)
  })
}
