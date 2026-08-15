# Cambios OC / OS — versión GitHub + Supabase

## Se conserva
- Requerimientos e historial.
- Catálogo de productos/materiales.
- Orden de Compra e historial OC.
- Guías de remisión e historial.
- Proveedores.
- Panel de Control.
- Administración / Configuración.

## Orden de Compra
- Continúa siendo el módulo para productos/materiales.
- Historial OC separado.
- Mantiene el flujo existente de guía de remisión.
- El PDF usa las condiciones generales actualizadas.
- El correlativo ahora se administra desde **Administración / Configuración > Numeración / correlativos**.
- Por defecto inicia en `OC-0001`, pero el administrador puede indicar desde qué número continuar.

## Orden de Servicio
- Módulo independiente (`orden_servicio.html`).
- Historial independiente (`historial_os.html`).
- No genera guía automáticamente.
- PDF de 5 páginas: hoja operativa + 4 hojas de términos y condiciones.
- Numeración independiente y configurable; por defecto `0000001D`.

## Supabase
- Firebase fue retirado de esta versión.
- Un solo script `supabase/INSTALAR-QATA-SUPABASE.sql` instala tablas, RLS, configuración y correlativos.
- Los correlativos se generan con una función SQL atómica para evitar duplicados.
- El frontend solo necesita Project URL + Publishable key en `js/config.js`.

## Otros
- CAMBRIDGE agregado como proyecto/obra predeterminado.
- Johpser Alejandro eliminado de compradores.
- El Panel de Control no sustituye los historiales existentes.
