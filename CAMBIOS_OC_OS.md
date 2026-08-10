# Cambios realizados — OC / OS

## Orden de compra / servicio

- Se agregó selector **TIPO DE ORDEN**: OC u OS.
- OC usa correlativo `OC-0001...` y OS usa correlativo independiente `OS-0001...`.
- Ambos documentos se guardan en `ordenesCompra` con `tipoDocumento` y `nroDocumento`.
- Se mantiene `nroOC` por compatibilidad con registros/código anterior.
- El historial muestra y filtra OC / OS.
- La generación/visualización/descarga del PDF usa un solo diseño compartido.

## Cambridge

- Proyecto predeterminado: `CAMBRIDGE`.
- Lugar de entrega predeterminado: `Colegio Cambridge, Chorrillos Alameda De Los Molinos 728-730, Chorrillos`.
- Cambridge también se incorporó a requerimientos y guías.

## Forma de pago

- La etiqueta `PAGO` pasó a **FORMA DE PAGO**.
- El PDF incluye un recuadro visible con Forma de pago, Días crédito y Horario de recepción.
- Las formas de pago se pueden editar desde la pantalla administrativa.

## Términos y condiciones

- Se retiró la lista corta anterior de 10 términos.
- Se incorporó el texto largo suministrado para las OC / OS.
- Cada orden nueva guarda una copia de los términos vigentes al momento de emitirla.
- Las órdenes históricas que no tengan copia propia usan la configuración actual como respaldo al regenerar el PDF.

## Administración

Nueva pantalla: `page/configuracion.html`

Permite editar sin tocar código:
- datos de la empresa;
- proyectos y lugares de entrega;
- proyecto predeterminado;
- compradores/solicitantes;
- formas de pago;
- horario de recepción;
- documentación obligatoria;
- términos y condiciones.

La configuración se guarda en Firestore en `configuracion/documentos`.

## Corrección adicional

Antes, al registrar una orden, `app.js` también creaba automáticamente un registro en `guiasRemision`. Ese comportamiento se eliminó: la guía se crea únicamente desde el módulo de guías, evitando guías duplicadas o fantasma.
