# Quinta Valbom — Plan productie-versie

**Auteur:** Ody (Dot Horizon) · **Datum:** 3 mei 2026
**Status:** Planning · **Versie:** 0.1

---

## 1. Wat we hier maken

Een AI-gedreven assistent voor camping Quinta Valbom (Moniek & Thomas) die klanten helpt en operationele taken voor de eigenaren automatiseert. Werkt via **WhatsApp** en **e-mail** als primaire kanalen, met een web-dashboard voor de eigenaren.

**Vier hoofdfunkties:**

1. **FAQ beantwoorden** — al gebouwd in proof-of-concept. Beantwoordt vragen over openingstijden, faciliteiten, regels, etc. via Claude AI met een 3-laags lookup (cache → AI → lokaal fallback).
2. **E-mail beantwoorden** — leest binnenkomende mail, beantwoordt standaardvragen automatisch in de juiste taal, escaleert lastige naar de eigenaar.
3. **Brood-bestellingen** — gast appt "2 stokbroden voor morgen", bot bevestigt, voegt toe aan dagelijkse bestellijst, mailt 's avonds totaal naar bakker.
4. **Activiteit-reserveringen** — gast vraagt om wijnproeverij/jeep tour/yoga, bot checkt beschikbaarheid in agenda, boekt, stuurt bevestiging.

**Doelgroep:** familie-camping in Portugal met Nederlands/Engels/Duits/Frans/Portugees sprekende gasten. Volume: schatting 20-50 berichten per dag in hoogseizoen.

---

## 2. Architectuur

```
┌────────────────┐    ┌──────────────────┐    ┌──────────────────┐
│ Gast (klant)   │    │ Moniek & Thomas  │    │ Bakker / partners │
│ • WhatsApp     │    │ • Web-dashboard  │    │ • E-mail          │
│ • E-mail       │    │ • Notificaties   │    │                  │
└───────┬────────┘    └────────┬─────────┘    └────────▲─────────┘
        │                      │                        │
        │ in/uit                │ login                  │ uitgaande mail
        ▼                      ▼                        │
┌─────────────────────────────────────────────────────────┴────────┐
│                   SUPABASE (cloud backend)                        │
│                                                                   │
│  ┌──────────────────────┐    ┌────────────────────────────────┐ │
│  │  Edge Functions       │◄──►│   PostgreSQL database          │ │
│  │  (TypeScript)         │    │   • FAQs                       │ │
│  │  • whatsapp-webhook   │    │   • Cache van geleerde vragen  │ │
│  │  • email-webhook      │    │   • Brood-bestellingen         │ │
│  │  • bread-handler      │    │   • Reserveringen + capaciteit │ │
│  │  • reservation-handler│    │   • Conversatie-historie       │ │
│  │  • daily-bread-mail   │    │   • Pending/escalations        │ │
│  │  • notify-owner       │    └────────────────────────────────┘ │
│  └──────────┬───────────┘                                         │
│             │ roept aan                                            │
│             ▼                                                      │
│  ┌──────────────────────────────────────────────────────────────┐│
│  │  Claude Haiku 4.5 (Anthropic API)                            ││
│  │  Met tools: lookup_faq, save_bread_order,                    ││
│  │             check_availability, create_reservation,          ││
│  │             escalate_to_owner, send_email                    ││
│  └──────────────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│  VERCEL (frontend hosting) — admin/dashboard pagina (Next.js)    │
└──────────────────────────────────────────────────────────────────┘
```

**Waarom deze opzet:**

- **Supabase** geeft database + serverless functies + auth in één pakket. Generous free tier (500MB DB, 5GB bandwidth) past ruim voor een camping. Makkelijk later op te schalen.
- **Vercel** voor het admin-dashboard. Gratis voor hobby-projecten, deploy via git push.
- **Claude Haiku 4.5** doet het denkwerk. Een vraag kost ~€0,001. Met tools (function calling) kan hij zelf acties uitvoeren — de "agent"-aanpak die je eerder noemde.
- **Geen computer thuis nodig.** Alles draait in de cloud, 24/7 bereikbaar.

