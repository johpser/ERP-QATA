# ERP QATA — GitHub + Supabase

ERP estático para QATA ASOCIADOS S.A.C. preparado para GitHub/GitHub Pages y Supabase. No requiere Replit, servidor Node ni Firebase.

## Módulos preservados

- Panel de Control.
- Requerimientos e historial.
- Catálogo de productos/materiales.
- Importación masiva de productos desde Excel/CSV.
- Orden de Compra (OC) para productos/materiales.
- Historial de OC separado.
- Orden de Servicio (OS) como módulo independiente.
- Historial de OS separado.
- Guías de remisión e historial.
- Administración / Configuración.
- PDFs y exportaciones existentes.

## Roles

- **Administrador:** acceso total, incluida Administración / Configuración.
- **Comprador:** módulos operativos (RQ, productos, OC, OS y guías), sin Administración / Configuración ni Panel de Control.
- **Administrador de Obra:** solo Generar Requerimiento, Historial de Requerimientos, Catálogo de Productos e Historial OC. El Historial OC es de solo lectura para este rol.

Los permisos se aplican en interfaz y también mediante RLS de Supabase.

## Si Supabase ya fue instalado con la versión anterior

Ejecuta UNA sola vez en SQL Editor:

`supabase/ACTUALIZAR-QATA-ROLES-PERMISOS.sql`

No vuelvas a ejecutar el instalador inicial.

## Para un Supabase nuevo desde cero

Puedes ejecutar directamente:

`supabase/INSTALAR-QATA-SUPABASE-COMPLETO.sql`

Después crea el primer usuario en **Authentication > Users** y conviértelo en administrador:

```sql
select public.qata_grant_admin('TU_CORREO');
```

## Crear Compradores y Administradores de Obra

1. Crea el usuario con correo y contraseña en **Supabase > Authentication > Users**.
2. Entra al ERP con tu usuario administrador.
3. Ve a **Administración / Configuración > Usuarios y roles del ERP**.
4. Escribe el correo, selecciona el rol y pulsa **Asignar**.

No necesitas volver al SQL Editor para cada usuario.

## Importar productos

En **Catálogo de Productos**, Administrador y Comprador ven:

- **PLANTILLA**: descarga un Excel de ejemplo.
- **IMPORTAR EXCEL / CSV**: carga el catálogo masivamente.

Columnas recomendadas:

`CODIGO | TIPO | DESCRIPCION | UNIDAD`

También reconoce aliases frecuentes como SKU, CATEGORIA, PRODUCTO/NOMBRE y UM. Si un código ya existe, se actualiza. Si CODIGO está vacío, el ERP genera uno automáticamente. Las filas sin descripción se omiten.

## Numeración desde Administración

Administración / Configuración permite definir prefijo, próximo número, cantidad de dígitos y sufijo de OC, OS y guía manual. Los correlativos se reservan de forma atómica en Supabase.

## Seguridad

El frontend usa únicamente la **Publishable key**. Nunca coloques `service_role` ni una Secret Key en GitHub o en `js/config.js`.

## Permisos de productos por rol

Los roles `admin`, `comprador` y `admin_obra` pueden crear productos nuevos e importar/actualizar el catálogo desde Excel o CSV. La eliminación de productos se mantiene restringida a `admin` y `comprador`.

## Roles y permisos por usuario

- **Administrador principal:** acceso total.
- **Comprador:** por defecto ve todos los módulos excepto Administración / Configuración.
- **Administrador de Obra:** por defecto ve Generar Requerimiento, Historial de Requerimientos, Historial de Guías, Historial de OS y Productos.
- Desde **Administración / Configuración → Usuarios, roles y módulos**, el Administrador principal puede agregar o quitar módulos individualmente. El rol funciona como plantilla inicial.
- Los permisos también se aplican en Supabase/RLS; no dependen únicamente de ocultar botones.
