# Cambios OC / OS — versión GitHub

## Se conserva
- Requerimientos e historial.
- Catálogo de productos/materiales.
- Orden de Compra e historial OC.
- Guías de remisión e historial.
- Proveedores y datos existentes de Firebase.

## Orden de Compra
- Continúa siendo el módulo para productos/materiales.
- Sigue usando `ordenesCompra` y `config/contadorOC`.
- Mantiene el flujo existente de guía de remisión.
- El PDF usa las condiciones generales actualizadas.

## Orden de Servicio
- Módulo independiente (`orden_servicio.html`).
- Historial independiente (`historial_os.html`).
- Colección `ordenesServicio`.
- Correlativo `config/contadorOS` con sufijo configurable.
- No genera guía automáticamente.
- PDF de 5 páginas: hoja operativa + 4 hojas de términos y condiciones.

## Otros
- CAMBRIDGE agregado como proyecto/obra predeterminado.
- Johpser Alejandro eliminado de compradores; se migra la configuración antigua al cargarla.
- Panel de Control agregado sin eliminar el historial OC ni el historial OS.
- Administración / Configuración del sistema mantiene parámetros editables sin tocar código.