---

## 3. Tech-stack overzicht

| Laag | Keuze | Waarom |
|---|---|---|
| Database | Supabase Postgres + pgvector | Relationeel, gratis tier, ondersteunt embeddings voor latere RAG |
| Backend | Supabase Edge Functions (Deno + TypeScript) | Serverless, schaalt automatisch, dichtbij database |
| AI | Claude Haiku 4.5 met tool-use | Snelste + goedkoopste Claude-model, ruim slim genoeg |
| Frontend (dashboard) | Next.js + Tailwind + shadcn/ui | Modern, snel, kleine learning curve |
| Auth (eigenaars) | Supabase Auth (email magic-link) | Geen wachtwoorden, veilig, simpel |
| WhatsApp | Meta WhatsApp Business Cloud API | Officieel, eerste 1000 service-gesprekken/maand gratis |
| E-mail (in) | IMAP via webhook (Postmark/CloudMailin) | Gratis tot ~10k mails/mnd |
| E-mail (uit) | Resend of Postmark | Gratis tot 3k mails/mnd, betere deliverability dan zelf SMTP |
| Versiebeheer | GitHub | Standaard |
| Deploy | Supabase CLI + Vercel CLI | Push naar git → live |

---

## 4. Functionele scope per module

### 4.1 FAQ-bot (al gebouwd, te migreren)

**Wat we al hebben:**
- 29 FAQs over Quinta Valbom
- Claude-prompt die natuurlijk antwoord geeft in de taal van de gast
- 3-laags cache (instant → AI → lokaal fallback)
- Admin-paneel om FAQs te beheren
- Pending-vragen-systeem voor escalatie

**Wat moet er bij migratie:**
- FAQs verhuizen van localStorage naar Supabase Postgres
- API-sleutel naar serverside (geen exposure meer in browser)
- WhatsApp i.p.v. webformulier als hoofdkanaal

### 4.2 E-mail beantwoorden

**Hoe werkt het:**
1. Mail komt binnen op `info@quintavalbom.nl` (of `bot@`)
2. Postmark/Mailgun stuurt webhook naar Supabase
3. Bot leest mail, gebruikt FAQ-systeem om relevante info te zoeken
4. Bot stelt antwoord op, slaat op als concept
5. **Configureerbaar:** ofwel direct sturen, of eerst Moniek/Thomas laten goedkeuren via dashboard
6. Onbeantwoorde/lastige mails blijven open in dashboard

**Belangrijke beslissing:** wel/niet automatisch versturen? Mijn advies: **eerst goedkeuringsmodus** voor 2-4 weken zodat eigenaars vertrouwen krijgen, dan auto-mode aanzetten voor categorieën waar het werkt.

### 4.3 Brood-bestellingen

**Workflow:**
1. Gast: "Mag ik 2 stokbroden voor morgen?"
2. Bot: "Tuurlijk! 2 stokbroden voor morgen (4 mei). Iets anders erbij — croissants, pain au chocolat?"
3. Gast: "Nee, dat is alles"
4. Bot: "Top! Genoteerd. Komt morgen om 8:30 bij de receptie 🥖"
5. Bot slaat op in `bread_orders` tabel met datum, gast (telefoon), items, status
6. Elke dag om 18:00 stuurt cronjob alle bestellingen voor de **volgende dag** als ge-mail naar de bakker
7. 's Ochtends ziet eigenaar in dashboard wie wat krijgt

**Te configureren door Moniek/Thomas:**
- Welke producten op de lijst (stokbrood, croissant, etc.) + prijzen
- Deadline voor bestellingen (bv. tot 18:00)
- E-mailadres bakker
- Annulerings-regels

### 4.4 Activiteit-reserveringen

