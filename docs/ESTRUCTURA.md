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
