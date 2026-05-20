import { getSession, signInWithMagicLink, signOut, onAuthStateChange } from './auth.js'
import { getFaqs, createFaq, updateFaq, deleteFaq, getCategories, getPendingQuestions, markPendingAnswered, dismissPending, getStats } from './api.js'

// ----------------------------------------------------------------
// State
// ----------------------------------------------------------------
let state = {
  session: null,
  view: 'faqs', // 'faqs' | 'pending' | 'stats'
  faqs: [],
  categories: [],
  pending: [],
  stats: null,
  editingFaq: null,
  loading: true,
  error: null,
  searchQuery: '',
  filterCategory: '',
}

const app = document.getElementById('app')

// ----------------------------------------------------------------
// Init
// ----------------------------------------------------------------
async function init() {
  state.session = await getSession()
  onAuthStateChange((session) => {
    state.session = session
    if (session) loadData()
    render()
  })
  if (state.session) await loadData()
  state.loading = false
  render()
}

async function loadData() {
  try {
    const [faqs, categories, pending, stats] = await Promise.all([
      getFaqs(),
      getCategories(),
      getPendingQuestions(),
      getStats(),
    ])
    state.faqs = faqs
    state.categories = categories
    state.pending = pending
    state.stats = stats
    state.error = null
  } catch (e) {
    state.error = e.message
  }
}

// ----------------------------------------------------------------
// Render
// ----------------------------------------------------------------
function render() {
  if (state.loading) {
    app.innerHTML = renderLoading()
    return
  }
  if (!state.session) {
    app.innerHTML = renderLogin()
    attachLoginHandlers()
    return
  }
  app.innerHTML = renderDashboard()
  attachDashboardHandlers()
}

function renderLoading() {
  return `
    <div class="flex items-center justify-center min-h-screen">
      <div class="text-gray-500">Laden...</div>
    </div>`
}

// ----------------------------------------------------------------
// Login
// ----------------------------------------------------------------
function renderLogin() {
  return `
    <div class="flex items-center justify-center min-h-screen">
      <div class="bg-white rounded-xl shadow-lg p-8 w-full max-w-md">
        <div class="text-center mb-6">
          <h1 class="text-2xl font-bold text-quinta-800">Quinta Valbom</h1>
          <p class="text-gray-500 mt-1">Admin Dashboard</p>
        </div>
        <form id="login-form">
          <label class="block text-sm font-medium text-gray-700 mb-1">E-mailadres</label>
          <input type="email" id="login-email" required
            class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-quinta-500 focus:border-quinta-500 outline-none"
            placeholder="thomas@quintavalbom.nl">
          <button type="submit" id="login-btn"
            class="w-full mt-4 bg-quinta-600 text-white py-2 px-4 rounded-lg hover:bg-quinta-700 transition font-medium">
            Stuur login-link
          </button>
          <div id="login-msg" class="mt-3 text-sm text-center hidden"></div>
        </form>
      </div>
    </div>`
}

function attachLoginHandlers() {
  const form = document.getElementById('login-form')
  form?.addEventListener('submit', async (e) => {
    e.preventDefault()
    const email = document.getElementById('login-email').value
    const btn = document.getElementById('login-btn')
    const msg = document.getElementById('login-msg')
    btn.disabled = true
    btn.textContent = 'Versturen...'
    const { error } = await signInWithMagicLink(email)
    msg.classList.remove('hidden')
    if (error) {
      msg.className = 'mt-3 text-sm text-center text-red-600'
      msg.textContent = error.message
    } else {
      msg.className = 'mt-3 text-sm text-center text-quinta-600'
      msg.textContent = 'Check je e-mail voor de login-link!'
    }
    btn.disabled = false
    btn.textContent = 'Stuur login-link'
  })
}

// ----------------------------------------------------------------
// Dashboard
// ----------------------------------------------------------------
function renderDashboard() {
  return `
    <div class="min-h-screen">
      ${renderNav()}
      <main class="max-w-6xl mx-auto px-4 py-6">
        ${state.error ? `<div class="bg-red-50 text-red-700 p-3 rounded-lg mb-4">${state.error}</div>` : ''}
        ${state.view === 'faqs' ? renderFaqView() : ''}
        ${state.view === 'pending' ? renderPendingView() : ''}
        ${state.view === 'stats' ? renderStatsView() : ''}
      </main>
    </div>
    ${state.editingFaq !== null ? renderFaqModal() : ''}`
}