**Workflow:**
1. Gast: "Is er deze week nog plek voor de wijnproeverij?"
2. Bot checkt agenda → "Ja, vrijdag 7 mei om 17:00 zijn nog 3 plekken vrij. Wil je reserveren?"
3. Gast: "Ja graag, voor 2 personen"
4. Bot: bevestigt, slaat reservering op, stuurt bevestiging
5. Reservering verschijnt in dashboard, en in een "vandaag/morgen"-overzicht voor eigenaars
6. Bij capaciteit-conflict: bot zegt "vol" en biedt alternatief
7. Annuleringen via WhatsApp ("ik annuleer mijn reservering voor vrijdag")

**Activiteiten initieel ondersteund** (te bevestigen met Moniek/Thomas):
- Wijnproeverij Santa Cristina / Villa Seara
- Jeep tour
- Wandeling Mondim de Basto (vast moment + capaciteit)
- Yoga bij het zwembad (indien aangeboden)
- Maaltijd-reservering (Bar/Restaurant)

---

## 5. Gefaseerd ontwikkelplan

> Geen haast = goed plan. Mijn advies: **1 fase tegelijk, met testperiode tussen fases**. Niet alles tegelijk live.

### Fase 0 — Setup & fundament (1-2 weken)

**Doel:** technische basis staat, niets functioneel nog
- Supabase project + Postgres schema
- GitHub repo + Vercel project
- Anthropic API account met budget-alert
- **WhatsApp Business API setup** (zie §7 voor de pijn)
- Domein voor webhooks (bv. `bot.quintavalbom.nl`)
- Basis dashboard met login

**Deliverable:** lege architectuur die werkt, bot zegt "hallo" terug op WhatsApp

### Fase 1 — FAQ via WhatsApp (1 week)

**Doel:** wat we al hebben, maar nu op WhatsApp + cloud
- FAQs migreren naar Postgres
- Cache-logica naar Edge Function
- Eerste echte gesprekken met testpersonen (vrienden, familie)

**Deliverable:** klanten kunnen vragen stellen via WhatsApp en krijgen antwoord

### Fase 2 — E-mail integratie (1-2 weken)

**Doel:** ook mailtjes worden opgepakt
- Mail-webhook ontvangen
- Antwoorden in concept opslaan
- Goedkeuringsmodus in dashboard
- Eigenaar krijgt push-notificatie bij nieuwe escalatie

**Deliverable:** Moniek/Thomas zien openstaande mails in dashboard, kunnen met 1 klik goedkeuren of aanpassen

### Fase 3 — Brood-bestellingen (1-2 weken)

**Doel:** eerste echte automatisering
- `bread_orders` tabel + tools voor Claude
- Conversatie-flow ("hoeveel? voor wanneer? wil je nog wat?")
- Dagelijkse mail naar bakker (cron)
- Dashboard-overzicht "vandaag op te halen"

**Deliverable:** gast bestelt brood via WhatsApp, eigenaar hoeft niks te doen

### Fase 4 — Activiteit-reserveringen (2-3 weken)

**Doel:** capaciteit-management
- `activities` + `reservations` tabellen
- Agenda-integratie (Google Calendar voor de eigenaars?)
- Capaciteit-checking
- Annuleringen
- Reminder-mails dag van tevoren

**Deliverable:** boekingsfunctionaliteit zonder tussenkomst

### Fase 5 — Polish & uitbreiden (doorlopend)

- Meertalig sterker maken (Portugees-gasten test-groep)
- Spraakberichten transcriberen (Whisper) — gasten sturen vaak voicenotes
- Foto's van check-in formulier scannen (vision API)
- Maandelijkse rapportages in mail
- Kostenbewaking & alerts

---

## 6. Kosten-overzicht (per maand, schatting hoogseizoen)

