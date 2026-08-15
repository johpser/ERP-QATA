# ERP QATA Asociados

ERP web de **QATA ASOCIADOS S.A.C.** preparado como repositorio estático para GitHub. Esta entrega parte del último ZIP `ERP-QATA-OC-OS-MODULOS-SEPARADOS` y conserva los módulos existentes, agregando/ordenando la Orden de Servicio como flujo independiente.

## Módulos

- Panel de Control
- Requerimientos + historial
- Catálogo de productos/materiales
- Orden de Compra (OC) + historial OC
- Orden de Servicio (OS) + historial OS independiente
- Guías de Remisión + historial
- Administración / Configuración del sistema

### Regla funcional importante

- **OC:** se mantiene para compras de productos/materiales y conserva su flujo existente, incluida la generación de guía donde ya correspondía.
- **OS:** módulo separado; se guarda en `ordenesServicio`, utiliza correlativo independiente y genera un PDF de 5 páginas basado en el formato de referencia de QATA (primera hoja operativa + 4 hojas de términos). No crea guía automáticamente.

## GitHub

El proyecto no requiere Replit ni `node_modules`. Es HTML/CSS/JavaScript estático y usa Firebase desde el navegador. Puede versionarse directamente en GitHub y publicarse en un hosting estático compatible.

Archivos de trabajo de editor y temporales están excluidos mediante `.gitignore`. Se incluye `.nojekyll` para evitar que GitHub Pages procese el sitio con Jekyll.

## Firebase

Antes de usar producción, revisa **`firebase/FIREBASE-PARA-CARGAR.md`**. Allí se indican las rutas nuevas/faltantes, el documento `configuracion/documentos`, el contador `config/contadorOS` y qué colecciones existentes no deben reiniciarse.

La configuración web de Firebase de `js/config.js` es utilizada por el frontend. La seguridad real debe estar en Firebase Authentication y en las reglas de Firestore; no dependas de ocultar la configuración del cliente.

## Cambios de esta entrega

- Obra/proyecto **CAMBRIDGE** disponible y predeterminado.
- OS totalmente separada de OC y con historial propio.
- PDF OS basado en el documento de referencia, con condiciones generales en 4 hojas.
- Condiciones generales actualizadas también para las OC.
- Eliminación de Johpser Alejandro de la configuración de compradores, incluida migración de configuraciones antiguas.
- Panel de Control de solo lectura con indicadores de requerimientos, OC, OS y guías.
- Exportación Excel del historial OS.
- Administración / Configuración visual para proyectos, compradores, formas de pago y parámetros OC/OS.
- Estructura preparada para GitHub, sin archivos `.vscode` ni artefactos temporales.

Consulta `docs/ESTRUCTURA.md` para la organización de carpetas.
