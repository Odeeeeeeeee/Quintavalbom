# Quinta Valbom Bot -- Handover document
**Datum:** 19 mei 2026
**Status:** Meta setup klaar, Supabase project aangemaakt (Thomas), webhook nog niet live

---

## 1. Wat er staat

### Codebase
Locatie: `/Users/odyblankendaal/Documents/Claude/Projects/whatsapp-bot/`

```
whatsapp-bot/
├── supabase/
│   ├── migrations/
│   │   ├── 20260503000001_initial_schema.sql   # DB schema
│   │   └── 20260503000002_cache_hit_rpc.sql    # RPC helper voor cache-hits
│   ├── functions/
│   │   └── whatsapp-webhook/
│   │       └── index.ts                         # Edge Function (v2: met conversatie-context, rate limiting, Claude taaldetectie)
│   ├── seed_faqs.sql                            # 29 FAQs
│   └── README.md                                # Deploy-gids
├── faq-chat.html                                # PoC chatbot (browser)
├── faq-admin.html                               # PoC admin-paneel
├── faq_data.json                                # FAQ-data (basis voor seed)
├── Quinta_Valbom_FAQs.xlsx                      # Originele FAQ-bron
├── META_SETUP.md                                # Meta/WhatsApp setup gids
├── PLAN.md                                      # Volledig product-plan
└── HANDOVER.md                                  # Dit bestand
```

### Wat al werkt (code, nog niet deployed)
- 29 FAQs in `seed_faqs.sql`
- Supabase DB-schema: `faqs`, `question_cache`, `pending_questions`, `conversations`, `settings`
- Edge Function `whatsapp-webhook/index.ts` met:
  - 3-laagse logica (cache -> Claude Haiku -> fallback)
  - Conversatie-context (vervolgvragen werken)
  - Claude-gestuurde taaldetectie (NL/EN/PT/DE/FR)
  - Rate limiting (max 10 berichten per 5 min per nummer)
  - Robuuste JSON parsing (markdown wrapping, code blocks)
  - Escalatie naar eigenaar bij onbeantwoorde vragen

### Meta setup (afgerond)
- Meta App "Quinta Valbom Bot" (App ID: `2124754085046410`)
- WhatsApp testnummer geactiveerd
- System User aangemaakt met permanent access token
- Testbericht "Hello World" ontvangen

### Supabase
- Project aangemaakt door Thomas
- Ody heeft toegang
- Schema en Edge Function nog niet deployed

---

## 2. Volgende stappen (in volgorde)

### Stap A: Supabase deployment
```bash
brew install supabase/tap/supabase
cd /Users/odyblankendaal/Documents/Claude/Projects/whatsapp-bot
supabase login
supabase link --project-ref <PROJECT_REF>
supabase db push
# Seed FAQs via dashboard SQL Editor: plak seed_faqs.sql
supabase secrets set WHATSAPP_VERIFY_TOKEN=quinta-valbom-bot-2026
supabase secrets set WHATSAPP_ACCESS_TOKEN=<TOKEN>
supabase secrets set WHATSAPP_PHONE_NUMBER_ID=<ID>
supabase secrets set ANTHROPIC_API_KEY=<KEY>
supabase functions deploy whatsapp-webhook --no-verify-jwt
```

### Stap B: Webhook koppelen in Meta App
1. developers.facebook.com -> Quinta Valbom Bot -> WhatsApp -> Configuration
2. Webhook -> Edit: Callback URL + verify token
3. Webhook fields -> messages aanvinken

### Stap C: End-to-end test
Stuur WhatsApp-bericht naar testnummer, verwacht Claude-antwoord.

### Stap D: Business Verificatie (parallel, 1-3 dagen)
Voor productie-nummer. Documenten: NIPC, factuur, ID.

---

## 3. Credentials

| Wat | Status |
|---|---|
| Meta App ID | `2124754085046410` |
| Permanent Meta access token | Aangemaakt, veilig opgeslagen |
| WhatsApp Phone Number ID | Ophalen uit Meta App |
| Supabase Project REF | Ophalen uit Supabase dashboard |
| Anthropic API Key | Aangemaakt |
| Verify token | `quinta-valbom-bot-2026` |

---

## 4. Architectuur

```
Gast (WhatsApp)
    |
Meta WhatsApp Cloud API (v21.0)
    |
Supabase Edge Function (whatsapp-webhook/index.ts)
    | stap 1: rate-limit check
    | stap 2: question_cache (exacte match, skip bij korte berichten)
    | stap 3: Claude Haiku 4.5 + faqs + conversatie-historie
    | stap 4: fallback + pending_questions (escalatie)
    |
Antwoord terug via WhatsApp API
```
