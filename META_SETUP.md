# Meta Business Manager + WhatsApp Cloud API — setup gids

Deze gids leidt je stap voor stap door de **Meta-setup** zodat we je FAQ-bot via WhatsApp kunnen laten werken. Doel voor deze fase: een werkend **Meta test-nummer** waarmee je naar 5 whitelisted contacten (waaronder jezelf) WhatsApp-berichten kunt sturen.

**Verwachte tijd:** 30-60 minuten actieve klikken + 1-3 dagen wachten op verificatie (kan parallel met testen).

**Stuur me de foutmelding of screenshot zodra je vastzit op een stap.**

---

## Voorbereiding (5 min)

Verzamel **vóór je begint**:

- [ ] Persoonlijk Meta/Facebook-account — log in met de browser waarin je de stappen doet
- [ ] Werk-email die je niet voor je persoonlijke FB gebruikt (bv. `ody@dothorizon.nl`)
- [ ] Bedrijfsgegevens Quinta Valbom: officiële naam, adres in Portugal, NIPC (Portugees BTW-nummer), website-URL
- [ ] **Niet nodig nu:** een echt telefoonnummer voor de bot — we gebruiken Meta's test-nummer

---

## Stap 1: Meta Business Manager aanmaken (10 min)

1. Ga naar **https://business.facebook.com**
2. Klik **"Een account maken"** (rechtsboven)
3. Vul in:
   - **Bedrijfsnaam:** `Quinta Valbom` (of `Quinta Valbom Camping`)
   - **Jouw naam:** Ody Blankendaal
   - **Werkmail:** `ody@dothorizon.nl`
4. Klik **"Verzenden"**
5. Bevestig het verificatie-mailtje in je inbox
6. Je komt op het Business Manager dashboard

**Resultaat:** je bent nu admin van een Business Manager voor Quinta Valbom.

> 🐛 **Veelvoorkomend probleem:** soms zegt Meta "We hebben je account beperkt voor controle". Geen paniek — vul de gevraagde info in en wacht max 24u. Vaak is het binnen een uur opgelost.

---

## Stap 2: Bedrijfsgegevens invullen (5 min)

1. In Business Manager → linkerkolom → **Instellingen** (tandwiel-icoon)
2. **Bedrijfsgegevens** → vul aan:
   - Wettelijke bedrijfsnaam (zoals op KvK/NIPC papier)
   - Adres
   - Telefoon (mag persoonlijk nummer voor nu)
   - Website: https://www.quintavalbom.nl
3. Sla op

> Dit is **nog geen Business Verificatie** — die doen we later. Dit zijn alleen de basisgegevens.

---

## Stap 3: WhatsApp Business Account aanmaken (5 min)

1. In Business Manager → linkerkolom → **Accounts** → **WhatsApp-accounts**
2. Klik **"Toevoegen"** → **"Een WhatsApp Business Account maken"**
3. Vul in:
   - **WhatsApp Business Account naam:** `Quinta Valbom Bot` (interne naam, niet zichtbaar voor gasten)
   - **Tijdzone:** Europa/Lissabon
   - **Valuta:** EUR
4. Klik **"Maken"**

**Resultaat:** een lege WhatsApp Business Account, klaar om er een telefoonnummer aan te koppelen.

---

## Stap 4: Meta App aanmaken (Developer-deel) (10 min)

> Dit is waar de meeste mensen verdwalen. Het is een **andere site** dan Business Manager. Verwarrend, maar ze hangen wel samen.

1. Ga naar **https://developers.facebook.com**
2. Klik **"Mijn apps"** (rechtsboven) → **"Een app maken"**
3. Vraagt om type: kies **"Bedrijf"** (Business). NIET "Consumer" of "Gaming".
4. Vul in:
   - **App-naam:** `Quinta Valbom Chatbot`
   - **App-contact-email:** `ody@dothorizon.nl`
   - **Bedrijfs-portfolio:** kies hier `Quinta Valbom` (de Business Manager die je in stap 1 maakte — die zou hier in de dropdown moeten staan)
5. Klik **"App maken"** + voer eventueel je wachtwoord opnieuw in
6. Je komt op het **App Dashboard**

**Resultaat:** een Meta App, klaar om er producten (zoals WhatsApp) aan toe te voegen.

> 🐛 **Veelvoorkomend probleem:** "Ik zie geen 'Bedrijfs-portfolio' optie bij stap 4." → dat betekent dat je Business Manager nog niet gekoppeld is aan je developer-account. Ga terug naar Business Manager → Instellingen → Gebruikers → System Users → check dat je eigen account daar admin is.

---

## Stap 5: WhatsApp koppelen aan de App (5 min)

1. In het App Dashboard zie je **"Voeg producten toe"** (of vergelijkbaar)
2. Zoek **"WhatsApp"** in de lijst → klik **"Set up"**
3. Het vraagt: "Aan welke WhatsApp Business Account wil je dit koppelen?" → kies de account uit Stap 3 (`Quinta Valbom Bot`)
4. Klik **"Continue"**

**Resultaat:** WhatsApp staat nu in de linkerkolom van je App Dashboard onder "Producten".

---

## Stap 6: Test-nummer activeren (5 min)

1. In het App Dashboard → linkerkolom → **WhatsApp** → **API Setup**
2. Bovenin zie je een dropdown: **"From"** → daaronder staat een **test-nummer** dat Meta gratis ter beschikking stelt (begint meestal met `+1 555...`)
3. Onderin: **"To"** → klik **"Manage phone number list"** of **"Add recipient"**
4. Voeg jouw eigen WhatsApp nummer toe (`+31 6 ...`)
5. Bevestig de SMS/WhatsApp-code die Meta naar dat nummer stuurt
6. Je kunt tot **5 nummers** whitelisten — voeg ook je vriend (Moniek of Thomas) toe als je wil meetesten

