-- ============================================================
-- QATA ERP — PERMISOS PERSONALIZADOS POR USUARIO
-- Ejecutar UNA SOLA VEZ sobre el Supabase ya instalado.
-- El rol define la plantilla inicial, pero el Administrador principal puede
-- agregar o quitar módulos individualmente desde Administración / Configuración.
-- ============================================================

begin;

create or replace function public.qata_default_modules(p_role text)
returns jsonb
language sql
immutable
as $$
  select case lower(trim(coalesce(p_role,'')))
    when 'admin' then '["dashboard","rq_create","rq_history","products","oc_create","oc_history","os_create","os_history","guide_create","guide_history","admin_config"]'::jsonb
    when 'comprador' then '["dashboard","rq_create","rq_history","products","oc_create","oc_history","os_create","os_history","guide_create","guide_history"]'::jsonb
    when 'admin_obra' then '["rq_create","rq_history","guide_history","os_history","products"]'::jsonb
    when 'editor' then '["rq_create","rq_history","guide_history","os_history","products"]'::jsonb
    else '[]'::jsonb
  end;
$$;

create or replace function public.qata_current_modules()
returns jsonb
language sql
stable
security definer
set search_path=public
as $$
  select case
    when lower(coalesce(d.data->>'rol',''))='admin' then public.qata_default_modules('admin')
    when jsonb_typeof(d.data->'modulos')='array' then d.data->'modulos'
    else public.qata_default_modules(d.data->>'rol')
  end
  from public.qata_documents d
  where d.bucket='usuarios' and d.id=auth.uid()::text
  limit 1;
$$;

create or replace function public.qata_has_module(p_module text)
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select coalesce(public.qata_current_role()='admin',false)
      or coalesce(public.qata_current_modules(),'[]'::jsonb) ? trim(coalesce(p_module,''));
$$;

revoke all on function public.qata_default_modules(text) from public,anon;
revoke all on function public.qata_current_modules() from public,anon;
revoke all on function public.qata_has_module(text) from public,anon;
grant execute on function public.qata_default_modules(text) to authenticated;
grant execute on function public.qata_current_modules() to authenticated;
grant execute on function public.qata_has_module(text) to authenticated;

-- Lectura real por módulo. Configuración base se puede leer para completar formularios.
drop policy if exists qata_documents_select on public.qata_documents;
create policy qata_documents_select
on public.qata_documents for select
to authenticated
using (
  public.qata_current_role()='admin'
  or (bucket='usuarios' and id=auth.uid()::text)
  or (bucket='configuracion' and public.qata_current_role() in ('comprador','admin_obra','editor'))
  or (bucket='productos' and (public.qata_has_module('products') or public.qata_has_module('rq_create') or public.qata_has_module('oc_create') or public.qata_has_module('guide_create')))
  or (bucket='requerimientos' and (public.qata_has_module('rq_create') or public.qata_has_module('rq_history') or public.qata_has_module('dashboard')))
  or (bucket='ordenesCompra' and (public.qata_has_module('oc_create') or public.qata_has_module('oc_history') or public.qata_has_module('dashboard')))
  or (bucket='ordenesServicio' and (public.qata_has_module('os_create') or public.qata_has_module('os_history') or public.qata_has_module('dashboard')))
  or (bucket='guiasRemision' and (public.qata_has_module('guide_create') or public.qata_has_module('guide_history') or public.qata_has_module('dashboard')))
  or (bucket='proveedores' and (public.qata_has_module('oc_create') or public.qata_has_module('os_create')))
);

-- Crear documentos solo cuando el módulo de creación correspondiente está habilitado.
drop policy if exists qata_documents_insert on public.qata_documents;
create policy qata_documents_insert
on public.qata_documents for insert
to authenticated
with check (
  public.qata_current_role()='admin'
  or (bucket='configuracion' and public.qata_has_module('admin_config'))
  or (bucket='productos' and (public.qata_has_module('products') or public.qata_has_module('rq_create') or public.qata_has_module('oc_create') or public.qata_has_module('guide_create')))
  or (bucket='requerimientos' and public.qata_has_module('rq_create'))
  or (bucket='ordenesCompra' and public.qata_has_module('oc_create'))
  or (bucket='ordenesServicio' and public.qata_has_module('os_create'))
  or (bucket='guiasRemision' and public.qata_has_module('guide_create'))
  or (bucket='proveedores' and (public.qata_has_module('oc_create') or public.qata_has_module('os_create')))
);

