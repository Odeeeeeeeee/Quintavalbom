/**
 * Quinta Valbom -- WhatsApp webhook + Claude FAQ handler
 * Supabase Edge Function (Deno + TypeScript)
 *
 * Endpoint: POST /functions/v1/whatsapp-webhook
 *
 * Stroom:
 *   1. Meta verifieert webhook met GET-request (challenge-response)
 *   2. Inkomend WhatsApp bericht -> POST met message payload
 *   3. Rate-limit check per telefoonnummer
 *   4. Cache lookup (exacte match op genormaliseerde vraag)
 *   5. Claude AI met conversatie-context + FAQ-kennis
 *   6. Fallback: escalatie naar Moniek/Thomas
 *   7. Antwoord terug via WhatsApp Cloud API
 *
 * Secrets nodig (via `supabase secrets set`):
 *   - WHATSAPP_VERIFY_TOKEN
 *   - WHATSAPP_ACCESS_TOKEN  (permanent System User token)
 *   - WHATSAPP_PHONE_NUMBER_ID
 *   - ANTHROPIC_API_KEY
 *
 * Standaard beschikbaar:
 *   - SUPABASE_URL
 *   - SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from 'jsr:@supabase/supabase-js@2'

// ----------------------------------------------------------------
// Config
// ----------------------------------------------------------------
const WA_VERIFY_TOKEN = Deno.env.get('WHATSAPP_VERIFY_TOKEN') ?? ''
const WA_ACCESS_TOKEN = Deno.env.get('WHATSAPP_ACCESS_TOKEN') ?? ''
const WA_PHONE_NUMBER_ID = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID') ?? ''
const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY') ?? ''
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

const META_API_BASE = 'https://graph.facebook.com/v21.0'
const RATE_LIMIT_WINDOW_MINUTES = 5
const RATE_LIMIT_MAX_MESSAGES = 10
const CONVERSATION_CONTEXT_MESSAGES = 6 // laatste 3 heen-en-weer

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

// ----------------------------------------------------------------
// Hoofd-handler
// ----------------------------------------------------------------
Deno.serve(async (req: Request) => {
  const url = new URL(req.url)

  // --- GET: Meta webhook verificatie (challenge-response) ---
  if (req.method === 'GET') {
    const mode = url.searchParams.get('hub.mode')
    const token = url.searchParams.get('hub.verify_token')
    const challenge = url.searchParams.get('hub.challenge')

    if (mode === 'subscribe' && token === WA_VERIFY_TOKEN) {
      console.log('[webhook] verificatie geslaagd')
      return new Response(challenge ?? '', { status: 200 })
    }
    console.warn('[webhook] verificatie GEFAALD', { mode, token })
    return new Response('Forbidden', { status: 403 })
  }

  // --- POST: inkomend WhatsApp bericht ---
  if (req.method === 'POST') {
    try {
      const body = await req.json()
      // Meta verwacht direct 200. We verwerken async.
      processWebhook(body).catch((e) => console.error('[webhook] async err', e))
      return new Response('OK', { status: 200 })
    } catch (e) {
      console.error('[webhook] parse error', e)
      return new Response('Bad request', { status: 400 })
    }
  }

  return new Response('Method not allowed', { status: 405 })
})

// ----------------------------------------------------------------
// Webhook payload verwerken
// ----------------------------------------------------------------
async function processWebhook(payload: any) {
  const change = payload?.entry?.[0]?.changes?.[0]
  const value = change?.value
  const messages = value?.messages

  if (!messages || messages.length === 0) {
    return
  }

  for (const msg of messages) {
    const senderPhone = msg.from

    // Rate-limit check
    if (await isRateLimited(senderPhone)) {
      console.warn('[webhook] rate limited:', senderPhone)
      return
    }

    if (msg.type !== 'text') {
      await sendWhatsAppMessage(
        senderPhone,
        'Sorry, ik begrijp alleen tekstberichten. Stuur je vraag als tekst, dan help ik je graag! 😊',
      )
      continue
    }

    const userQuestion = msg.text.body.trim()
    if (!userQuestion) continue

    console.log('[webhook] vraag van', senderPhone, ':', userQuestion)

    // Log inkomend bericht
    await supabase.from('conversations').insert({
      sender_phone: senderPhone,
      direction: 'inbound',
      channel: 'whatsapp',
      message_text: userQuestion,
    })

    // 3-laagse antwoord-logica
    const answer = await answerQuestion(userQuestion, senderPhone)

    // Stuur antwoord terug
    await sendWhatsAppMessage(senderPhone, answer.text)

    // Log uitgaand bericht
    await supabase.from('conversations').insert({
      sender_phone: senderPhone,
      direction: 'outbound',
      channel: 'whatsapp',
      message_text: answer.text,
      detected_language: answer.language,
      answer_source: answer.source,
      matched_faq_id: answer.faqId,
      claude_tokens_in: answer.tokensIn,
      claude_tokens_out: answer.tokensOut,
    })
  }
}

// ----------------------------------------------------------------
// Rate limiting (per telefoonnummer)
// ----------------------------------------------------------------
async function isRateLimited(phone: string): Promise<boolean> {
  const since = new Date(Date.now() - RATE_LIMIT_WINDOW_MINUTES * 60_000).toISOString()
  const { count } = await supabase
    .from('conversations')
    .select('*', { count: 'exact', head: true })
    .eq('sender_phone', phone)
    .eq('direction', 'inbound')
    .gte('created_at', since)

  return (count ?? 0) >= RATE_LIMIT_MAX_MESSAGES
}

// ----------------------------------------------------------------
// Conversatie-historie ophalen
// ----------------------------------------------------------------
async function getConversationHistory(phone: string): Promise<{ role: string; text: string }[]> {
  const { data } = await supabase
    .from('conversations')
    .select('direction, message_text, created_at')
    .eq('sender_phone', phone)
    .order('created_at', { ascending: false })
    .limit(CONVERSATION_CONTEXT_MESSAGES)

  if (!data || data.length === 0) return []

  return data
    .reverse()
    .filter((m) => m.message_text)
    .map((m) => ({
      role: m.direction === 'inbound' ? 'user' : 'assistant',
      text: m.message_text,
    }))
}

// ----------------------------------------------------------------
// 3-laagse antwoord-logica (Cache -> Claude -> fallback)
// ----------------------------------------------------------------
type AnswerResult = {
  text: string
  source: 'cache' | 'claude' | 'fallback'
  language: string
  faqId: string | null
  tokensIn?: number
  tokensOut?: number
}

async function answerQuestion(question: string, senderPhone: string): Promise<AnswerResult> {
  const normalizedQ = normalizeQuestion(question)
  const isShortMessage = question.split(/\s+/).length <= 4

  // === LAAG 1: Cache lookup (skip bij korte berichten -- waarschijnlijk vervolgvragen) ===
  if (!isShortMessage) {
    const { data: cached } = await supabase
      .from('question_cache')
      .select('faq_id, answer, language, normalized_question')
      .eq('normalized_question', normalizedQ)
      .maybeSingle()

    if (cached) {
      await supabase.rpc('increment_cache_hit', { q: normalizedQ, l: cached.language }).catch(() => {})
      return {
        text: cached.answer,
        source: 'cache',
        language: cached.language ?? 'nl',
        faqId: cached.faq_id,
      }
    }
  }

  // === LAAG 2: Claude AI met conversatie-context ===
  const [faqsResult, history] = await Promise.all([
    supabase
      .from('faqs')
      .select('id, legacy_id, category, question, answer, context')
      .eq('status', 'active'),
    getConversationHistory(senderPhone),
  ])

  const faqs = faqsResult.data
  if (!faqs || faqs.length === 0) {
    return {
      text: fallbackMessage('nl'),
      source: 'fallback',
      language: 'nl',
      faqId: null,
    }
  }

  try {
    const claudeResult = await askClaude(question, faqs, history)
    if (claudeResult.matched && claudeResult.answer) {
      const detectedLang = claudeResult.language ?? 'nl'

      // Schrijf naar cache (alleen als het geen korte vervolgvraag is)
      if (!isShortMessage && claudeResult.faqId) {
        await supabase.from('question_cache').upsert({
          normalized_question: normalizedQ,
          language: detectedLang,
          faq_id: claudeResult.faqId,
          answer: claudeResult.answer,
          original_question: question,
          last_used: new Date().toISOString(),
        }, { onConflict: 'normalized_question,language' })
      }

      return {
        text: claudeResult.answer,
        source: 'claude',
        language: detectedLang,
        faqId: claudeResult.faqId ?? null,
        tokensIn: claudeResult.tokensIn,
        tokensOut: claudeResult.tokensOut,
      }
    }
  } catch (err) {
    console.error('[answer] Claude error', err)
  }

  // === LAAG 3: Fallback ===
  const fallbackLang = detectLanguageHint(question)
  await savePendingQuestion(question, fallbackLang, senderPhone)
  return {
    text: fallbackMessage(fallbackLang),
    source: 'fallback',
    language: fallbackLang,
    faqId: null,
  }
}

// ----------------------------------------------------------------
// Claude API aanroep (met conversatie-context)
// ----------------------------------------------------------------
async function askClaude(
  question: string,
  faqs: any[],
  history: { role: string; text: string }[],
): Promise<{
  matched: boolean
  answer?: string
  faqId?: string
  language?: string
  tokensIn?: number
  tokensOut?: number
}> {
  const compactFaqs = faqs.map((f) => ({
    id: f.id,
    category: f.category,
    q: f.question,
    a: f.answer,
    ctx: f.context || '',
  }))

  const systemPrompt = `You are the friendly chatbot of camping Quinta Valbom in Portugal -- a small family-run campsite owned by Moniek and Thomas.

YOUR JOB: BE HELPFUL.
- If the FAQ list contains ANY information that could help (even loosely related), USE IT.
- Be liberal in matching: "Where can I get coffee?" -> bar FAQ. "Is the water safe?" -> tap-water FAQ.
- It's MUCH better to give a useful related answer than to escalate.
- You have conversation history. Use it to understand follow-up questions like "and on Sunday?" or "what time exactly?".

LANGUAGE: Detect the guest's language from their message. Answer in THAT language. Supported: Dutch, English, Portuguese, German, French. Default to Dutch if unclear.

OUTPUT (strict JSON, nothing else):
- If you can help: {"matched":true,"answer":"<your answer>","faq_id":"<UUID of best matching FAQ>","language":"<nl|en|pt|de|fr>"}
- If no FAQ is relevant at all AND it's not a follow-up you can answer from context: {"matched":false,"language":"<nl|en|pt|de|fr>"}

ANSWER STYLE:
- 1-3 sentences, friendly, direct. No greetings unless it's clearly the start of a conversation.
- For follow-up questions, answer concisely -- the guest already has context from the previous message.
- Use a warm but efficient tone, like a helpful campsite receptionist.

FAQS (in Dutch -- translate your answer to the guest's language):
${JSON.stringify(compactFaqs)}`

  // Bouw messages array: conversatie-historie + nieuwe vraag
  const messages: { role: string; content: string }[] = []

  // Voeg recente historie toe (als die er is)
  for (const msg of history) {
    messages.push({ role: msg.role, content: msg.text })
  }

  // Huidige vraag (als die niet al in de historie zit)
  const lastHistoryMsg = history[history.length - 1]
  if (!lastHistoryMsg || lastHistoryMsg.text !== question || lastHistoryMsg.role !== 'user') {
    messages.push({ role: 'user', content: question })
  }

  // Zorg dat messages altijd begint met user (Anthropic API vereiste)
  while (messages.length > 0 && messages[0].role !== 'user') {
    messages.shift()
  }

  // Zorg dat rollen afwisselen (merge opeenvolgende zelfde rollen)
  const cleanMessages = mergeConsecutiveRoles(messages)

  const response = await fetchWithRetry('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 400,
      temperature: 0.3,
      system: systemPrompt,
      messages: cleanMessages,
    }),
  })

  const data = await response.json()
  const text = data?.content?.[0]?.text?.trim() || ''
  const tokensIn = data?.usage?.input_tokens
  const tokensOut = data?.usage?.output_tokens

  const parsed = parseJsonResponse(text)

  if (!parsed || parsed.matched === false) {
    return { matched: false, language: parsed?.language, tokensIn, tokensOut }
  }

  return {
    matched: true,
    answer: parsed.answer,
    faqId: parsed.faq_id,
    language: parsed.language,
    tokensIn,
    tokensOut,
  }
}

// ----------------------------------------------------------------
// Fetch met retry (voor Claude API 429/529 errors)
// ----------------------------------------------------------------
async function fetchWithRetry(url: string, options: RequestInit, maxRetries = 2): Promise<Response> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await fetch(url, options)
    if (response.ok) return response
    if ((response.status === 429 || response.status === 529) && attempt < maxRetries) {
      const waitMs = (attempt + 1) * 2000
      console.warn(`[claude] ${response.status}, retry ${attempt + 1} in ${waitMs}ms`)
      await new Promise((r) => setTimeout(r, waitMs))
      continue
    }
    const errText = await response.text()
    throw new Error(`Claude API ${response.status}: ${errText.slice(0, 200)}`)
  }
  throw new Error('Claude API: max retries exceeded')
}

// ----------------------------------------------------------------
// JSON response parsing (robuust tegen markdown wrapping etc.)
// ----------------------------------------------------------------
function parseJsonResponse(text: string): any {
  // Probeer direct
  try {
    return JSON.parse(text)
  } catch { /* noop */ }

  // Strip markdown code blocks
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (codeBlockMatch) {
    try {
      return JSON.parse(codeBlockMatch[1].trim())
    } catch { /* noop */ }
  }

  // Zoek eerste JSON object
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0])
    } catch { /* noop */ }
  }

  return null
}