| Dienst | Free tier | Verwacht gebruik | Kosten |
|---|---|---|---|
| Supabase | 500MB DB, 5GB bandwidth, 50k MAU | Ruim binnen | **€0** |
| Vercel | 100GB bandwidth, hobby projects | Ruim binnen | **€0** |
| Claude Haiku 4.5 | Geen | ~1500 berichten × ~€0,001 | **~€2** |
| WhatsApp Business API | 1000 service-conversaties/mnd | Pieken juli/aug ~1500 | **~€3** (eerste 1000 gratis, daarna ~$0,005/conversatie) |
| Resend (mail uit) | 3000 mails/mnd, 100/dag | ~500/mnd | **€0** |
| Postmark inbound (mail in) | 100/mnd inbound | Mogelijk overschrijden → €10/mnd vanaf 10k | **€0-10** |
| Domein (`bot.quintavalbom.nl`) | n.v.t. | gebruikt bestaand | **€0** |
| **Totaal** | | | **€5-15/mnd** ✅ binnen budget |

**Eenmalig:**
- Tijd voor Meta Business verificatie (gratis, 1-2 weken doorlooptijd)
- Eventueel een tweede telefoonnummer voor WhatsApp Business als hij zijn persoonlijke nummer wil scheiden (€10-15 per mnd voor SIM)

---

## 7. ⚠️ Het Meta/Facebook Developer struikelblok

Je gaf al aan dat dit niet wil. Erkend probleem — het is voor iedereen lastig. Stappenplan:

### 7.1 Wat je nodig hebt (in deze volgorde)

1. **Meta-account** (= Facebook persoonlijk account). Niet je hele leven hoeft daarop, maar je moet er wel ingelogd zijn.
2. **Meta Business Manager** (`business.facebook.com`) — apart van je persoonlijke profiel. Hier komt "Quinta Valbom" als bedrijf in te staan.
3. **Meta Business Verificatie** — bewijs dat Quinta Valbom een echt bedrijf is. Gevraagd: bedrijfsnaam, adres, KvK-/BTW-nummer (Portugese variant: NIPC), website. Doorlooptijd 1-3 dagen.
4. **WhatsApp Business Account** in Business Manager.
5. **Meta App** (`developers.facebook.com`) — registreer een "App" met type "Business". Aan deze app koppel je WhatsApp.
6. **Telefoonnummer** voor de bot — kan een tweede SIM zijn, of een VoIP-nummer (Twilio Voice nummer kost ~€1/mnd). **Belangrijk:** dit nummer mag niet ergens anders al WhatsApp draaien (ook niet WhatsApp Business app op telefoon — dat moet uitgezet en uit Meta verwijderd).
7. **Permanent access token** voor de WhatsApp API (System User in Business Manager).

### 7.2 Tips uit de praktijk

