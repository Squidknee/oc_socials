-- Supabase Auth is email-based under the hood — there's no native
-- "sign in with username." This function bridges the gap: the login
-- form looks up the email for a given username here, then passes that
-- email into the normal signInWithPassword call.
--
-- security definer is required since auth.users isn't otherwise
-- readable by the anon/authenticated roles this function runs as.
create or replace function public.get_email_for_username(_username text)
returns text
language sql
security definer
set search_path = public
as $$
  select au.email
  from public.users u
  join auth.users au on au.id = u.id
  where u.username = _username;
$$;

grant execute on function public.get_email_for_username(text) to anon, authenticated;