// ----------------------------------------------------------------
// Messages helper: merge opeenvolgende berichten met dezelfde rol
// ----------------------------------------------------------------
function mergeConsecutiveRoles(messages: { role: string; content: string }[]): { role: string; content: string }[] {
  if (messages.length === 0) return []

  const merged: { role: string; content: string }[] = [{ ...messages[0] }]
  for (let i = 1; i < messages.length; i++) {
    const prev = merged[merged.length - 1]
    if (messages[i].role === prev.role) {
      prev.content += '\n' + messages[i].content
    } else {
      merged.push({ ...messages[i] })
    }
  }
  return merged
}

// ----------------------------------------------------------------
// WhatsApp bericht versturen
// ----------------------------------------------------------------
async function sendWhatsAppMessage(toPhone: string, text: string): Promise<void> {
  const url = `${META_API_BASE}/${WA_PHONE_NUMBER_ID}/messages`
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${WA_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: toPhone,
      type: 'text',
      text: { body: text },
    }),
  })

  if (!response.ok) {
    const errText = await response.text()
    console.error('[whatsapp send] FOUT', response.status, errText.slice(0, 300))
  }
}

// ----------------------------------------------------------------
// Pending question opslaan (escalatie naar eigenaar)
// ----------------------------------------------------------------
async function savePendingQuestion(question: string, language: string, senderPhone: string) {
  try {
    const { error } = await supabase
      .from('pending_questions')
      .upsert(
        {
          question,
          language,
          sender_phone: senderPhone,
          last_asked: new Date().toISOString(),
        },
        { onConflict: 'question' },
      )
    if (error) console.error('[pending] err', error)
  } catch (e) {
    console.error('[pending] err', e)
  }
}

