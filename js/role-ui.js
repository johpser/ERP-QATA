import { auth, db } from './config.js';
import { onAuthStateChanged } from './supabase-auth-compat.js';
import { doc, getDoc } from './supabase-db-compat.js';

export const ROLE_MODULES = {
    admin: [
        ['requerimiento.html','bi-plus-circle','Generar RQ'],
        ['historial_reque.html','bi-archive','Historial RQ'],
        ['orden.html','bi-cart','Generar OC'],
        ['historial.html','bi-clipboard-data','Historial OC'],
        ['orden_servicio.html','bi-tools','Generar OS'],
        ['historial_os.html','bi-clock-history','Historial OS'],
        ['guia.html','bi-truck','Generar Guía'],
        ['historial2.html','bi-receipt','Historial Guías'],
        ['productos.html','bi-box-seam','Productos'],
        ['configuracion.html','bi-sliders','Administración / Configuración']
    ],
    comprador: [
        ['requerimiento.html','bi-plus-circle','Generar RQ'],
        ['historial_reque.html','bi-archive','Historial RQ'],
        ['orden.html','bi-cart','Generar OC'],
        ['historial.html','bi-clipboard-data','Historial OC'],
        ['orden_servicio.html','bi-tools','Generar OS'],
        ['historial_os.html','bi-clock-history','Historial OS'],
        ['guia.html','bi-truck','Generar Guía'],
        ['historial2.html','bi-receipt','Historial Guías'],
        ['productos.html','bi-box-seam','Productos']
    ],
    admin_obra: [
        ['requerimiento.html','bi-plus-circle','Generar RQ'],
        ['historial_reque.html','bi-archive','Historial RQ'],
        ['productos.html','bi-box-seam','Catálogo de Productos'],
        ['historial.html','bi-clipboard-data','Historial OC']
    ]
};

export function nombreRol(rol) {
    return ({admin:'Administrador', comprador:'Comprador', admin_obra:'Administrador de Obra'})[rol] || rol;
}

export function menuHtml(rol) {
    const inicio = rol === 'admin' ? 'menu.html' : 'menu2.html';
    const items = ROLE_MODULES[rol] || [];
    return `
        <li><a class="dropdown-item" href="${inicio}"><i class="bi bi-house"></i> Inicio</a></li>
        <li><hr class="dropdown-divider"></li>
        ${items.map(([href,icon,label]) => `<li><a class="dropdown-item" href="${href}"><i class="bi ${icon}"></i> ${label}</a></li>`).join('')}
    `;
}

function aplicarMenuPersistente(rol) {
    const menu = document.getElementById('listaMenuDinamico');
    if (!menu) return;
    const html = menuHtml(rol);
    let aplicando = false;
    const aplicar = () => {
        if (aplicando || menu.innerHTML === html) return;
        aplicando = true;
        menu.innerHTML = html;
        aplicando = false;
    };
    aplicar();
    const obs = new MutationObserver(() => aplicar());
    obs.observe(menu, {childList:true, subtree:true, characterData:true});
}

onAuthStateChanged(auth, async (user) => {
    if (!user) return;
    try {
        const snap = await getDoc(doc(db,'usuarios',user.uid));
        if (!snap.exists()) return;
        const rol = String(snap.data().rol || '').toLowerCase();
        document.documentElement.dataset.qataRole = rol;
        document.body?.setAttribute('data-qata-role', rol);
        aplicarMenuPersistente(rol);
        document.dispatchEvent(new CustomEvent('qata-role-ready', {detail:{rol}}));
    } catch (error) {
        console.error('No se pudo aplicar el menú por rol.', error);
    }
});
