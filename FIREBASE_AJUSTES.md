# Firebase — ajustes para OC / OS

El proyecto ya usa Firebase Authentication y Cloud Firestore desde `js/config.js`. No hace falta crear otro proyecto de Firebase ni agregar otro servicio para que funcionen los cambios de OC / OS.

## Nuevos documentos/rutas usados

- `configuracion/documentos`
  - Guarda la configuración editable de empresa, proyectos, lugares de entrega, compradores, formas de pago, horario, documentación obligatoria y términos y condiciones.
  - Se crea/actualiza al pulsar **Guardar configuración** en `page/configuracion.html`.
- `config/contadorOS`
  - Contador correlativo para órdenes de servicio (`OS-0001`, `OS-0002`, ...).
  - Se crea automáticamente en la primera OS si las reglas permiten la transacción.
- `config/contadorOC`
  - Se conserva el contador existente de órdenes de compra.
- `ordenesCompra`
  - Sigue siendo la colección común del historial, ahora con `tipoDocumento` = `OC` u `OS` y `nroDocumento`.

## Reglas de Firestore

El ZIP original no contiene un archivo de reglas de Firestore, por lo que NO se reemplazó ninguna regla existente.

Debes verificar en Firebase que:

1. El usuario administrador pueda leer y escribir `configuracion/documentos`.
2. El administrador tenga el mismo permiso sobre `config/contadorOS` que ya tiene sobre `config/contadorOC`.
3. La colección `ordenesCompra` permita al rol administrador crear y leer OC/OS.
4. Los permisos se validen también en las reglas de Firestore, no solamente en el JavaScript del navegador.

Ejemplo orientativo para INTEGRAR dentro de tus reglas actuales (no pegar como reemplazo total sin revisar tus reglas existentes):

```text
match /configuracion/{docId} {
  allow read: if request.auth != null;
  allow write: if request.auth != null
    && get(/databases/$(database)/documents/usuarios/$(request.auth.uid)).data.rol == "admin";
}
```

Para `config/contadorOS`, replica exactamente el criterio de acceso que ya utilizas para `config/contadorOC`.

## Recomendación para facturas PDF

Actualmente el historial guarda la factura adjunta en Base64 dentro del documento de Firestore (`facturaPdfBase64`). Esto funciona para archivos pequeños, pero hace crecer mucho el documento y es una arquitectura frágil a futuro. Como mejora posterior, conviene guardar el PDF en Firebase Storage y almacenar en Firestore solamente su referencia/URL y metadatos.

## Seguridad

La aplicación comprueba el rol `admin` desde el navegador para ocultar o bloquear pantallas. Eso mejora la interfaz, pero la protección real debe estar en las reglas de Firestore. Un usuario no debe obtener permisos de escritura solo porque una página JavaScript lo permita.
