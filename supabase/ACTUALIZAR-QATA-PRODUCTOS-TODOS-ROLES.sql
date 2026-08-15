-- ============================================================
-- QATA ERP — PRODUCTOS PARA TODOS LOS ROLES OPERATIVOS
-- Ejecutar UNA SOLA VEZ después de ACTUALIZAR-QATA-ROLES-PERMISOS.sql
-- Permite a admin, comprador y admin_obra crear/importar/actualizar productos.
-- La eliminación de productos sigue restringida a admin y comprador.
-- ============================================================

begin;

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

-- Mantiene eliminación de productos fuera de admin_obra.
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

commit;
