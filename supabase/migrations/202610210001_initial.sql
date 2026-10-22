-- Host Upgrade Planner. Run on a fresh Supabase project. UTC timestamps; EUR cents.
create extension if not exists pgcrypto;
create table public.workspaces(id uuid primary key default gen_random_uuid(), name text not null check(length(name) between 1 and 150), settings jsonb not null default '{"locale":"en-IE","timezone":"Europe/Rome","priceDays":7,"stockHours":24,"pilotFee":14900}', created_at timestamptz not null default now());
create table public.memberships(workspace_id uuid references public.workspaces on delete cascade, user_id uuid references auth.users on delete cascade, role text not null check(role in ('administrator','operator','approver')), display_name text not null, primary key(workspace_id,user_id));
create table public.properties(id uuid primary key, workspace_id uuid not null references public.workspaces on delete cascade, name text not null, city text not null default '', country text not null default 'Italy', unique(id,workspace_id));
create table public.property_access(workspace_id uuid not null, property_id uuid not null, user_id uuid not null, can_approve boolean not null default true, primary key(property_id,user_id), foreign key(property_id,workspace_id) references public.properties(id,workspace_id) on delete cascade, foreign key(workspace_id,user_id) references public.memberships(workspace_id,user_id) on delete cascade);
-- Typed JSON project aggregate contains rooms, measurements, reviews/import provenance,
-- observations, draft, task progress, analysis metadata, outcome observations and activity events.
create table public.reviews(id text primary key,workspace_id uuid not null,property_id uuid not null,fingerprint text not null,data jsonb not null,foreign key(property_id,workspace_id) references public.properties(id,workspace_id) on delete cascade,unique(property_id,fingerprint),check(data->>'id'=id));
create index reviews_property on public.reviews(property_id);
alter table public.reviews enable row level security;
create table public.projects(id uuid primary key, workspace_id uuid not null, property_id uuid not null, revision integer not null default 0, data jsonb not null, foreign key(property_id,workspace_id) references public.properties(id,workspace_id) on delete cascade, unique(id,workspace_id,property_id), check(data->>'id'=id::text),check(data->>'propertyId'=property_id::text));
create table public.catalog_items(id uuid primary key, workspace_id uuid not null references public.workspaces on delete cascade, data jsonb not null, check(data->>'id'=id::text),check(coalesce((data->>'synthetic')::boolean,true)=false));
create table public.plan_versions(id uuid primary key, workspace_id uuid not null, property_id uuid not null, project_id uuid not null, number integer not null check(number>0), snapshot jsonb not null, created_at timestamptz not null default now(), foreign key(project_id,workspace_id,property_id) references public.projects(id,workspace_id,property_id) on delete cascade,unique(project_id,number));
create table public.approvals(version_id uuid primary key references public.plan_versions on delete cascade, actor_id uuid references auth.users, decision text not null check(decision in ('approved','rejected','changes_requested')), note text not null, created_at timestamptz not null default now());
create table public.invitations(id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces on delete cascade, email text not null, role text not null check(role in ('operator','approver','administrator')), property_ids uuid[] not null default '{}', token_hash text unique not null, expires_at timestamptz not null, used_at timestamptz, created_by uuid not null references auth.users);
create table public.assets(id uuid primary key,workspace_id uuid not null,property_id uuid not null,project_id uuid, path text not null unique, kind text not null check(kind in ('room','completion','import')), name text not null,created_at timestamptz not null default now(), foreign key(property_id,workspace_id) references public.properties(id,workspace_id) on delete cascade,foreign key(project_id,workspace_id,property_id) references public.projects(id,workspace_id,property_id) on delete cascade);
create table public.analysis_runs(id uuid primary key default gen_random_uuid(), workspace_id uuid not null,property_id uuid not null,project_id uuid not null,stage text not null,input_hash text not null,provider text not null default 'openai',model text not null,prompt_version text not null,status text not null check(status in ('running','completed','failed')),error text,usage jsonb, result jsonb,created_at timestamptz not null default now(),finished_at timestamptz, foreign key(project_id,workspace_id,property_id) references public.projects(id,workspace_id,property_id) on delete cascade,unique(project_id,stage,input_hash));
create table public.request_limits(user_id uuid not null references auth.users on delete cascade, bucket text not null, window_start timestamptz not null default now(),count integer not null default 1,primary key(user_id,bucket));
create index projects_workspace on public.projects(workspace_id,property_id);
create index assets_property on public.assets(property_id);
create index access_user on public.property_access(user_id);
create index memberships_user on public.memberships(user_id);
create index analysis_project on public.analysis_runs(project_id,created_at);
create function public.member_role(w uuid,u uuid default auth.uid()) returns text language sql stable security definer set search_path=public as $$select role from memberships where workspace_id=w and user_id=u$$;
create function public.can_read_property(p uuid,u uuid default auth.uid()) returns boolean language sql stable security definer set search_path=public as $$select exists(select 1 from properties x join memberships m on m.workspace_id=x.workspace_id and m.user_id=u where x.id=p and (m.role in ('administrator','operator') or exists(select 1 from property_access a where a.property_id=p and a.user_id=u)))$$;
create function public.is_editor(w uuid,u uuid) returns boolean language sql stable security definer set search_path=public as $$select coalesce(public.member_role(w,u) in ('administrator','operator'),false)$$;
alter table workspaces enable row level security;alter table memberships enable row level security;alter table properties enable row level security;alter table property_access enable row level security;alter table projects enable row level security;alter table catalog_items enable row level security;alter table plan_versions enable row level security;alter table approvals enable row level security;alter table invitations enable row level security;alter table assets enable row level security;alter table analysis_runs enable row level security;alter table request_limits enable row level security;
create policy workspace_read on workspaces for select to authenticated using(public.member_role(id) is not null);
create policy membership_read on memberships for select to authenticated using(user_id=auth.uid() or public.member_role(workspace_id)='administrator');
create policy property_read on properties for select to authenticated using(public.can_read_property(id));
create policy access_read on property_access for select to authenticated using(user_id=auth.uid() or public.is_editor(workspace_id,auth.uid()));
create policy reviews_read on reviews for select to authenticated using(public.can_read_property(property_id));
create policy project_read on projects for select to authenticated using(public.can_read_property(property_id));
-- Approvers receive only offer snapshots embedded in assigned plans, not a whole workspace catalog.
create policy catalog_read on catalog_items for select to authenticated using(public.is_editor(workspace_id,auth.uid()));
create policy version_read on plan_versions for select to authenticated using(public.can_read_property(property_id));
create policy approval_read on approvals for select to authenticated using(exists(select 1 from plan_versions v where v.id=version_id and public.can_read_property(v.property_id)));
create policy invitation_read on invitations for select to authenticated using(public.member_role(workspace_id)='administrator');
create policy asset_read on assets for select to authenticated using(public.can_read_property(property_id));
create policy run_read on analysis_runs for select to authenticated using(public.can_read_property(property_id));
-- Writes pass through authenticated server validation and service-only transactions. No direct browser writes.
revoke all on all tables in schema public from anon;
revoke insert,update,delete on all tables in schema public from authenticated;
grant select on workspaces,memberships,properties,property_access,reviews,projects,catalog_items,plan_versions,approvals,assets,analysis_runs,invitations to authenticated;
create function public.rate_limit(u uuid,b text,max_count integer) returns boolean language plpgsql security definer set search_path=public as $$declare n integer;begin insert into request_limits(user_id,bucket) values(u,b) on conflict(user_id,bucket) do update set count=case when request_limits.window_start<now()-interval '1 minute' then 1 else request_limits.count+1 end,window_start=case when request_limits.window_start<now()-interval '1 minute' then now() else request_limits.window_start end returning count into n;return n<=max_count;end$$;
create function public.commit_project(actor uuid,project uuid,expected integer,payload jsonb,operation text) returns void language plpgsql security definer set search_path=public as $$
declare old projects; v jsonb; previous jsonb; rv jsonb; canonical reviews;begin
 select * into old from projects where id=project for update;
 if not found then raise exception 'Project not found';end if;
 if old.revision<>expected then raise exception 'Concurrent edit: reload';end if;
 if operation='decide' then
  if not exists(select 1 from property_access where property_id=old.property_id and user_id=actor and can_approve) then raise exception 'Approval rights required';end if;
 elsif not public.is_editor(old.workspace_id,actor) then raise exception 'Editing access required';end if;
 if payload->>'id'<>old.id::text or payload->>'propertyId'<>old.property_id::text or (payload->>'revision')::integer<>expected+1 then raise exception 'Invalid project boundary or revision';end if;
 -- Preserve every prior immutable snapshot; a decision may change only status and decision fields.
 for previous in select value from jsonb_array_elements(old.data->'versions') loop
  select value into v from jsonb_array_elements(payload->'versions') where value->>'id'=previous->>'id';
  if v is null or (v-'status'-'decision')<>(previous-'status'-'decision') then raise exception 'Immutable snapshot changed';end if;
  if operation<>'decide' and v<>previous then raise exception 'Decision requires dedicated operation';end if;
  if operation='decide' and v<>previous and (previous->>'status'<>'submitted' or old.data->>'currentVersionId'<>v->>'id') then raise exception 'Only current submitted version can be decided';end if;
 end loop;
 if operation='decide' and (payload->'draft'<>old.data->'draft' or jsonb_array_length(payload->'versions')<>jsonb_array_length(old.data->'versions')) then raise exception 'Concurrent scope change';end if;
 for v in select value from jsonb_array_elements(payload->'versions') loop
  if not exists(select 1 from plan_versions where id=(v->>'id')::uuid) then
   if operation<>'submit' or v->>'status'<>'submitted' or (v->'draft')<>(old.data->'draft') then raise exception 'Invalid submission';end if;
   insert into plan_versions(id,workspace_id,property_id,project_id,number,snapshot) values((v->>'id')::uuid,old.workspace_id,old.property_id,old.id,(v->>'number')::integer,v-'status'-'decision');
  end if;
  if v->>'status'<>'submitted' and not exists(select 1 from approvals where version_id=(v->>'id')::uuid) then
   if operation<>'decide' then raise exception 'Approval operation required';end if;
   insert into approvals(version_id,actor_id,decision,note) values((v->>'id')::uuid,actor,v->>'status',v->'decision'->>'note');
  end if;
 end loop;
 for rv in select value from jsonb_array_elements(payload->'reviews') loop
  select * into canonical from reviews where id=rv->>'id' for update;
  if found then
   if canonical.workspace_id<>old.workspace_id or canonical.property_id<>old.property_id then raise exception 'Review boundary mismatch';end if;
   if canonical.data<>rv and operation<>'editReview' then raise exception 'Shared review changed: reload';end if;
   if operation='editReview' then update reviews set data=rv,fingerprint=rv->>'fingerprint' where id=canonical.id;end if;
  else insert into reviews(id,workspace_id,property_id,fingerprint,data) values(rv->>'id',old.workspace_id,old.property_id,rv->>'fingerprint',rv);end if;
 end loop;
 update projects set data=payload,revision=expected+1 where id=project;