function renderNav() {
  const pendingBadge = state.pending.length > 0
    ? `<span class="ml-1 bg-red-500 text-white text-xs rounded-full px-2 py-0.5">${state.pending.length}</span>`
    : ''
  return `
    <nav class="bg-white shadow-sm border-b">
      <div class="max-w-6xl mx-auto px-4">
        <div class="flex items-center justify-between h-14">
          <div class="flex items-center gap-6">
            <span class="font-bold text-quinta-800">Quinta Valbom</span>
            <div class="flex gap-1">
              <button data-nav="faqs" class="px-3 py-1.5 rounded-lg text-sm font-medium transition ${state.view === 'faqs' ? 'bg-quinta-100 text-quinta-700' : 'text-gray-600 hover:bg-gray-100'}">
                FAQs
              </button>
              <button data-nav="pending" class="px-3 py-1.5 rounded-lg text-sm font-medium transition ${state.view === 'pending' ? 'bg-quinta-100 text-quinta-700' : 'text-gray-600 hover:bg-gray-100'}">
                Openstaand${pendingBadge}
              </button>
              <button data-nav="stats" class="px-3 py-1.5 rounded-lg text-sm font-medium transition ${state.view === 'stats' ? 'bg-quinta-100 text-quinta-700' : 'text-gray-600 hover:bg-gray-100'}">
                Statistieken
              </button>
            </div>
          </div>
          <button id="logout-btn" class="text-sm text-gray-500 hover:text-gray-700">Uitloggen</button>
        </div>
      </div>
    </nav>`
}