**Resultaat:** Meta's test-nummer kan nu berichten naar jouw WhatsApp sturen (en jouw nummer kan terug-berichten).

---

## Stap 7: Eerste test-bericht versturen (2 min)

In dezelfde **API Setup** pagina staat een voorbeeld-curl-commando rechts (of een knop "Send message").

Klik **"Send message"** of voer dit in een terminal uit:

```bash
curl -X POST 'https://graph.facebook.com/v21.0/<PHONE_NUMBER_ID>/messages' \
  -H 'Authorization: Bearer <TIJDELIJKE_TOKEN>' \
  -H 'Content-Type: application/json' \
  -d '{
    "messaging_product": "whatsapp",
    "to": "<JOUW_NUMMER_MET_LANDCODE>",
    "type": "template",
    "template": { "name": "hello_world", "language": { "code": "en_US" } }
  }'
```

(De waardes tussen `<>` staan in dezelfde pagina. Het tijdelijke token is **24 uur geldig** — perfect voor een eerste test, daarna maken we een permanent token.)

✅ **Als je een "Hello World" WhatsApp-bericht ontvangt: gefeliciteerd, het zwaarste deel is achter de rug.**

---

## Stap 8: Permanent access token maken (10 min)

> Het 24-uurs token is voor testen. Voor productie hebben we een token dat niet vervalt.

1. Ga naar **business.facebook.com** → **Instellingen** → **Gebruikers** → **System Users**
2. Klik **"Toevoegen"** → maak een System User:
   - **Naam:** `quinta-bot-system-user`
   - **Rol:** Admin
3. Klik op de nieuwe System User → **"Add Assets"** → kies **"Apps"** → vink je `Quinta Valbom Chatbot` aan → geef **Manage** rechten
4. Klik daarna **"Generate New Token"** voor deze System User
5. Kies de Quinta Valbom Chatbot app
6. **Permissions** vinkjes: `whatsapp_business_messaging`, `whatsapp_business_management`
7. Klik **"Generate Token"**
8. **KOPIEER EN BEWAAR DIRECT** — Meta toont 'm maar één keer. Sla op in een veilige plek (1Password, secrets manager).

**Stuur me dit token NIET in chat.** We zetten 'm later in een Supabase secret. Het is de "sleutel tot je hele WhatsApp account" — net zo gevoelig als een wachtwoord.

---

## Stap 9 (optioneel, parallel): Business Verificatie starten (5 min activ + 1-3 dagen wacht)

Voor het Meta-test-nummer **niet nodig**. Wel nodig zodra je een echt productie-nummer wil koppelen en uit "test mode" wil.

1. Business Manager → **Instellingen** → **Bedrijfsverificatie**
2. Upload bedrijfsdocumenten:
   - KvK-uittreksel (of Portugees equivalent uit de NIPC)
   - Factuur op bedrijfsnaam (max 90 dagen oud)
   - Mogelijk: ID van wettelijk vertegenwoordiger
3. Verzenden → wachten op email-bevestiging (1-3 werkdagen, soms langer)

> Begin hier ZEKER mee, want dit is het langste pad. Tegen de tijd dat we naar productie willen, is dit klaar.

---

## Wat heb je nu

Na alle stappen heb je:

✅ Meta Business Manager met Quinta Valbom als bedrijf
✅ WhatsApp Business Account
✅ Meta App met WhatsApp-product gekoppeld
✅ Test-nummer dat naar jou (en max 4 anderen) berichten kan sturen
✅ Permanent access token (veilig opgeslagen)
✅ Business Verificatie loopt op de achtergrond

**Wat je me moet doorgeven** (zodra ik klaar ben met de backend):

- **WhatsApp Phone Number ID** (te vinden in App Dashboard → WhatsApp → API Setup → "From")
- **WhatsApp Business Account ID** (zelfde pagina)
- **Permanent access token** — niet via chat, maar in een Supabase secret die jij invoert

---

## Veelgemaakte fouten

| Probleem | Oplossing |
|---|---|
| "Token expired" na een paar uur | Tijdelijke token is 24h. Maak System User token (stap 8). |
| "Permissions error" bij curl-test | Check dat het token de juiste permissions heeft (`whatsapp_business_messaging`). |
| "Invalid phone number" bij `to:` | Telefoonnummer moet in internationaal formaat zonder `+` of spaties: `31612345678` (NIET `+31 6 12345678`). |
| Test-nummer berichten komen niet aan | Bevestig nogmaals het ontvangende nummer in de "Manage phone number list". |
| App heeft geen "Quinta Valbom" als portfolio-optie | Business Manager nog niet gekoppeld aan je dev-account. Ga naar developers.facebook.com → My Apps → Settings → Linked Business Manager. |
| "We konden je account niet verifiëren" | Wacht 24u, probeer opnieuw. Soms moet je even contact opnemen via Meta Help Center. |

---

## Volgende stap

Zodra **stap 7** lukt (test-bericht ontvangt op je WhatsApp), laat me weten. Dan koppelen we de bot:

1. Mijn Edge Function URL invoeren in de Meta App webhooks-config
2. Webhook valideren
3. Eerste echte FAQ-vraag stellen via WhatsApp → Claude antwoordt 🎉

Vastlopen halverwege? **Stuur de foutmelding of screenshot.** Dan ploeteren we er samen doorheen.
