# Estructura del repositorio

```text
/
├── index.html                 # Login
├── css/                       # Estilos existentes
├── imagenes/                  # Logo, favicon, sello y fondos
├── js/                        # Lógica Firebase, OC, OS, requerimientos, guías, PDF
├── page/                      # Pantallas del ERP
│   ├── menu.html              # Menú administrador
│   ├── panel_control.html     # Panel de control
│   ├── requerimiento.html
│   ├── historial_reque.html
│   ├── orden.html             # OC: materiales / productos
│   ├── historial.html         # Historial OC
│   ├── orden_servicio.html    # OS independiente
│   ├── historial_os.html      # Historial OS independiente
│   ├── guia.html
│   ├── historial2.html
│   ├── productos.html
│   └── configuracion.html     # Administración / Configuración del sistema
├── firebase/                  # Datos de referencia para Firestore
├── docs/                      # Documentación técnica
├── .gitignore
└── .nojekyll                  # Compatible con GitHub Pages
```

La OC y la OS usan colecciones diferentes y no comparten historial. El módulo de requerimientos, catálogo y guías se conserva.
