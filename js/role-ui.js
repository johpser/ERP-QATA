import { auth, db } from './config.js';
import { onAuthStateChanged } from './supabase-auth-compat.js';
import { doc, getDoc } from './supabase-db-compat.js';
import { MODULOS, ROLE_DEFAULT_MODULES, modulosMenuPorPerfil, nombreRol, normalizarRol } from './access-control.js';

// Compatibilidad con código anterior que importaba ROLE_MODULES.
export const ROLE_MODULES = Object.fromEntries(
    Object.entries(ROLE_DEFAULT_MODULES).map(([rol, keys]) => [
        rol,
        MODULOS.filter(m => keys.includes(m.key)).map(m => [m.href,m.icon,m.label])
    ])
);
export { nombreRol };

export function menuHtml(perfil={}) {
    const rol=normalizarRol(perfil?.rol);
    const inicio=rol==='admin' ? 'menu.html' : 'menu2.html';
    const items=modulosMenuPorPerfil(perfil);
    return `
        <li><a class="dropdown-item" href="${inicio}"><i class="bi bi-house"></i> Inicio</a></li>
        <li><hr class="dropdown-divider"></li>
        ${items.map(m => `<li><a class="dropdown-item" href="${m.href}"><i class="bi ${m.icon}"></i> ${m.label}</a></li>`).join('')}
    `;
}

function aplicarMenuPersistente(perfil) {
    const menu=document.getElementById('listaMenuDinamico');
    if (!menu) return;
    const html=menuHtml(perfil);
    let aplicando=false;
    const aplicar=()=>{
        if (aplicando || menu.innerHTML===html) return;
        aplicando=true; menu.innerHTML=html; aplicando=false;
    };
    aplicar();
    new MutationObserver(aplicar).observe(menu,{childList:true,subtree:true,characterData:true});
}

onAuthStateChanged(auth, async user => {
    if (!user) return;
    try {
        const snap=await getDoc(doc(db,'usuarios',user.uid));
        if (!snap.exists()) return;
        const perfil=snap.data() || {};
        const rol=normalizarRol(perfil.rol);
        document.documentElement.dataset.qataRole=rol;
        document.body?.setAttribute('data-qata-role',rol);
        aplicarMenuPersistente(perfil);
        document.dispatchEvent(new CustomEvent('qata-role-ready',{detail:{rol,perfil}}));
    } catch (error) {
        console.error('No se pudo aplicar el menú por permisos.',error);
    }
});
