-- Joining a world via invite code was never actually wired up — 0003's
-- own comment flagged this: the only world_members insert policy lets you
-- add yourself as owner to a world you already own, not join someone
-- else's world as a member. Rather than open up a new (harder to reason
-- about) RLS policy for that, this does the whole validate+join+increment
-- as one security definer function, same pattern as is_world_member.

create or replace function public.redeem_invite(_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  invite record;
begin
  select * into invite from public.world_invites where code = _code;

  if invite is null then
    raise exception 'That invite code doesn''t exist.';
  end if;

  if invite.expires_at is not null and invite.expires_at < now() then
    raise exception 'That invite code has expired.';
  end if;

  if invite.max_uses is not null and invite.uses >= invite.max_uses then
    raise exception 'That invite code has already been fully used.';
  end if;

  if exists (
    select 1 from public.world_members
    where world_id = invite.world_id and user_id = auth.uid()
  ) then
    raise exception 'You''re already a member of that world.';
  end if;

  insert into public.world_members (world_id, user_id, role)
  values (invite.world_id, auth.uid(), 'member');

  update public.world_invites set uses = uses + 1 where id = invite.id;

  return invite.world_id;
end;
$$;

grant execute on function public.redeem_invite(text) to authenticated;
