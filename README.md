# ERP QATA — GitHub + Supabase

ERP estático para QATA ASOCIADOS S.A.C. preparado para publicarse desde GitHub/GitHub Pages y usar un proyecto Supabase nuevo. No requiere Replit, servidor Node ni Firebase.

## Módulos preservados

- Panel de Control.
- Requerimientos e historial.
- Catálogo de productos/materiales.
- Orden de Compra (OC) para productos/materiales.
- Historial de OC separado.
- Orden de Servicio (OS) como módulo independiente.
- Historial de OS separado.
- Guías de remisión e historial.
- Administración / Configuración.
- PDFs y exportaciones existentes.

## Configuración rápida de Supabase

1. Crea un proyecto Supabase nuevo.
2. Abre **SQL Editor** y ejecuta completo `supabase/INSTALAR-QATA-SUPABASE.sql`.
3. En **Authentication > Users**, crea el primer usuario con correo y contraseña.
4. Vuelve a SQL Editor y ejecuta:

```sql
select public.qata_grant_admin('TU_CORREO');
```

5. En Supabase copia **Project URL** y **Publishable key** (o anon key legacy).
6. Pégalos únicamente en `js/config.js`.
7. Sube el contenido de esta carpeta a tu repositorio GitHub y publica con GitHub Pages si deseas.

Consulta `supabase/SUPABASE-RAPIDO.md` para el paso a paso exacto.

## Numeración desde Administración

La pantalla **Administración / Configuración** permite definir:

- prefijo de OC;
- próximo número de OC;
- cantidad de dígitos;
- sufijo opcional;
- lo mismo para OS y guía manual.

Ejemplo: prefijo `OC-`, próximo número `1250` y 4 dígitos genera **OC-1250**. Si el número ya fue utilizado, Supabase lo salta para evitar duplicados.

Los correlativos se reservan en la base mediante una función SQL atómica para evitar que dos usuarios reciban el mismo número.

## Seguridad

El frontend utiliza solamente la **Publishable key / anon key**. La seguridad real está en Row Level Security (RLS), instalada por el SQL. **Nunca coloques la Secret Key ni `service_role` en GitHub o en `js/config.js`.**

## Datos iniciales

El instalador crea la configuración base de documentos, Cambridge, condiciones de OC/OS y correlativos iniciales. Productos, proveedores, requerimientos y documentos empiezan vacíos porque este paquete está pensado para un Supabase nuevo.
