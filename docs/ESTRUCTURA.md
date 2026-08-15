# Estructura del repositorio

```text
/
├── index.html
├── css/                       # Estilos
├── imagenes/                  # Recursos gráficos
├── js/                        # Lógica del ERP y adaptadores Supabase
│   ├── config.js              # URL + Publishable key de Supabase
│   ├── supabase-auth-compat.js
│   ├── supabase-db-compat.js
│   └── sequences.js           # Correlativos atómicos OC/OS/guía
├── page/                      # Pantallas del ERP
├── supabase/                  # Instalador SQL y guía rápida
├── docs/
├── .gitignore
└── .nojekyll
```

No se incluyen `node_modules`, archivos de Replit ni credenciales privadas.

## Permisos personalizados por usuario

El rol funciona como plantilla inicial, pero el Administrador principal puede personalizar los módulos de cada usuario desde Administración / Configuración.

Predeterminados:
- Administrador principal: todos los módulos.
- Comprador: todos los módulos excepto Administración / Configuración.
- Administrador de Obra: Generar Requerimiento, Historial de Requerimientos, Historial de Guías, Historial de OS y Productos.

Los permisos personalizados se guardan en el perfil `usuarios/{uid}` dentro de `qata_documents.data.modulos` y se aplican también mediante RLS en Supabase.
