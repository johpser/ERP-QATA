# Supabase rápido — QATA ERP

## Si ya ejecutaste INSTALAR-QATA-SUPABASE.sql

No lo ejecutes de nuevo. Para activar los nuevos roles ejecuta una sola vez:

`ACTUALIZAR-QATA-ROLES-PERMISOS.sql`

Esto conserva todos tus datos y agrega:

- rol Comprador;
- rol Administrador de Obra;
- permisos RLS por módulo;
- emisión de OC/OS/guías para Compradores;
- función segura para asignar roles desde Administración.

## Si vas a crear otro Supabase desde cero

Ejecuta en un solo pegado:

`INSTALAR-QATA-SUPABASE-COMPLETO.sql`

Luego crea el primer usuario en **Authentication > Users** y ejecuta:

```sql
select public.qata_grant_admin('TU_CORREO_REAL');
```

## Usuarios posteriores

Crea el usuario en **Authentication > Users**. Luego entra al ERP como administrador y abre:

**Administración / Configuración > Usuarios y roles del ERP**

Ahí puedes asignar:

- Administrador
- Comprador
- Administrador de Obra

## Productos

El Supabase nuevo comienza sin catálogo. En el ERP entra a **Catálogo de Productos** y usa **IMPORTAR EXCEL / CSV**. El botón **PLANTILLA** genera el formato recomendado.
