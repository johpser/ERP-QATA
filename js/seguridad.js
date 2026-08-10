import { auth, db } from './config.js';
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

/**
 * CONTROL DE SEGURIDAD Y ACCESO POR ROLES
 * Sistema Qata - 2026
 */
onAuthStateChanged(auth, async (user) => {
    // Obtenemos el nombre del archivo actual (ej: guia.html)
    const pathParts = window.location.pathname.split("/");
    const paginaActual = pathParts.pop() || "index.html";

    // 1. Verificación de sesión activa
    if (!user) {
        if (paginaActual !== "login.html" && paginaActual !== "index.html") {
            window.location.href = "../page/login.html";
        }
        return;
    }

    try {
        // 2. Obtención del rol desde Firestore
        const userRef = doc(db, "usuarios", user.uid);
        const userSnap = await getDoc(userRef);

        if (!userSnap.exists()) {
            console.error("Usuario no registrado en la base de datos.");
            return;
        }

        const rol = userSnap.data().rol.toLowerCase();

        // 3. Definición de permisos por página
        const paginasPermitidas = {
            admin: [
                "guia.html",
                "historial_reque.html",
                "historial.html",
                "historial2.html",
                "login.html",
                "requerimiento.html",
                "orden.html",
                "index.html",
                "menu.html",
                "configuracion.html"
            ],
            editor: [
                "requerimiento.html",
                "historial_reque.html",
                "login.html",
                "menu2.html"
            ]
        };

        const permitidas = paginasPermitidas[rol] || [];

        // 4. Bloqueo si la página no está en la lista de permitidas
        if (!permitidas.includes(paginaActual)) {
            mostrarModalAcceso(() => {
                // Redirección por defecto según el rol si intenta acceder a ruta prohibida
                const destino = (rol === 'admin') ? "menu.html" : "requerimiento.html";
                window.location.href = `../page/${destino}`;
            });
        }
    } catch (error) {
        console.error("Error en el control de seguridad:", error);
    }
});

/**
 * 🔥 MODAL DE ACCESO DENEGADO
 * Crea un aviso visual antes de redirigir al usuario
 */
function mostrarModalAcceso(callback) {
    // Evitar duplicados si ya existe un modal
    if (document.getElementById("modal-denegado")) return;

    const modal = document.createElement("div");
    modal.id = "modal-denegado";
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.7);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        font-family: 'Segoe UI', sans-serif;
    `;

    modal.innerHTML = `
        <div style="
            background: white;
            padding: 30px;
            border-radius: 12px;
            text-align: center;
            width: 320px;
            box-shadow: 0 10px 25px rgba(0,0,0,0.5);
        ">
            <div style="font-size: 50px; color: #d33; margin-bottom: 10px;">
                <i class="bi bi-exclamation-octagon"></i>
            </div>
            <h3 style="color:#333; margin-bottom: 10px;">Acceso Restringido</h3>
            <p style="color:#666; font-size: 14px;">Tu perfil no tiene permisos para acceder a este módulo.</p>
            <button id="btnCerrarModal" style="
                margin-top: 20px;
                padding: 10px 25px;
                background: #0d6efd;
                color: white;
                border: none;
                border-radius: 6px;
                font-weight: bold;
                cursor: pointer;
                transition: background 0.3s;
            ">Volver al Inicio</button>
        </div>
    `;

    document.body.appendChild(modal);

    document.getElementById("btnCerrarModal").onclick = () => {
        modal.remove();
        if (callback) callback();
    };
}