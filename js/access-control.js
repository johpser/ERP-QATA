// Control central de módulos y permisos del ERP QATA.
// El rol define una plantilla predeterminada; el campo `modulos` del perfil permite
// agregar o quitar módulos por usuario desde Administración / Configuración.

export const MODULOS = [
    { key:'dashboard', href:'panel_control.html', icon:'bi-speedometer2', label:'Panel de Control' },
    { key:'rq_create', href:'requerimiento.html', icon:'bi-plus-circle', label:'Generar RQ' },
    { key:'rq_history', href:'historial_reque.html', icon:'bi-archive', label:'Historial RQ' },
    { key:'products', href:'productos.html', icon:'bi-box-seam', label:'Productos' },
    { key:'oc_create', href:'orden.html', icon:'bi-cart', label:'Generar OC' },
    { key:'oc_history', href:'historial.html', icon:'bi-clipboard-data', label:'Historial OC' },
    { key:'os_create', href:'orden_servicio.html', icon:'bi-tools', label:'Generar OS' },
    { key:'os_history', href:'historial_os.html', icon:'bi-clock-history', label:'Historial OS' },
    { key:'guide_create', href:'guia.html', icon:'bi-truck', label:'Generar Guía' },
    { key:'guide_history', href:'historial2.html', icon:'bi-receipt', label:'Historial Guías' },
    { key:'admin_config', href:'configuracion.html', icon:'bi-sliders', label:'Administración / Configuración' }
];

export const ALL_MODULE_KEYS = MODULOS.map(m => m.key);

export const ROLE_DEFAULT_MODULES = {
    admin: [...ALL_MODULE_KEYS],
    comprador: ALL_MODULE_KEYS.filter(k => k !== 'admin_config'),
    admin_obra: ['rq_create','rq_history','guide_history','os_history','products']
};

export const PAGE_TO_MODULE = Object.fromEntries(MODULOS.map(m => [m.href, m.key]));

export function normalizarRol(rol='') {
    const r=String(rol||'').trim().toLowerCase();
    return r==='editor' ? 'admin_obra' : r;
}

export function nombreRol(rol='') {
    const r=normalizarRol(rol);
    return ({admin:'Administrador principal', comprador:'Comprador', admin_obra:'Administrador de Obra'})[r] || r || 'Sin rol';
}

export function modulosPredeterminados(rol='') {
    const r=normalizarRol(rol);
    return [...(ROLE_DEFAULT_MODULES[r] || [])];
}

export function modulosPorPerfil(perfil={}) {
    const rol=normalizarRol(perfil?.rol);
    if (rol==='admin') return [...ALL_MODULE_KEYS];
    const personalizados=Array.isArray(perfil?.modulos) ? perfil.modulos : null;
    const base=personalizados ?? modulosPredeterminados(rol);
    return [...new Set(base.map(String).filter(k => ALL_MODULE_KEYS.includes(k)))];
}

export function tieneModulo(perfil, modulo) {
    return modulosPorPerfil(perfil).includes(modulo);
}

export function modulosMenuPorPerfil(perfil={}) {
    const keys=new Set(modulosPorPerfil(perfil));
    return MODULOS.filter(m => keys.has(m.key));
}
