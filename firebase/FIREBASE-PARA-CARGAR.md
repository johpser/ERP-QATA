# Firebase — datos y ajustes necesarios

Este proyecto utiliza el mismo Firebase ya configurado en `js/config.js`. No necesitas crear otra base si vas a continuar con el proyecto existente.

## 1. Documento de configuración

En **Cloud Firestore**, usa la colección `configuracion` y el documento `documentos`. El contenido completo de referencia está en:

- `firebase/configuracion-documentos.json`

También puedes entrar al sistema como administrador, abrir **Administración / Configuración** y pulsar **Cargar valores iniciales** → **Guardar configuración**. Ese método escribe el documento con la estructura que entiende el ERP. La configuración usa `configVersion: 2`; al detectar una versión anterior, el sistema aplica automáticamente las nuevas condiciones y asegura que CAMBRIDGE exista en la lista de proyectos.

Importante: la versión nueva elimina a Johpser Alejandro de la lista de compradores y migra automáticamente configuraciones antiguas para que no vuelva a aparecer. La lista inicial queda con Paul Aster, Dave Cardenas y Manuel Vega. Los datos de contacto de Manuel se dejan vacíos porque no se deben inventar; complétalos desde Administración cuando los tengas.

## 2. Correlativo de Orden de Servicio

Ruta: `config/contadorOS`

Si **nunca se emitió una OS en este Firebase**, puede iniciarse con:

```json
{
  "ultimoNumero": 0
}
```

No es obligatorio crear este documento manualmente: el sistema lo crea en la primera OS y genera `0000001D`, `0000002D`, etc. Si ya existen OS automáticas, **no lo reinicies**; coloca como `ultimoNumero` el número mayor ya utilizado para evitar duplicados.

## 3. Colección nueva de OS

Ruta: `ordenesServicio/{id-automatico}`

No crees documentos manuales. La colección se crea automáticamente al guardar la primera Orden de Servicio. Cada OS incluye proveedor, proyecto, clasificación, detalle de servicios, subtotal, IGV, total, SOLPED, centro de costos, datos de la primera hoja y una copia de los términos usados al momento de emisión.

## 4. Datos que NO debes reiniciar

Conserva los datos existentes en:

- `config/contadorOC`
- `config/contadorGuiaManual`
- `ordenesCompra`
- `guiasRemision`
- `requerimientos`
- `productos`
- `proveedores`
- `usuarios`

La actualización agrega funcionalidad; no requiere borrar esos documentos.

## 5. Usuarios y eliminación de Johpser Alejandro

El código ya no contiene a Johpser Alejandro como comprador. Si además existe como usuario real de acceso en Firebase, revisa:

1. **Authentication → Users**: elimina esa cuenta solo si corresponde al usuario que quieres retirar.
2. **Firestore → `usuarios/{UID}`**: elimina el documento del mismo UID para retirar también su rol del ERP.

No se incluye un UID ni correo en este paquete porque no se debe adivinar cuál cuenta de Firebase corresponde.

Para cada usuario que sí deba entrar al ERP, el documento `usuarios/{UID}` debe contener al menos:

```json
{ "rol": "admin" }
```

o:

```json
{ "rol": "editor" }
```

## 6. Reglas

No reemplaces reglas de Firestore que ya estén funcionando sin revisarlas. Deben permitir, según el rol, acceso a `configuracion`, `config`, `ordenesCompra`, `ordenesServicio`, `guiasRemision`, `requerimientos`, `productos`, `proveedores` y lectura del documento propio en `usuarios`.
