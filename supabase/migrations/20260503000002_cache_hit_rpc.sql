-- ================================================================
-- RPC functie om cache hits te tellen (atomair)
-- Aangeroepen door Edge Function bij elke cache-hit.
-- ================================================================

create or replace function increment_cache_hit(q text, l text)
returns void as $$
begin
    update question_cache
    set hits = hits + 1,
        last_used = now()
    where normalized_question = q
      and language = l;
end;
$$ language plpgsql security definer;
