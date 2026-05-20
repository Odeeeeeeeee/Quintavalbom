-- ================================================================
-- Seed: importeer Quinta Valbom FAQs in faqs tabel
-- Run via: psql $DATABASE_URL -f seed_faqs.sql
--    of:  in Supabase dashboard SQL editor
-- ================================================================

-- Eerst categorieën
insert into categories (name, sort_order) values
    ('Eten & Drinken', 1),
    ('Zwemmen', 2),
    ('Parking & Auto''s', 3),
    ('Faciliteiten', 4),
    ('Afval', 5),
    ('Wassen', 6),
    ('Check-out & Transport', 7),
    ('Veiligheid & Richtlijnen', 8),
    ('Contact & Noodgevallen', 9),
    ('Wifi & Overig', 10),
    ('Over Quinta Valbom', 11),
    ('Tips & Activiteiten', 12)
on conflict (name) do nothing;

-- Dan FAQs
insert into faqs (legacy_id, category, question, answer, context, source) values
    (1, 'Eten & Drinken', 'Wat zijn de openingstijden van de bar?',
     'De bar is open van 8:30-11:30 uur voor drinken, koffie en verse broodjes. ''s Middags van 15:00-19:00 uur (16:00-19:00 laagseizoen) voor wijntjes, biertjes en ijsjes. Gesloten op zondag.',
     'Openingstijden bar, uren drinken, koffie, terras, wanneer open. Dit is over de bar faciliteiten, niet over receptie of camping.',
     'Brochure'),

    (2, 'Eten & Drinken', 'Kan ik mijn eigen drinken en eten meenemen naar de bar?',
     'Nee, je bent niet toegestaan je eigen drinken of eten te nuttigen bij de bar of op het terras.',
     'Bar regels, drinken, eten, meebrengen, picknick, terras. Gaat over bar faciliteiten en regels.',
     'Brochure'),

    (3, 'Eten & Drinken', 'Bieden jullie maaltijden aan?',
     'Ja, op bepaalde avonden bieden we gezonde maaltijden aan. Het menu en moment worden op de receptie/bar aangegeven. Je moet je aanmelden en voortijds reserveren omdat er beperkt plaats is.',
     'Eten, maaltijden, diner, restaurantservice, reservering. Bar en eten faciliteiten.',
     'Brochure'),

    (4, 'Zwemmen', 'Wat zijn de openingstijden van het zwembad?',
     'Het zwembad is iedere dag open van 9:00 tot 19:00 uur.',
     'Dit gaat over de zwembad faciliteiten, hoe laat je kunt zwemmen, baden, waterpret. Niet over uitchecken of campinguren.',
     'Brochure'),

    (5, 'Zwemmen', 'Wat zijn de regels voor het zwembad?',
     'Gebruik op eigen risico. Kinderen moeten onder begeleiding zijn. Geen glas meenemen naar het zwembad.',
     'Zwembadregels, veiligheid water, kinderen baden, glasregels. Over waterveiligheid en zwembad faciliteiten.',
     'Brochure'),

    (6, 'Parking & Auto''s', 'Mag ik met mijn auto naar mijn campingplaats rijden?',
     'Ja, voor het uit- en inladen mag je naar de campingplaats rijden. Daarna moet de auto op de parkeerplaats blijven staan.',
     'Auto, parkeren, rijden, camping plaats, voertuig, vervoer. Over parkeerregels en auto''s op camping.',
     'Brochure'),

    (7, 'Parking & Auto''s', 'Waar moet ik mijn auto parkeren?',
     'Na het uit- en inladen van je spullen moet de auto op de parkeerplaats blijven staan.',
     null, 'Brochure'),

    (8, 'Faciliteiten', 'Is het kraanwater drinkbaar?',
     'Ja, ons kraanwater is natuurlijk gezuiverd en drinkbaar. Het komt uit onze waterbron.',
     null, 'Brochure'),

    (9, 'Faciliteiten', 'Hoe betaal ik aan de bar?',
     'Aan de bar is alleen contant betalen mogelijk. In het dorpje Gandarela de Basto is een pinautomaat.',
     null, 'Brochure'),

    (10, 'Faciliteiten', 'Hoe vaak wordt het toiletgebouw schoongemaakt?',
     'Het toiletgebouw wordt iedere dag schoongemaakt.',
     null, 'Brochure'),

    (11, 'Faciliteiten', 'Wat kan ik in het toilet doorspelen?',
     'Alleen wc papier kan in het toilet worden doorgespoeld. Andere zaken horen in de prullenbak.',
     null, 'Brochure'),

    (12, 'Afval', 'Hoe zit het met het chemisch afval van mijn toilet?',
     'Er is geen stort voor chemisch afval op de camping. Je afval kan je gescheiden kwijt in de vuilnisbakken op de parkeerplaats en langs de weg bij de ingang.',
     null, 'Brochure'),

    (13, 'Wassen', 'Kan ik mijn was doen?',
     'Ja, wassen kan op bepaalde momenten van de dag met wasmiddel dat bij ons te verkrijgen is. Schrijf je in bij de bar.',
     null, 'Brochure'),

    (14, 'Check-out & Transport', 'Tot hoe laat kan ik uitchecken?',
     'Uitchecken graag voor 11:00 uur.',
     'Vertrekken, accommodatie verlaten, inchecktijden, reserveringen. Dit is over camping accommodatie, niet over zwembad, bar of andere faciliteiten.',
     'Brochure'),

    (15, 'Check-out & Transport', 'Zijn er bussen in de buurt?',
     'Ja, er vertrekken bussen vanuit Gandarela de Basto naar kleine plaatsen en grote steden in de omgeving.',
     null, 'Brochure'),

    (16, 'Check-out & Transport', 'Hoe kan ik een taxi bellen?',
     'Je kunt lokale taxi Julio bereiken op +351 968 035 736.',
     null, 'Brochure'),

    (17, 'Veiligheid & Richtlijnen', 'Mag ik een bbq gebruiken?',
     'Nee, bbq is niet toegestaan op de camping vanwege brandgevaar.',
     null, 'Brochure'),

    (18, 'Veiligheid & Richtlijnen', 'Mag ik eten buiten laten staan?',
     'Nee, laat geen eten buiten staan.',
     null, 'Brochure'),

    (19, 'Veiligheid & Richtlijnen', 'Wat moet ik doen als ik bezoek krijg?',
     'Bezoek van buiten de camping? Graag even melden.',
     null, 'Brochure'),

    (20, 'Veiligheid & Richtlijnen', 'Wat zijn de rusttijden op de camping?',
     'Na 22:00 uur is het stil op de camping. Onze gasten stellen ontspanning & rust erg op prijs.',
     null, 'Brochure'),

    (21, 'Contact & Noodgevallen', 'Hoe kan ik de eigenaren bereiken?',
     'Telefoon/WhatsApp: +351910348399, E-mail: motho@quintavalbom.nl, Web: www.quintavalbom.nl',
     'Contact, eigenaren, telefoon, whatsapp, email, bereiken, informatie. Over hoe je de camping kunt contacteren.',
     'Brochure'),

    (22, 'Contact & Noodgevallen', 'Wat is het Europese alarmnummer?',
     'Het Europese alarmnummer is 112.',
     null, 'Brochure'),

    (23, 'Contact & Noodgevallen', 'Hoe bereik ik een ambulance?',
     'Ambulance Gandarela de Basto: +351 255 655 143',
     null, 'Brochure'),

    (24, 'Wifi & Overig', 'Wat is het Wifi-wachtwoord?',
     'Quinta Valbom Wifi: HappyHolidays!',
     null, 'Brochure'),

    (25, 'Wifi & Overig', 'Wat zijn de pauzetijden?',
     'Tussen 12:00 en 15:00 uur pauzeren we. Bij nood ben je bereikbaar via WhatsApp/SMS.',
     null, 'Brochure'),

    (26, 'Over Quinta Valbom', 'Wie zijn de eigenaren?',
     'Moniek en Thomas zijn de eigenaren van Quinta Valbom. Ze hebben de camping opgericht omdat ze op zoek waren naar meer vrijheid, verbinding, buitenleven en betekenis.',
     null, 'Brochure'),

    (27, 'Tips & Activiteiten', 'Wat zijn leuke dingen om in de buurt te doen?',
     'Er zijn veel activiteiten: wandelen naar Mondim de Basto, wijnproeverijen bij Santa Cristina of Villa Seara, Jeep tours, waterpark in Fafe of Amarante, Pena Aventura Park. Zie ook de kaart in de brochure voor meer tips.',
     null, 'Brochure'),

    (28, 'Tips & Activiteiten', 'Zijn er winkels in de omgeving?',
     'Ja, in Gandarela de Basto (5 min rijden) zijn supermarkt, groente- en fruitboer, bakkerij. In Cabeceiras de Basto (15 min) zijn grotere supermarkten als Continente en Intermarché.',
     null, 'Brochure'),

    (29, 'Tips & Activiteiten', 'Hoe kom ik aan informatie over fietsen?',
     'Je kunt informatie over fietstochten en fietsverhuur krijgen bij de bar. Er is een ecopista fietspad van Arco de Baúlhe via Mondim en Celorico naar Amarante.',
     null, 'Brochure')
on conflict (legacy_id) do nothing;