drop policy if exists qata_documents_update on public.qata_documents;
create policy qata_documents_update
on public.qata_documents for update
to authenticated
using (
  public.qata_current_role()='admin'
  or (bucket='configuracion' and public.qata_has_module('admin_config'))
  or (bucket='productos' and (public.qata_has_module('products') or public.qata_has_module('rq_create') or public.qata_has_module('oc_create') or public.qata_has_module('guide_create')))
  or (bucket='requerimientos' and public.qata_has_module('rq_create'))
  or (bucket='ordenesCompra' and public.qata_has_module('oc_create'))
  or (bucket='ordenesServicio' and public.qata_has_module('os_create'))
  or (bucket='guiasRemision' and public.qata_has_module('guide_create'))
  or (bucket='proveedores' and (public.qata_has_module('oc_create') or public.qata_has_module('os_create')))
)
with check (
  public.qata_current_role()='admin'
  or (bucket='configuracion' and public.qata_has_module('admin_config'))
  or (bucket='productos' and (public.qata_has_module('products') or public.qata_has_module('rq_create') or public.qata_has_module('oc_create') or public.qata_has_module('guide_create')))
  or (bucket='requerimientos' and public.qata_has_module('rq_create'))
  or (bucket='ordenesCompra' and public.qata_has_module('oc_create'))
  or (bucket='ordenesServicio' and public.qata_has_module('os_create'))
  or (bucket='guiasRemision' and public.qata_has_module('guide_create'))
  or (bucket='proveedores' and (public.qata_has_module('oc_create') or public.qata_has_module('os_create')))
);

-- Mantiene eliminación de productos fuera de Administrador de Obra.
drop policy if exists qata_documents_delete on public.qata_documents;
create policy qata_documents_delete
on public.qata_documents for delete
to authenticated
using (
  public.qata_current_role()='admin'
  or (bucket='productos' and public.qata_has_module('products') and public.qata_current_role()='comprador')
  or (bucket='requerimientos' and public.qata_has_module('rq_create'))
  or (bucket='ordenesCompra' and public.qata_has_module('oc_create'))
  or (bucket='ordenesServicio' and public.qata_has_module('os_create'))
  or (bucket='guiasRemision' and public.qata_has_module('guide_create'))
  or (bucket='proveedores' and (public.qata_has_module('oc_create') or public.qata_has_module('os_create')))
);

-- Los correlativos se pueden consultar/configurar si el usuario tiene Administración / Configuración.
drop policy if exists qata_sequences_select on public.qata_sequences;
create policy qata_sequences_select
on public.qata_sequences for select
to authenticated
using (public.qata_has_module('admin_config'));

create or replace function public.qata_next_sequence(p_type text)
returns text
language plpgsql
security definer
set search_path=public
as $$
declare
  v_type text := upper(trim(coalesce(p_type,'')));
  v_seq public.qata_sequences%rowtype;
  v_number bigint;
  v_result text;
  v_bucket text;
  v_field text;
  v_exists boolean;
  v_module text;
begin
  if v_type not in ('OC','OS','GUIA') then raise exception 'TIPO_CORRELATIVO_INVALIDO'; end if;
  v_module := case v_type when 'OC' then 'oc_create' when 'OS' then 'os_create' else 'guide_create' end;
  if not public.qata_has_module(v_module) then raise exception 'MODULO_NO_AUTORIZADO'; end if;

  select * into v_seq from public.qata_sequences where document_type=v_type for update;
  if not found then raise exception 'CORRELATIVO_NO_CONFIGURADO'; end if;

  v_number:=v_seq.next_number;
  v_bucket:=case v_type when 'OC' then 'ordenesCompra' when 'OS' then 'ordenesServicio' else 'guiasRemision' end;
  v_field:=case v_type when 'OC' then 'nroOC' when 'OS' then 'nroOS' else 'nroGR' end;
  loop
    v_result:=v_seq.prefix||lpad(v_number::text,v_seq.padding,'0')||v_seq.suffix;
    select exists(select 1 from public.qata_documents d where d.bucket=v_bucket and d.data->>v_field=v_result) into v_exists;
    exit when not v_exists;
    v_number:=v_number+1;
  end loop;
  update public.qata_sequences set next_number=v_number+1,updated_at=now() where document_type=v_type;
  return v_result;
end;
$$;
revoke all on function public.qata_next_sequence(text) from public,anon;
grant execute on function public.qata_next_sequence(text) to authenticated;

