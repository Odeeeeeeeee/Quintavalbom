import { supabase } from './supabase.js'

// ---- FAQs ----

export async function getFaqs() {
  const { data, error } = await supabase
    .from('faqs')
    .select('*')
    .order('category')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function createFaq({ category, question, answer, context }) {
  const { data, error } = await supabase
    .from('faqs')
    .insert({ category, question, answer, context, status: 'active', source: 'Admin' })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateFaq(id, updates) {
  const { data, error } = await supabase
    .from('faqs')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteFaq(id) {
  const { error } = await supabase
    .from('faqs')
    .update({ status: 'archived' })
    .eq('id', id)
  if (error) throw error
}

// ---- Categories ----

export async function getCategories() {
  const { data, error } = await supabase
    .from('categories')
    .select('name')
    .order('sort_order')
  if (error) throw error
  return data.map((c) => c.name)
}

// ---- Pending Questions ----

export async function getPendingQuestions() {
  const { data, error } = await supabase
    .from('pending_questions')
    .select('*')
    .eq('answered', false)
    .order('last_asked', { ascending: false })
  if (error) throw error
  return data
}

export async function markPendingAnswered(id, faqId = null) {
  const { error } = await supabase
    .from('pending_questions')
    .update({ answered: true, answer_added_to_faq_id: faqId })
    .eq('id', id)
  if (error) throw error
}

export async function dismissPending(id) {
  const { error } = await supabase
    .from('pending_questions')
    .update({ answered: true })
    .eq('id', id)
  if (error) throw error
}

// ---- Stats ----

export async function getStats() {
  const [faqs, pending, conversations, cacheHits] = await Promise.all([
    supabase.from('faqs').select('*', { count: 'exact', head: true }).eq('status', 'active'),
    supabase.from('pending_questions').select('*', { count: 'exact', head: true }).eq('answered', false),
    supabase.from('conversations').select('*', { count: 'exact', head: true }).eq('direction', 'inbound'),
    supabase.from('conversations').select('*', { count: 'exact', head: true }).eq('answer_source', 'cache'),
  ])
  return {
    totalFaqs: faqs.count ?? 0,
    pendingCount: pending.count ?? 0,
    totalConversations: conversations.count ?? 0,
    cacheHits: cacheHits.count ?? 0,
  }
}
