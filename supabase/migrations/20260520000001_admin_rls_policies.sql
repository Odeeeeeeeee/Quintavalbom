-- ================================================================
-- Admin dashboard RLS policies
-- Authenticated users (Thomas via magic link) can manage FAQs,
-- view/dismiss pending questions, read conversations & categories
-- ================================================================

-- ----------------------------------------------------------------
-- FAQs: authenticated users can create, update, delete (soft)
-- ----------------------------------------------------------------
create policy "Authenticated users can read all FAQs"
    on faqs for select to authenticated using (true);

create policy "Authenticated users can insert FAQs"
    on faqs for insert to authenticated with check (true);

create policy "Authenticated users can update FAQs"
    on faqs for update to authenticated using (true) with check (true);

-- No hard delete policy -- we use soft delete (status = 'archived')

-- ----------------------------------------------------------------
-- Categories: readable by all, writable by authenticated
-- ----------------------------------------------------------------
alter table categories enable row level security;

create policy "Categories are publicly readable"
    on categories for select using (true);

create policy "Authenticated users can insert categories"
    on categories for insert to authenticated with check (true);

create policy "Authenticated users can update categories"
    on categories for update to authenticated using (true) with check (true);

-- ----------------------------------------------------------------
-- Pending questions: authenticated can read + update (mark answered)
-- ----------------------------------------------------------------
create policy "Authenticated users can read pending questions"
    on pending_questions for select to authenticated using (true);

create policy "Authenticated users can update pending questions"
    on pending_questions for update to authenticated using (true) with check (true);

-- ----------------------------------------------------------------
-- Conversations: authenticated can read (for stats)
-- ----------------------------------------------------------------
create policy "Authenticated users can read conversations"
    on conversations for select to authenticated using (true);

-- ----------------------------------------------------------------
-- Settings: authenticated can update
-- ----------------------------------------------------------------
create policy "Authenticated users can update settings"
    on settings for update to authenticated using (true) with check (true);