create or replace function public.qata_set_sequence(p_type text,p_prefix text,p_suffix text,p_next_number bigint,p_padding integer)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare v_type text:=upper(trim(coalesce(p_type,'')));
begin
  if not public.qata_has_module('admin_config') then raise exception 'MODULO_ADMINISTRACION_NO_AUTORIZADO'; end if;
  if v_type not in ('OC','OS','GUIA') then raise exception 'TIPO_CORRELATIVO_INVALIDO'; end if;
  if coalesce(p_next_number,0)<1 then raise exception 'PROXIMO_NUMERO_INVALIDO'; end if;
  if coalesce(p_padding,0)<1 or p_padding>12 then raise exception 'DIGITOS_INVALIDOS'; end if;
  insert into public.qata_sequences(document_type,prefix,suffix,next_number,padding,updated_at)
  values(v_type,coalesce(p_prefix,''),coalesce(p_suffix,''),p_next_number,p_padding,now())
  on conflict(document_type) do update set prefix=excluded.prefix,suffix=excluded.suffix,next_number=excluded.next_number,padding=excluded.padding,updated_at=now();
  return jsonb_build_object('document_type',v_type,'preview',coalesce(p_prefix,'')||lpad(p_next_number::text,p_padding,'0')||coalesce(p_suffix,''),'next_number',p_next_number);
end;
$$;
revoke all on function public.qata_set_sequence(text,text,text,bigint,integer) from public,anon;
grant execute on function public.qata_set_sequence(text,text,text,bigint,integer) to authenticated;

-- El Administrador principal puede asignar un rol y una lista personalizada de módulos.
create or replace function public.qata_set_user_access(p_email text,p_role text,p_modules jsonb default null)
returns jsonb
language plpgsql
security definer
set search_path=public,auth
as $$
declare
  v_id uuid;
  v_role text:=lower(trim(coalesce(p_role,'')));
  v_email text:=lower(trim(coalesce(p_email,'')));
  v_modules jsonb;
  v_allowed text[]:=array['dashboard','rq_create','rq_history','products','oc_create','oc_history','os_create','os_history','guide_create','guide_history','admin_config'];
  v_bad boolean;
begin
  if public.qata_current_role()<>'admin' then raise exception 'SOLO_ADMIN_PUEDE_ASIGNAR_PERMISOS'; end if;
  if v_role='editor' then v_role:='admin_obra'; end if;
  if v_role not in ('admin','comprador','admin_obra') then raise exception 'ROL_INVALIDO'; end if;
  select id into v_id from auth.users where lower(email)=v_email limit 1;
  if v_id is null then raise exception 'USUARIO_AUTH_NO_ENCONTRADO'; end if;

  if v_role='admin' then
    v_modules:=public.qata_default_modules('admin');
  elsif p_modules is null then
    v_modules:=public.qata_default_modules(v_role);
  else
    if jsonb_typeof(p_modules)<>'array' then raise exception 'MODULOS_INVALIDOS'; end if;
    select exists(select 1 from jsonb_array_elements_text(p_modules) as x(value) where not (x.value=any(v_allowed))) into v_bad;
    if v_bad then raise exception 'MODULO_INVALIDO'; end if;
    select coalesce(jsonb_agg(distinct x.value),'[]'::jsonb) into v_modules from jsonb_array_elements_text(p_modules) as x(value);
  end if;

  insert into public.qata_documents(bucket,id,data,updated_at)
  values('usuarios',v_id::text,jsonb_build_object('rol',v_role,'email',v_email,'modulos',v_modules,'permisos_personalizados',true),now())
  on conflict(bucket,id) do update set data=public.qata_documents.data || excluded.data,updated_at=now();
  return jsonb_build_object('id',v_id::text,'email',v_email,'rol',v_role,'modulos',v_modules);
end;
$$;
revoke all on function public.qata_set_user_access(text,text,jsonb) from public,anon;
grant execute on function public.qata_set_user_access(text,text,jsonb) to authenticated;

-- Compatibilidad: asignar solo rol restaura la plantilla predeterminada.
create or replace function public.qata_set_user_role(p_email text,p_role text)
returns jsonb
language sql
security definer
set search_path=public
as $$ select public.qata_set_user_access(p_email,p_role,null); $$;
revoke all on function public.qata_set_user_role(text,text) from public,anon;
grant execute on function public.qata_set_user_role(text,text) to authenticated;

commit;