- **Begin met je vriend's bestaande nummer NIET** — gebruik een nieuw nummer specifiek voor de bot. Anders raak je zijn persoonlijke WhatsApp kwijt.
- **Verificatie-documenten klaar hebben** voordat je begint: KvK-uittreksel of Portugese equivalent, factuur op bedrijfsnaam, foto van paspoort van de wettelijk vertegenwoordiger.
- **De Meta UI verandert constant.** Stap-voor-stap tutorials zijn vaak verouderd. Vertrouw op de officiële [WhatsApp Cloud API docs](https://developers.facebook.com/docs/whatsapp/cloud-api/get-started) als ankerpunt.
- **Test eerst met de "test-nummer"** dat Meta gratis biedt — je kunt 5 telefoonnummers whitelisten en gratis berichten naar/van versturen zonder verificatie. Perfect voor ontwikkeling.
- **Vraag wanneer je vastzit** — ik kan helpen met de stap waar je precies blijft hangen, scherm-screenshot of foutmelding delen werkt het snelst.

### 7.3 Alternatief als Meta echt niet lukt

- **Twilio WhatsApp** — eenvoudiger setup, bruggetje over de Meta API. Kosten ~€0,005/bericht extra. Geen Meta Business verificatie nodig voor sandbox-testen, wel voor productie.
- **360dialog** — populaire Europese herverkoper van WhatsApp Business API. Helpen bij setup, ~€20/mnd vast. Werkt vaak waar Meta zelf vastloopt.

Mijn advies: **eerst nog 1× rustig de Meta-route proberen** met een goede checklist. Als dat na 2 sessies niet lukt, switchen naar 360dialog en die €20 is dan goed besteed.

---

## 8. Risico's & afhankelijkheden

| Risico | Kans | Impact | Mitigatie |
|---|---|---|---|
| Meta WhatsApp Business approval lukt niet | middel | hoog | Twilio of 360dialog als plan B (zie §7.3) |
| Claude API limieten / kosten lopen op | laag | middel | Budget-alert in Anthropic console; cache-laag drukt kosten |
| Brood-bestellingen worden gemist (bot down) | middel | middel | Monitoring + alerting (Supabase logs + email); WhatsApp opslaat berichten 30 dagen |
| Privacy: telefoonnummers van gasten | hoog | middel | Alleen opslaan wat nodig is; nummers anonimiseren in logs; AVG-compliance |
| Eigenaars willen iets handmatig doen maar bot heeft het al gedaan | middel | laag | Goedkeuringsmodus in dashboard; snooze-knop "ik regel dit zelf" |
| Spam / misbruik via WhatsApp | laag | laag | Rate-limiting per nummer; auto-block na 10 onzin-berichten |
| Bakker krijgt mail niet | laag | middel | Read-receipts; failover naar SMS naar bakker als geen reactie binnen 30min |

---

## 9. Privacy & juridische punten

- **AVG**: opslaan van telefoonnummers + berichten is persoonlijke data. Privacystatement nodig (voorbeeld kan ik aanleveren), bewaartermijn 12 maanden, recht op verwijdering.
- **WhatsApp Business policy**: geen marketingberichten zonder opt-in. Antwoorden binnen 24u na binnenkomende vraag is gratis; daarna template-berichten met kosten.
- **Meta Terms**: bot moet een persoonlijk telefoonnummer hebben, geen alias.
- **Eigenaarschap data**: contractueel vastleggen wie data bezit (jij als ontwikkelaar of de camping). Mijn advies: alle data is van de camping, jij hebt geen eigenaarschap.

---

## 10. Volgende stappen (concreet, deze week)

1. **Beslissen:** akkoord op deze opzet of bijstellen
2. **Account-setup:**
   - [ ] Anthropic API account met budget-cap (jij — al gedaan ✓)
   - [ ] Supabase project aanmaken (jij)
   - [ ] GitHub repo aanmaken (jij)
   - [ ] Domein-record `bot.quintavalbom.nl` (Moniek/Thomas)
3. **WhatsApp Business setup** — zet een sessie in met je vriend, doorloop §7 stappen samen. Alle benodigde docs van te voren verzamelen.
4. **Volgende sessie met mij:** ik bouw de Postgres-schema + Edge Function skeleton, jij/wij doen de Meta-flow.

---

## 11. Wat we NIET doen (bewust)

- Geen telefonisch antwoorden (te complex, te duur)
- Geen Instagram/Facebook DM in fase 1 (kan later via dezelfde Meta-stack)
- Geen betalingen via de bot (betalingsverwerker = compliance-zwaar; bar is sowieso cash-only)
- Geen volledig autonome operations zonder oversight — eigenaars zien altijd wat de bot doet via dashboard
- Geen eigen mobiele app (web-dashboard is voldoende)

---

## 12. Open vragen voor Moniek & Thomas

Punten om met je vriend te bespreken voordat we bouwen:

- Welk telefoonnummer wordt het bot-nummer? (Bestaand of nieuw?)
- Hebben ze al een Google Workspace / Microsoft 365 voor mail? (i.v.m. e-mail integratie)
- Wat zijn de exacte activiteiten met capaciteit + tijden?
- Hoe heet hun bakker en hoe ontvangt die nu de bestellingen?
- Hoeveel uur per dag mag de bot sturen — ook 's nachts antwoorden of stiltetijd 22:00-08:00?
- Welke beslissingen wil hij zelf nemen (en niet door bot laten doen)?

---

*Volgende stap: laat me weten wat je van dit plan vindt — wat scherper, wat anders, wat eruit. Daarna kunnen we per fase aan de slag.*
