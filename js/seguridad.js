import { auth, db } from './config.js';
import { doc, getDoc } from './supabase-db-compat.js';
import { onAuthStateChanged } from './supabase-auth-compat.js';
import { PAGE_TO_MODULE, modulosPorPerfil, normalizarRol } from './access-control.js';

function paginaActual(){ return window.location.pathname.split('/').pop() || 'index.html'; }
function destinoPerfil(perfil={}){ return normalizarRol(perfil.rol)==='admin' ? 'menu.html' : 'menu2.html'; }

onAuthStateChanged(auth, async user => {
    const pagina=paginaActual();
    if (!user) {
        if (pagina!=='index.html') window.location.href='../index.html';
        return;
    }
    try {
        const snap=await getDoc(doc(db,'usuarios',user.uid));
        if (!snap.exists()) {
            mostrarModalAcceso('Tu usuario no tiene un perfil ERP asignado.',()=>window.location.href='../index.html');
            return;
        }
        const perfil=snap.data() || {};
        const rol=normalizarRol(perfil.rol);
        const modulos=new Set(modulosPorPerfil(perfil));

        // Menús raíz: menu.html es exclusivo del Administrador principal;
        // menu2.html es la portada dinámica de los demás usuarios.
        if (pagina==='menu.html' && rol!=='admin') {
            window.location.href='menu2.html'; return;
        }
        if (pagina==='menu2.html' && rol==='admin') {
            window.location.href='menu.html'; return;
        }
        if (pagina==='index.html' || pagina==='menu.html' || pagina==='menu2.html') return;

        const requerido=PAGE_TO_MODULE[pagina];
        if (requerido && !modulos.has(requerido)) {
            mostrarModalAcceso('Tu usuario no tiene habilitado este módulo.',()=>window.location.href=destinoPerfil(perfil));
        }
    } catch (error) {
        console.error('Error en el control de seguridad:',error);
    }
});

function mostrarModalAcceso(texto,callback) {
    if (document.getElementById('modal-denegado')) return;
    const modal=document.createElement('div');
    modal.id='modal-denegado';
    modal.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.72);display:flex;align-items:center;justify-content:center;z-index:10000;font-family:Segoe UI,sans-serif';
    modal.innerHTML=`<div style="background:white;padding:30px;border-radius:14px;text-align:center;width:min(380px,90vw);box-shadow:0 10px 30px rgba(0,0,0,.35)">
        <div style="font-size:48px;color:#dc3545;margin-bottom:8px"><i class="bi bi-shield-lock"></i></div>
        <h3 style="color:#333;margin-bottom:10px">Acceso restringido</h3>
        <p style="color:#666;font-size:14px">${texto}</p>
        <button id="btnCerrarModal" style="margin-top:14px;padding:10px 24px;background:#0d6efd;color:white;border:0;border-radius:7px;font-weight:700;cursor:pointer">Volver al inicio</button>
    </div>`;
    document.body.appendChild(modal);
    document.getElementById('btnCerrarModal').onclick=()=>{ modal.remove(); callback?.(); };
}
