import { auth, db } from './config.js';
import { doc, getDoc } from './supabase-db-compat.js';
import { onAuthStateChanged } from './supabase-auth-compat.js';

const PERMISOS = {
    admin: new Set([
        'guia.html','historial_reque.html','historial.html','historial2.html','requerimiento.html',
        'orden.html','orden_servicio.html','historial_os.html','menu.html','panel_control.html',
        'productos.html','configuracion.html'
    ]),
    comprador: new Set([
        'requerimiento.html','historial_reque.html','orden.html','historial.html','orden_servicio.html',
        'historial_os.html','guia.html','historial2.html','productos.html','menu2.html'
    ]),
    admin_obra: new Set([
        'requerimiento.html','historial_reque.html','productos.html','historial.html','menu2.html'
    ])
};

function paginaActual() {
    return window.location.pathname.split('/').pop() || 'index.html';
}

function destinoRol(rol) {
    return rol === 'admin' ? 'menu.html' : 'menu2.html';
}

onAuthStateChanged(auth, async (user) => {
    const pagina = paginaActual();
    if (!user) {
        if (pagina !== 'index.html') window.location.href = '../index.html';
        return;
    }

    try {
        const snap = await getDoc(doc(db,'usuarios',user.uid));
        if (!snap.exists()) {
            alert('Tu usuario no tiene un perfil ERP asignado.');
            window.location.href = '../index.html';
            return;
        }

        const rol = String(snap.data().rol || '').toLowerCase();
        const permitidas = PERMISOS[rol];
        if (!permitidas || !permitidas.has(pagina)) {
            mostrarModalAcceso(() => {
                window.location.href = destinoRol(rol);
            });
        }
    } catch (error) {
        console.error('Error en el control de seguridad:', error);
    }
});

function mostrarModalAcceso(callback) {
    if (document.getElementById('modal-denegado')) return;
    const modal = document.createElement('div');
    modal.id = 'modal-denegado';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.72);display:flex;align-items:center;justify-content:center;z-index:10000;font-family:Segoe UI,sans-serif';
    modal.innerHTML = `
        <div style="background:white;padding:30px;border-radius:14px;text-align:center;width:min(360px,90vw);box-shadow:0 10px 30px rgba(0,0,0,.35)">
            <div style="font-size:48px;color:#dc3545;margin-bottom:8px"><i class="bi bi-shield-lock"></i></div>
            <h3 style="color:#333;margin-bottom:10px">Acceso restringido</h3>
            <p style="color:#666;font-size:14px">Tu rol no tiene permiso para entrar a este módulo.</p>
            <button id="btnCerrarModal" style="margin-top:14px;padding:10px 24px;background:#0d6efd;color:white;border:0;border-radius:7px;font-weight:700;cursor:pointer">Volver al inicio</button>
        </div>`;
    document.body.appendChild(modal);
    document.getElementById('btnCerrarModal').onclick = () => {
        modal.remove();
        callback?.();
    };
}
