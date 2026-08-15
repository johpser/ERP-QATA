# Supabase rápido — QATA ERP

Esta versión está preparada para un **Supabase nuevo** y un repositorio GitHub nuevo. No necesitas migrar Firebase para empezar limpio.

## 1. Crear proyecto

En Supabase crea un proyecto nuevo y espera a que termine de aprovisionarse.

## 2. Instalar toda la base en un solo pegado

En **SQL Editor > New query**, pega TODO el contenido de:

`supabase/INSTALAR-QATA-SUPABASE.sql`

y pulsa **Run**.

Ese único script crea:

- almacenamiento del ERP;
- RLS y permisos;
- configuración inicial de QATA;
- Cambridge;
- condiciones de OC/OS;
- correlativos OC, OS y guía;
- funciones seguras para numeración;
- función para asignar el primer administrador.

## 3. Crear el primer usuario

En **Authentication > Users > Add user**, crea tu correo y contraseña.

Después vuelve al SQL Editor y ejecuta únicamente:

```sql
select public.qata_grant_admin('TU_CORREO_REAL');
```

## 4. Vincular el sitio

En **Project Settings / API** copia:

- Project URL
- Publishable key (o anon key si tu panel muestra la nomenclatura legacy)

Abre `js/config.js` y reemplaza:

```js
const SUPABASE_URL = "PEGA_AQUI_TU_SUPABASE_URL";
const SUPABASE_PUBLISHABLE_KEY = "PEGA_AQUI_TU_PUBLISHABLE_KEY";
```

No uses Secret Key / service_role.

## 5. Publicar GitHub

Sube el contenido del proyecto al repositorio. Para GitHub Pages no necesitas cambiar Supabase por tener un repositorio nuevo; el navegador se conecta usando esos dos valores y RLS protege la información.

## 6. Configurar desde qué OC empezar

Entra al ERP como administrador:

**Administración / Configuración > Numeración / correlativos**

Ejemplo para iniciar en OC-0250:

- Prefijo: `OC-`
- Próximo número: `250`
- Dígitos: `4`
- Sufijo: vacío

Vista previa: `OC-0250`.

También puedes configurar OS y guía manual desde la misma sección.

> Si colocas por error un correlativo que ya existe, el generador buscará el siguiente libre para no repetir el número.