end$$;
create function public.accept_invitation(actor uuid,digest text) returns uuid language plpgsql security definer set search_path=public as $$declare inv invitations;email_address text; pid uuid;begin
 select * into inv from invitations where token_hash=digest for update;
 if not found or inv.used_at is not null or inv.expires_at<now() then raise exception 'Invitation expired or already used';end if;
 select lower(email) into email_address from auth.users where id=actor and email_confirmed_at is not null;
 if email_address is null or email_address<>lower(inv.email) then raise exception 'Confirm and sign in with the invited email address';end if;
 if exists(select 1 from memberships where workspace_id=inv.workspace_id and user_id=actor) then raise exception 'Existing member: ask administrator to update permissions';end if;
 insert into memberships values(inv.workspace_id,actor,inv.role,email_address);
 foreach pid in array inv.property_ids loop
  if not exists(select 1 from properties where id=pid and workspace_id=inv.workspace_id) then raise exception 'Invalid property assignment';end if;
  insert into property_access values(inv.workspace_id,pid,actor,true);
 end loop;
 update invitations set used_at=now() where id=inv.id;return inv.workspace_id;
end$$;
create function public.create_workspace(actor uuid,title text,display text) returns uuid language plpgsql security definer set search_path=public as $$declare wid uuid;begin insert into workspaces(name) values(title) returning id into wid;insert into memberships values(wid,actor,'administrator',display);return wid;end$$;
revoke execute on function public.commit_project(uuid,uuid,integer,jsonb,text),public.accept_invitation(uuid,text),public.create_workspace(uuid,text,text),public.rate_limit(uuid,text,integer) from public,anon,authenticated;
grant execute on function public.commit_project(uuid,uuid,integer,jsonb,text),public.accept_invitation(uuid,text),public.create_workspace(uuid,text,text),public.rate_limit(uuid,text,integer) to service_role;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('property-private','property-private',false,10485760,array['image/jpeg','image/png','image/webp','text/csv']) on conflict(id) do nothing;
-- Storage paths are workspace/property/asset. Access is authorized before signed URL creation.
create policy private_asset_select on storage.objects for select to authenticated using(bucket_id='property-private' and exists(select 1 from public.assets a where a.path=name and public.can_read_property(a.property_id)));
-- No public insert/update/delete storage policies: authenticated server checks IDs, bytes and types.
create function public.set_member_permissions(actor uuid,wid uuid,member uuid,new_role text,property_ids uuid[]) returns void language plpgsql security definer set search_path=public as $$declare pid uuid;begin
 perform 1 from workspaces where id=wid for update;
 if public.member_role(wid,actor)<>'administrator' or public.member_role(wid,actor) is null then raise exception 'Administrator required';end if;
 if public.member_role(wid,member) is null then raise exception 'Member not found';end if;
 if public.member_role(wid,member)='administrator' and new_role<>'administrator' and (select count(*) from memberships where workspace_id=wid and role='administrator')<=1 then raise exception 'Keep at least one administrator';end if;
 update memberships set role=new_role where workspace_id=wid and user_id=member;
 delete from property_access where workspace_id=wid and user_id=member;
 foreach pid in array property_ids loop
  if not exists(select 1 from properties where id=pid and workspace_id=wid) then raise exception 'Invalid property';end if;
  insert into property_access values(wid,pid,member,true);
 end loop;
end$$;
revoke execute on function public.set_member_permissions(uuid,uuid,uuid,text,uuid[]) from public,anon,authenticated;
grant execute on function public.set_member_permissions(uuid,uuid,uuid,text,uuid[]) to service_role;
drop policy membership_read on memberships;
create policy membership_read on memberships for select to authenticated using(user_id=auth.uid() or public.is_editor(workspace_id,auth.uid()));

create function public.commit_project_bundle(actor uuid,payloads jsonb,operation text) returns void language plpgsql security definer set search_path=public as $$declare item jsonb;begin
 for item in select value from jsonb_array_elements(payloads) order by value->'payload'->>'id' loop
  perform public.commit_project(actor,(item->'payload'->>'id')::uuid,(item->>'expected')::integer,item->'payload',operation);
 end loop;
end$$;
revoke execute on function public.commit_project_bundle(uuid,jsonb,text) from public,anon,authenticated;
grant execute on function public.commit_project_bundle(uuid,jsonb,text) to service_role;