// ----------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------
function normalizeQuestion(q: string): string {
  return q.toLowerCase().trim().replace(/[?!.,;:'"()]/g, '').replace(/\s+/g, ' ')
}

/**
 * Simpele taal-hint voor fallback berichten (wanneer Claude niet bereikbaar is).
 * Niet gebruikt voor de hoofdflow -- Claude detecteert de taal zelf.
 */
function detectLanguageHint(text: string): string {
  const t = ` ${text.toLowerCase()} `
  const markers: Record<string, string[]> = {
    en: [' the ', ' is ', ' are ', ' what ', ' how ', ' when ', ' where ', ' can ', ' you ', ' please '],
    pt: [' o ', ' a ', ' que ', ' como ', ' quando ', ' onde ', ' posso ', ' obrigado '],
    de: [' der ', ' die ', ' das ', ' ich ', ' wie ', ' wann ', ' wo ', ' kann ', ' bitte '],
    fr: [' le ', ' la ', ' je ', ' comment ', ' quand ', ' est-ce ', ' merci '],
    nl: [' de ', ' het ', ' een ', ' ik ', ' wat ', ' hoe ', ' waar ', ' kan '],
  }
  let best = 'nl'
  let bestScore = 0
  for (const [lang, words] of Object.entries(markers)) {
    const score = words.filter((w) => t.includes(w)).length
    if (score > bestScore) {
      best = lang
      bestScore = score
    }
  }
  return best
}

function fallbackMessage(language: string): string {
  const fallbacks: Record<string, string> = {
    nl: 'Daar heb ik nu geen passend antwoord op. Ik heb je vraag doorgegeven aan Moniek of Thomas. Voor iets dringends: +351 910 348 399 (WhatsApp).',
    en: "I don't have a good answer for that right now. Your question has been forwarded to Moniek or Thomas. Urgent? +351 910 348 399 (WhatsApp).",
    pt: 'Nao tenho uma boa resposta para isso agora. A sua pergunta foi encaminhada a Moniek ou ao Thomas. Urgente? +351 910 348 399 (WhatsApp).',
    de: 'Darauf habe ich gerade keine passende Antwort. Deine Frage wurde an Moniek oder Thomas weitergeleitet. Dringend? +351 910 348 399 (WhatsApp).',
    fr: "Je n'ai pas de bonne reponse pour le moment. Votre question a ete transmise a Moniek ou Thomas. Urgent ? +351 910 348 399 (WhatsApp).",
  }
  return fallbacks[language] || fallbacks.nl
}
