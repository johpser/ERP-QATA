# Permisos por usuario — QATA ERP

## Plantillas por rol

- **Administrador principal:** acceso total.
- **Comprador:** acceso a todo excepto Administración / Configuración.
- **Administrador de Obra:** Generar Requerimiento, Historial de Requerimientos, Historial de Guías, Historial de OS y Productos.

## Personalización

En **Administración / Configuración → Usuarios, roles y módulos** el Administrador principal puede seleccionar un usuario, elegir el rol base y marcar/desmarcar módulos.

El rol carga automáticamente su plantilla predeterminada. Luego los módulos seleccionados quedan guardados para ese usuario.

## Seguridad

Los permisos se aplican en dos niveles:

1. Menú/interfaz: solo se muestran los módulos habilitados.
2. Supabase/RLS: se impide leer o modificar datos de módulos no autorizados aunque se intente entrar por URL directa.

Los módulos de historial sin su módulo de creación quedan en modo de consulta cuando corresponde.
