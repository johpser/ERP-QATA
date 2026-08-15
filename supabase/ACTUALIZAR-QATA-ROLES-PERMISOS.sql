-- ============================================================
-- QATA ERP — ACTUALIZACIÓN DE ROLES Y PERMISOS
-- Ejecutar UNA SOLA VEZ después de INSTALAR-QATA-SUPABASE.sql
-- Roles: admin, comprador, admin_obra
-- ============================================================

begin;

-- Normaliza perfiles antiguos "editor" al nuevo rol de Administrador de Obra.
update public.qata_documents
set data = jsonb_set(data, '{rol}', '"admin_obra"'::jsonb, true),
    updated_at = now()
where bucket='usuarios'
  and lower(coalesce(data->>'rol',''))='editor';

-- Lectura por rol y por módulo.
drop policy if exists qata_documents_select on public.qata_documents;
create policy qata_documents_select
on public.qata_documents for select
to authenticated
using (
  public.qata_current_role()='admin'
  or (
    public.qata_current_role()='comprador'
    and (
      bucket in ('configuracion','productos','requerimientos','ordenesCompra','ordenesServicio','guiasRemision','proveedores')
      or (bucket='usuarios' and id=auth.uid()::text)
    )
  )
  or (
    public.qata_current_role()='admin_obra'
    and (
      bucket in ('configuracion','productos','requerimientos','ordenesCompra')
      or (bucket='usuarios' and id=auth.uid()::text)
    )
  )
);

-- Escritura: admin todo; comprador módulos operativos; admin_obra puede gestionar requerimientos y crear/importar/actualizar productos.
drop policy if exists qata_documents_insert on public.qata_documents;
create policy qata_documents_insert
on public.qata_documents for insert
to authenticated
with check (
  public.qata_current_role()='admin'
  or (
    public.qata_current_role()='comprador'
    and bucket in ('productos','requerimientos','ordenesCompra','ordenesServicio','guiasRemision','proveedores')
  )
  or (
    public.qata_current_role()='admin_obra'
    and bucket in ('requerimientos','productos')
  )
);

drop policy if exists qata_documents_update on public.qata_documents;
create policy qata_documents_update
on public.qata_documents for update
to authenticated
using (
  public.qata_current_role()='admin'
  or (
    public.qata_current_role()='comprador'
    and bucket in ('productos','requerimientos','ordenesCompra','ordenesServicio','guiasRemision','proveedores')
  )
  or (
    public.qata_current_role()='admin_obra'
    and bucket in ('requerimientos','productos')
  )
)
with check (
  public.qata_current_role()='admin'
  or (
    public.qata_current_role()='comprador'
    and bucket in ('productos','requerimientos','ordenesCompra','ordenesServicio','guiasRemision','proveedores')
  )
  or (
    public.qata_current_role()='admin_obra'
    and bucket in ('requerimientos','productos')
  )
);

drop policy if exists qata_documents_delete on public.qata_documents;
create policy qata_documents_delete
on public.qata_documents for delete
to authenticated
using (
  public.qata_current_role()='admin'
  or (
    public.qata_current_role()='comprador'
    and bucket in ('productos','requerimientos','ordenesCompra','ordenesServicio','guiasRemision','proveedores')
  )
  or (
    public.qata_current_role()='admin_obra'
    and bucket='requerimientos'
  )
);

-- Comprador puede emitir correlativos operativos, pero solo admin puede configurarlos.
create or replace function public.qata_next_sequence(p_type text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_type text := upper(trim(coalesce(p_type,'')));
  v_seq public.qata_sequences%rowtype;
  v_number bigint;
  v_result text;
  v_bucket text;
  v_field text;
  v_exists boolean;
begin
  v_role := public.qata_current_role();
  if v_role not in ('admin','comprador') then
    raise exception 'ROL_NO_PUEDE_EMITIR_CORRELATIVOS';
  end if;

  if v_type not in ('OC','OS','GUIA') then
    raise exception 'TIPO_CORRELATIVO_INVALIDO';
  end if;

  select * into v_seq
  from public.qata_sequences
  where document_type=v_type
  for update;

  if not found then raise exception 'CORRELATIVO_NO_CONFIGURADO'; end if;

  v_number := v_seq.next_number;
  v_bucket := case v_type when 'OC' then 'ordenesCompra' when 'OS' then 'ordenesServicio' else 'guiasRemision' end;
  v_field := case v_type when 'OC' then 'nroOC' when 'OS' then 'nroOS' else 'nroGR' end;

  loop
    v_result := v_seq.prefix || lpad(v_number::text, v_seq.padding, '0') || v_seq.suffix;
    select exists(
      select 1 from public.qata_documents d
      where d.bucket=v_bucket and d.data->>v_field=v_result
    ) into v_exists;
    exit when not v_exists;
    v_number := v_number + 1;
  end loop;

  update public.qata_sequences
  set next_number=v_number+1, updated_at=now()
  where document_type=v_type;

  return v_result;
end;
$$;

revoke all on function public.qata_next_sequence(text) from public;
grant execute on function public.qata_next_sequence(text) to authenticated;

-- Asignar/actualizar rol desde Administración. El usuario debe existir antes en Authentication > Users.
create or replace function public.qata_set_user_role(p_email text, p_role text)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_id uuid;
  v_role text := lower(trim(coalesce(p_role,'')));
  v_email text := lower(trim(coalesce(p_email,'')));
begin
  if public.qata_current_role() <> 'admin' then
    raise exception 'SOLO_ADMIN_PUEDE_ASIGNAR_ROLES';
  end if;

  if v_role not in ('admin','comprador','admin_obra') then
    raise exception 'ROL_INVALIDO';
  end if;

  select id into v_id
  from auth.users
  where lower(email)=v_email
  limit 1;

  if v_id is null then raise exception 'USUARIO_AUTH_NO_ENCONTRADO'; end if;

  insert into public.qata_documents(bucket,id,data,updated_at)
  values(
    'usuarios',
    v_id::text,
    jsonb_build_object('rol',v_role,'email',v_email),
    now()
  )
  on conflict(bucket,id) do update set
    data=public.qata_documents.data || excluded.data,
    updated_at=now();

  return jsonb_build_object('id',v_id::text,'email',v_email,'rol',v_role);
end;
$$;

revoke all on function public.qata_set_user_role(text,text) from public, anon;
grant execute on function public.qata_set_user_role(text,text) to authenticated;

commit;
