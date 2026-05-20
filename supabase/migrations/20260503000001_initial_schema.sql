-- ================================================================
-- Quinta Valbom FAQ Bot — Initial schema
-- Run via: supabase db push  (of in dashboard SQL editor)
-- ================================================================

-- ----------------------------------------------------------------
-- 1. Categorieën
-- ----------------------------------------------------------------
create table if not exists categories (
    id uuid primary key default gen_random_uuid(),
    name text not null unique,
    sort_order int default 0,
    created_at timestamptz default now()
);

-- ----------------------------------------------------------------
-- 2. FAQs
-- ----------------------------------------------------------------
create table if not exists faqs (
    id uuid primary key default gen_random_uuid(),
    legacy_id int unique,                    -- voor migratie van JSON-IDs
    category text not null,
    question text not null,
    answer text not null,
    context text,                            -- optioneel: extra hints voor matching
    status text default 'active',            -- active | archived
    source text,                             -- bv. 'Brochure', 'Excel-import'
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

create index if not exists idx_faqs_category on faqs(category);
create index if not exists idx_faqs_status on faqs(status) where status = 'active';

-- ----------------------------------------------------------------
-- 3. Cache van geleerde vragen (per taal)
-- ----------------------------------------------------------------
create table if not exists question_cache (
    id uuid primary key default gen_random_uuid(),
    normalized_question text not null,
    language text not null,                  -- 'nl', 'en', 'pt', 'de', 'fr'
    faq_id uuid references faqs(id) on delete cascade,
    answer text not null,                    -- de (mogelijk vertaalde) antwoord-tekst
    original_question text,                  -- de originele vraag van de gast (voor context)
    hits int default 1,
    first_seen timestamptz default now(),
    last_used timestamptz default now(),
    constraint uniq_question_lang unique (normalized_question, language)
);

create index if not exists idx_cache_language on question_cache(language);
create index if not exists idx_cache_faq_id on question_cache(faq_id);

-- ----------------------------------------------------------------
-- 4. Pending vragen (escalatie naar eigenaar)
-- ----------------------------------------------------------------
create table if not exists pending_questions (
    id uuid primary key default gen_random_uuid(),
    question text not null,
    language text,
    sender_phone text,                       -- wa_id van WhatsApp gast (geanonimiseerd in logs)
    times_asked int default 1,
    answered boolean default false,
    answer_added_to_faq_id uuid references faqs(id) on delete set null,
    first_asked timestamptz default now(),
    last_asked timestamptz default now()
);

create index if not exists idx_pending_unanswered on pending_questions(answered) where answered = false;

-- ----------------------------------------------------------------
-- 5. Conversation log (voor debugging + analytics)
-- ----------------------------------------------------------------
create table if not exists conversations (
    id uuid primary key default gen_random_uuid(),
    sender_phone text not null,
    direction text not null check (direction in ('inbound', 'outbound')),
    channel text default 'whatsapp',         -- 'whatsapp', 'web', 'email'
    message_text text,
    detected_language text,
    answer_source text,                      -- 'cache', 'claude', 'local', 'fallback'
    matched_faq_id uuid references faqs(id) on delete set null,
    claude_tokens_in int,
    claude_tokens_out int,
    created_at timestamptz default now()
);

create index if not exists idx_conversations_phone on conversations(sender_phone);
create index if not exists idx_conversations_created on conversations(created_at desc);

-- ----------------------------------------------------------------
-- 6. Bot-instellingen (key-value store voor admin config)
-- ----------------------------------------------------------------
create table if not exists settings (
    key text primary key,
    value jsonb not null,
    description text,
    updated_at timestamptz default now()
);

-- Default instellingen
insert into settings (key, value, description) values
    ('claude_model', '"claude-haiku-4-5-20251001"', 'Welk Claude-model te gebruiken'),
    ('claude_temperature', '0.5', 'Creativiteit van Claude (0-1)'),
    ('cache_fuzzy_threshold', '0.90', 'Hoe streng de fuzzy cache match moet zijn'),
    ('escalation_phone', '"+351910348399"', 'WhatsApp van eigenaar voor notificaties'),
    ('escalation_email', '"motho@quintavalbom.nl"', 'Email voor notificaties bij niet-beantwoorde vragen')
on conflict (key) do nothing;

-- ----------------------------------------------------------------
-- 7. Trigger om updated_at automatisch bij te werken
-- ----------------------------------------------------------------
create or replace function set_updated_at()
returns trigger as $$
begin
    new.updated_at = now();
    return new;
end;
$$ language plpgsql;

drop trigger if exists trg_faqs_updated on faqs;
create trigger trg_faqs_updated
    before update on faqs
    for each row execute function set_updated_at();

drop trigger if exists trg_settings_updated on settings;
create trigger trg_settings_updated
    before update on settings
    for each row execute function set_updated_at();

-- ----------------------------------------------------------------
-- 8. Row Level Security
-- ----------------------------------------------------------------
-- FAQs: leesbaar voor anon (chat-gebruik), schrijfbaar alleen via service-role
alter table faqs enable row level security;
create policy "FAQs zijn publiek leesbaar"
    on faqs for select using (status = 'active');

-- Cache: alleen service-role
alter table question_cache enable row level security;

-- Pending questions: alleen service-role + admin
alter table pending_questions enable row level security;

-- Conversations: alleen service-role + admin
alter table conversations enable row level security;

-- Settings: leesbaar voor anon (model-naam etc), schrijfbaar alleen service-role
alter table settings enable row level security;
create policy "Settings publiek leesbaar"
    on settings for select using (true);

-- Note: Edge Functions gebruiken de SERVICE_ROLE_KEY en bypassen RLS,
-- dus ze kunnen overal lezen/schrijven. Anon-key in browsers is veilig.