// ----------------------------------------------------------------
// FAQ View
// ----------------------------------------------------------------
function renderFaqView() {
  const filtered = state.faqs.filter((f) => {
    if (f.status !== 'active') return false
    if (state.filterCategory && f.category !== state.filterCategory) return false
    if (state.searchQuery) {
      const q = state.searchQuery.toLowerCase()
      return f.question.toLowerCase().includes(q) || f.answer.toLowerCase().includes(q)
    }
    return true
  })

  const grouped = {}
  for (const faq of filtered) {
    if (!grouped[faq.category]) grouped[faq.category] = []
    grouped[faq.category].push(faq)
  }

  return `
    <div class="flex items-center justify-between mb-4">
      <div class="flex gap-3 items-center flex-1">
        <input type="text" id="search-input" placeholder="Zoek in FAQs..."
          value="${state.searchQuery}"
          class="px-3 py-2 border border-gray-300 rounded-lg text-sm w-64 focus:ring-2 focus:ring-quinta-500 focus:border-quinta-500 outline-none">
        <select id="filter-category" class="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-quinta-500 outline-none">
          <option value="">Alle categorieen</option>
          ${state.categories.map((c) => `<option value="${c}" ${state.filterCategory === c ? 'selected' : ''}>${c}</option>`).join('')}
        </select>
      </div>
      <button id="add-faq-btn" class="bg-quinta-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-quinta-700 transition">
        + Nieuwe FAQ
      </button>
    </div>
    <div class="space-y-6">
      ${Object.entries(grouped).map(([category, faqs]) => `
        <div>
          <h3 class="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">${category} (${faqs.length})</h3>
          <div class="bg-white rounded-xl shadow-sm border divide-y">
            ${faqs.map((f) => `
              <div class="p-4 hover:bg-gray-50 transition">
                <div class="flex items-start justify-between gap-4">
                  <div class="flex-1 min-w-0">
                    <p class="font-medium text-gray-900">${escHtml(f.question)}</p>
                    <p class="text-sm text-gray-600 mt-1 line-clamp-2">${escHtml(f.answer)}</p>
                  </div>
                  <div class="flex gap-2 shrink-0">
                    <button data-edit="${f.id}" class="text-sm text-quinta-600 hover:text-quinta-800 font-medium">Bewerken</button>
                    <button data-delete="${f.id}" class="text-sm text-red-500 hover:text-red-700 font-medium">Verwijder</button>
                  </div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `).join('')}
      ${filtered.length === 0 ? '<p class="text-gray-500 text-center py-8">Geen FAQs gevonden.</p>' : ''}
    </div>`
}

// ----------------------------------------------------------------
// FAQ Modal (nieuw / bewerken)
// ----------------------------------------------------------------
function renderFaqModal() {
  const faq = state.editingFaq
  const isNew = !faq.id
  return `
    <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" id="modal-overlay">
      <div class="bg-white rounded-xl shadow-xl w-full max-w-lg fade-in">
        <div class="p-6">
          <h2 class="text-lg font-bold text-gray-900 mb-4">${isNew ? 'Nieuwe FAQ' : 'FAQ bewerken'}</h2>
          <form id="faq-form" class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Categorie</label>
              <select id="faq-category" required class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-quinta-500 outline-none">
                ${state.categories.map((c) => `<option value="${c}" ${faq.category === c ? 'selected' : ''}>${c}</option>`).join('')}
              </select>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Vraag</label>
              <input type="text" id="faq-question" required value="${escAttr(faq.question || '')}"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-quinta-500 outline-none">
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Antwoord</label>
              <textarea id="faq-answer" required rows="4"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-quinta-500 outline-none">${escHtml(faq.answer || '')}</textarea>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Context (optioneel, helpt de bot bij matching)</label>
              <input type="text" id="faq-context" value="${escAttr(faq.context || '')}"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-quinta-500 outline-none"
                placeholder="Bijv. 'openingstijden, bar, drinken'">
            </div>
            <div class="flex justify-end gap-3 pt-2">
              <button type="button" id="modal-cancel" class="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Annuleren</button>
              <button type="submit" class="bg-quinta-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-quinta-700 transition">
                ${isNew ? 'Toevoegen' : 'Opslaan'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>`
}

// ----------------------------------------------------------------
// Pending View
// ----------------------------------------------------------------
function renderPendingView() {
  if (state.pending.length === 0) {
    return `<div class="text-center py-12 text-gray-500">Geen openstaande vragen. De bot kon alles beantwoorden!</div>`
  }
  return `
    <h2 class="text-lg font-bold text-gray-900 mb-4">Openstaande vragen (${state.pending.length})</h2>
    <div class="bg-white rounded-xl shadow-sm border divide-y">
      ${state.pending.map((p) => `
        <div class="p-4">
          <div class="flex items-start justify-between gap-4">
            <div class="flex-1">
              <p class="font-medium text-gray-900">${escHtml(p.question)}</p>
              <div class="flex gap-3 mt-1 text-xs text-gray-400">
                <span>Taal: ${p.language || '?'}</span>
                <span>Laatst gevraagd: ${formatDate(p.last_asked)}</span>
                ${p.times_asked > 1 ? `<span class="text-orange-500 font-medium">${p.times_asked}x gevraagd</span>` : ''}
              </div>
            </div>
            <div class="flex gap-2 shrink-0">
              <button data-add-faq="${p.id}" data-question="${escAttr(p.question)}" data-language="${p.language || 'nl'}"
                class="text-sm bg-quinta-600 text-white px-3 py-1.5 rounded-lg hover:bg-quinta-700 transition font-medium">
                + Als FAQ
              </button>
              <button data-dismiss="${p.id}" class="text-sm text-gray-400 hover:text-gray-600 px-2 py-1.5">
                Negeren
              </button>
            </div>
          </div>
        </div>
      `).join('')}
    </div>`
}

// ----------------------------------------------------------------
// Stats View
// ----------------------------------------------------------------
function renderStatsView() {
  const s = state.stats || {}
  return `
    <h2 class="text-lg font-bold text-gray-900 mb-4">Statistieken</h2>
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
      ${statCard('FAQs actief', s.totalFaqs, 'text-quinta-600')}
      ${statCard('Openstaand', s.pendingCount, s.pendingCount > 0 ? 'text-orange-500' : 'text-gray-600')}
      ${statCard('Berichten totaal', s.totalConversations, 'text-blue-600')}
      ${statCard('Cache hits', s.cacheHits, 'text-purple-600')}
    </div>`
}

function statCard(label, value, colorClass) {
  return `
    <div class="bg-white rounded-xl shadow-sm border p-5">
      <p class="text-sm text-gray-500">${label}</p>
      <p class="text-3xl font-bold ${colorClass} mt-1">${value ?? '-'}</p>
    </div>`
}

// ----------------------------------------------------------------
// Event handlers
// ----------------------------------------------------------------
function attachDashboardHandlers() {
  // Navigation
  document.querySelectorAll('[data-nav]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.view = btn.dataset.nav
      render()
    })
  })

  // Logout
  document.getElementById('logout-btn')?.addEventListener('click', signOut)

  // Search + filter (debounced re-render to keep focus)
  document.getElementById('search-input')?.addEventListener('input', (e) => {
    state.searchQuery = e.target.value
    debouncedRender()
  })
  document.getElementById('filter-category')?.addEventListener('change', (e) => {
    state.filterCategory = e.target.value
    render()
  })

  // Add FAQ
  document.getElementById('add-faq-btn')?.addEventListener('click', () => {
    state.editingFaq = { category: state.categories[0] || '', question: '', answer: '', context: '' }
    render()
  })

  // Edit FAQ
  document.querySelectorAll('[data-edit]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const faq = state.faqs.find((f) => f.id === btn.dataset.edit)
      if (faq) {
        state.editingFaq = { ...faq }
        render()
      }
    })
  })

  // Delete FAQ
  document.querySelectorAll('[data-delete]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!confirm('Weet je zeker dat je deze FAQ wilt verwijderen?')) return
      try {
        await deleteFaq(btn.dataset.delete)
        await loadData()
        render()
      } catch (e) {
        alert('Fout: ' + e.message)
      }
    })
  })

  // Add pending as FAQ
  document.querySelectorAll('[data-add-faq]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.editingFaq = {
        category: state.categories[0] || '',
        question: btn.dataset.question,
        answer: '',
        context: '',
        _pendingId: btn.dataset.addFaq,
      }
      render()
    })
  })

  // Dismiss pending
  document.querySelectorAll('[data-dismiss]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      try {
        await dismissPending(btn.dataset.dismiss)
        await loadData()
        render()
      } catch (e) {
        alert('Fout: ' + e.message)
      }
    })
  })

  // Modal handlers
  document.getElementById('modal-overlay')?.addEventListener('click', (e) => {
    if (e.target.id === 'modal-overlay') { state.editingFaq = null; render() }
  })
  document.getElementById('modal-cancel')?.addEventListener('click', () => {
    state.editingFaq = null
    render()
  })
  document.getElementById('faq-form')?.addEventListener('submit', async (e) => {
    e.preventDefault()
    const data = {
      category: document.getElementById('faq-category').value,
      question: document.getElementById('faq-question').value,
      answer: document.getElementById('faq-answer').value,
      context: document.getElementById('faq-context').value || null,
    }
    try {
      if (state.editingFaq.id) {
        await updateFaq(state.editingFaq.id, data)
      } else {
        const newFaq = await createFaq(data)
        // Als het van een pending question kwam, markeer die als beantwoord
        if (state.editingFaq._pendingId) {
          await markPendingAnswered(state.editingFaq._pendingId, newFaq.id)
        }
      }
      state.editingFaq = null
      await loadData()
      render()
    } catch (e) {
      alert('Fout: ' + e.message)
    }
  })
}

// ----------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------
let renderTimer = null
function debouncedRender() {
  clearTimeout(renderTimer)
  renderTimer = setTimeout(() => {
    const focused = document.activeElement?.id
    render()
    if (focused) {
      const el = document.getElementById(focused)
      if (el) { el.focus(); el.selectionStart = el.selectionEnd = el.value.length }
    }
  }, 150)
}

function escHtml(str) {
  const div = document.createElement('div')
  div.textContent = str
  return div.innerHTML
}

function escAttr(str) {
  return str.replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

function formatDate(iso) {
  if (!iso) return '-'
  const d = new Date(iso)
  return d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

// ----------------------------------------------------------------
// Start
// ----------------------------------------------------------------
init()
