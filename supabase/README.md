# Supabase backend — deploy gids

Deze map bevat alles om de Quinta Valbom FAQ bot op Supabase te draaien.

```
supabase/
├── migrations/
│   ├── 20260503000001_initial_schema.sql   # Tabellen, indexes, RLS
│   └── 20260503000002_cache_hit_rpc.sql    # Helper RPC voor cache-hits
├── seed_faqs.sql                            # 29 FAQs van Quinta Valbom
├── functions/
│   └── whatsapp-webhook/
│       └── index.ts                         # Edge Function: WhatsApp ↔ Claude
└── README.md
```

---

## Eenmalige setup (15 min)

### 1. Supabase CLI installeren

```bash
# macOS
brew install supabase/tap/supabase

# Verifieer
supabase --version
```

### 2. Inloggen + linken aan jouw project

```bash
cd /Users/odyblankendaal/whatsapp-faq-bot/whatsapp-bot
supabase login
supabase link --project-ref <JOUW_PROJECT_REF>
```

(`<JOUW_PROJECT_REF>` vind je in dashboard → Project Settings → General → "Reference ID".)

### 3. Migraties draaien

```bash
supabase db push
```

Dit voert beide `migrations/*.sql` uit. Verifieer in Supabase dashboard → Table Editor dat `faqs`, `question_cache`, `pending_questions`, `conversations`, `settings` bestaan.

### 4. FAQs importeren (seed)

In Supabase dashboard → SQL Editor → plak de inhoud van `seed_faqs.sql` → Run.

(Of via psql als je dat wil:
```bash
psql "postgresql://postgres.<PROJECT>:<DB_PASSWORD>@aws-0-eu-central-1.pooler.supabase.com:5432/postgres" -f seed_faqs.sql
```)

### 5. Secrets instellen

```bash
supabase secrets set WHATSAPP_VERIFY_TOKEN=quinta-valbom-bot-2026
supabase secrets set WHATSAPP_ACCESS_TOKEN=<JOUW_PERMANENT_META_TOKEN>
supabase secrets set WHATSAPP_PHONE_NUMBER_ID=<JOUW_TEST_NUMBER_ID>
supabase secrets set ANTHROPIC_API_KEY=<JOUW_CLAUDE_KEY>
```

> Het `WHATSAPP_VERIFY_TOKEN` mag je vrij kiezen — moet matchen met wat je later in de Meta App webhook-config invoert.

### 6. Edge Function deployen

```bash
supabase functions deploy whatsapp-webhook --no-verify-jwt
```

> `--no-verify-jwt` is cruciaal: Meta stuurt geen Supabase JWT mee, dus de webhook moet publiek bereikbaar zijn.

Na deploy print Supabase de URL — bv:
```
https://<PROJECT_REF>.supabase.co/functions/v1/whatsapp-webhook
```

**Bewaar deze URL** — die hebben we nodig in de Meta App webhook-config.

---

## Test of alles werkt

### Test 1: Database schema

In Supabase dashboard → SQL Editor:
```sql
select count(*) from faqs;  -- moet 29 zijn
select * from settings;     -- moet 5 rijen tonen
```

### Test 2: Webhook bereikbaarheid

```bash
curl 'https://<PROJECT_REF>.supabase.co/functions/v1/whatsapp-webhook?hub.mode=subscribe&hub.verify_token=quinta-valbom-bot-2026&hub.challenge=12345'
```
→ moet `12345` terugretoureren (statuscode 200).

Als je `Forbidden` krijgt: `WHATSAPP_VERIFY_TOKEN` matcht niet.

### Test 3: Volledige flow simuleren

```bash
curl -X POST 'https://<PROJECT_REF>.supabase.co/functions/v1/whatsapp-webhook' \
  -H 'Content-Type: application/json' \
  -d '{
    "entry": [{
      "changes": [{
        "value": {
          "messages": [{
            "from": "31612345678",
            "type": "text",
            "text": { "body": "Tot hoe laat is het zwembad open?" }
          }]
        }
      }]
    }]
  }'
```

Resultaat:
- Edge Function logt de vraag (zie Logs in Supabase dashboard)
- Probeert WhatsApp-bericht te sturen naar `31612345678`
- Schrijft naar `conversations` tabel

> Als je het echte testnummer in `from` zet, krijg je het antwoord daadwerkelijk binnen.

---

## Meta App: webhook configureren

Pas nadat alle secrets staan en de function deployed is.

1. Ga naar **developers.facebook.com** → jouw `Quinta Valbom Chatbot` app
2. Linkerkolom → **WhatsApp** → **Configuration**
3. Bij **Webhook** → klik **"Edit"**:
   - **Callback URL:** `https://<PROJECT_REF>.supabase.co/functions/v1/whatsapp-webhook`
   - **Verify token:** `quinta-valbom-bot-2026` (of wat je in stap 5 hierboven hebt gezet)
4. Klik **"Verify and save"** — Meta stuurt een GET-request, die moet succes geven (groene check)
5. Onder **"Webhook fields"** → klik **"Manage"** → vink aan: **`messages`**
6. Klaar. Stuur een bericht vanuit een whitelisted nummer naar het Meta-test-nummer.

---

## Logs bekijken

```bash
supabase functions logs whatsapp-webhook --tail
```

Of in dashboard → Edge Functions → whatsapp-webhook → Logs.

Voor conversaties:
```sql
select created_at, sender_phone, direction, answer_source, message_text
from conversations
order by created_at desc
limit 20;
```

---

## Volgende stappen

- [ ] Admin-dashboard (Next.js op Vercel) bouwen voor het beheren van FAQs en zien van pending vragen
- [ ] Owner-notificaties: pending question → SMS/WhatsApp/email naar Moniek of Thomas
- [ ] Web-widget die dezelfde Edge Function aanroept (zelfde brein, ander kanaal)
- [ ] Productie-nummer i.p.v. Meta-test-nummer (zodra Business Verificatie klaar is)
