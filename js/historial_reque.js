import { db, auth } from '../js/config.js';
import { 
    collection, onSnapshot, query, orderBy, doc, updateDoc, getDoc 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const tablaReq = document.getElementById('tablaHistorialReque');
const cuerpoModal = document.getElementById('cuerpoDetalleModal');
const modalSubtitulo = document.getElementById('modalSubtitulo');

let modalInstancia = null;
let idActual = "";

// --- 1. SEGURIDAD Y VALIDACIÓN DE ROL ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        try {
            const userDoc = await getDoc(doc(db, "usuarios", user.uid));
            if (userDoc.exists()) {
                const rol = userDoc.data().rol.toLowerCase();
                console.log("Acceso verificado para historial RQ:", rol);
            }
        } catch (error) {
            console.error("Error validando permisos:", error);
        }
    } else {
        window.location.href = '../index.html';
    }
});

function obtenerModal() {
    if (!modalInstancia) {
        const elementoModal = document.getElementById('modalDetalle');
        modalInstancia = new window.bootstrap.Modal(elementoModal);
    }
    return modalInstancia;
}

// --- 2. ESCUCHA EN TIEMPO REAL ---
function iniciarEscuchaRequerimientos() {
    const q = query(collection(db, "requerimientos"), orderBy("createdAt", "desc"));
    onSnapshot(q, (snapshot) => {
        renderizarTablaPrincipal(snapshot);
    }, (error) => {
        console.error("Error en Firebase:", error);
    });
}

// --- 3. RENDERIZADO DE TABLA PRINCIPAL ---
function renderizarTablaPrincipal(snapshot) {
    if (!tablaReq) return;
    tablaReq.innerHTML = "";
    if (snapshot.empty) {
        tablaReq.innerHTML = "<tr><td colspan='6' class='text-center'>No hay requerimientos registrados</td></tr>";
        return;
    }

    snapshot.forEach(docSnap => {
        const d = docSnap.data();
        const id = docSnap.id;
        
        let badgeClass = "bg-warning";
        if (d.estadoGeneral === 'COMPLETADO') badgeClass = "bg-success";
        if (d.estadoGeneral === 'PENDIENTE') badgeClass = "bg-secondary";
        if (d.estadoGeneral === 'ANULADO') badgeClass = "bg-danger";

        const fila = document.createElement('tr');
        fila.innerHTML = `
            <td>${d.fechaSolicitada || d.fecha || '---'}</td>
            <td class="fw-bold text-danger">${d.fechaRequerida || '---'}</td>
            <td>
                <div class="fw-bold text-primary">${(d.proyecto || '---').toUpperCase()}</div>
                <div class="small text-muted" style="font-size: 0.75rem;">${d.centroCosto || '---'}</div>
            </td>
            <td>${(d.solicitante || '---').toUpperCase()}</td>
            <td><span class="badge ${badgeClass}">${d.estadoGeneral || 'PENDIENTE'}</span></td>
            <td>
                <div class="btn-group">
                    <button class="btn btn-sm btn-outline-primary btn-ver" data-id="${id}">
                        <i class="bi bi-eye"></i> Ver
                    </button>
                    <button class="btn btn-sm btn-outline-danger btn-anular-req" data-id="${id}">
                        <i class="bi bi-x-circle"></i> Anular
                    </button>
                </div>
            </td>
        `;
        tablaReq.appendChild(fila);
    });
    aplicarFiltros();
}

// --- 4. EVENTOS DE CLIC (VER Y ANULAR) ---
document.addEventListener('click', async (e) => {
    const btnVer = e.target.closest('.btn-ver');
    if (btnVer) {
        idActual = btnVer.dataset.id;
        const snap = await getDoc(doc(db, "requerimientos", idActual));
        if (snap.exists()) {
            const data = snap.data();
            modalSubtitulo.innerText = `CENTRO DE COSTO: ${data.centroCosto || 'N/A'}`;
            renderModal(data.items || [], data.estadoGeneral);
            obtenerModal().show();
        }
    }

    const btnAnular = e.target.closest('.btn-anular-req');
    if (btnAnular) {
        const id = btnAnular.dataset.id;
        if (confirm("¿Está seguro de que desea ANULAR este requerimiento?")) {
            try {
                const snap = await getDoc(doc(db, "requerimientos", id));
                if (snap.exists()) {
                    const itemsAnulados = snap.data().items.map(item => ({
                        ...item,
                        estadoItem: "ANULADO"
                    }));
                    await updateDoc(doc(db, "requerimientos", id), {
                        items: itemsAnulados,
                        estadoGeneral: "ANULADO"
                    });
                }
            } catch (error) { console.error("Error al anular:", error); }
        }
    }
});

// --- 5. RENDERIZADO DEL MODAL ---
function renderModal(items, estadoGeneral) {
    if (!cuerpoModal) return;
    cuerpoModal.innerHTML = "";
    const esAnulado = estadoGeneral === "ANULADO";

    items.forEach((item, index) => {
        const ocValue = item.nroOC || "";
        const disabledOC = (ocValue !== "" || esAnulado) ? "disabled" : "";
        const disabledSelect = esAnulado ? "disabled" : "";

        let htmlObservacion = "";
        if (item.observacion && item.observacion.trim() !== "") {
            const obs = item.observacion.trim();
            const esLink = obs.toLowerCase().startsWith('http');

            htmlObservacion = esLink 
                ? `<div class="mt-1">
                    <a href="${obs}" target="_blank" class="btn btn-xs btn-outline-primary p-0 px-2" style="font-size: 10px; text-decoration: none;">
                        <i class="bi bi-link-45deg"></i> ABRIR LINK WEB
                    </a>
                   </div>`
                : `<div class="small text-muted mt-1" style="font-style: italic; font-size: 0.75rem;">
                    <strong>Obs:</strong> ${obs}
                   </div>`;
        }

        cuerpoModal.innerHTML += `
            <tr>
                <td class="text-center small">${item.partida || '---'}</td>
                <td class="text-center small">${item.codigo || '---'}</td>
                <td>
                    <div class="fw-bold" style="font-size: 0.85rem;">${item.descripcion || '---'}</div>
                    ${htmlObservacion}
                </td>
                <td class="text-center">${item.unidad || 'UND'}</td>
                <td class="text-center fw-bold">${item.cantidad || 0}</td>
                <td>
                    <input type="text" class="form-control form-control-sm inp-oc" 
                        value="${ocValue}" 
                        placeholder="Escribir OC..." 
                        data-index="${index}" ${disabledOC}>
                </td>
                <td>
                    <select class="form-select form-select-sm sel-estado" data-index="${index}" ${disabledSelect}>
                        <option value="PENDIENTE" ${item.estadoItem === 'PENDIENTE' ? 'selected' : ''}>PENDIENTE</option>
                        <option value="PENDIENTE DE ENVIO" ${item.estadoItem === 'PENDIENTE DE ENVIO' ? 'selected' : ''}>PENDIENTE DE ENVIO</option>
                        <option value="COTIZANDO" ${item.estadoItem === 'COTIZANDO' ? 'selected' : ''}>COTIZANDO</option>
                        <option value="ENTREGADO" ${item.estadoItem === 'ENTREGADO' ? 'selected' : ''}>ENTREGADO</option>
                        <option value="ANULADO" ${item.estadoItem === 'ANULADO' ? 'selected' : ''}>ANULADO</option>
                    </select>
                </td>
            </tr>
        `;
    });
}

// --- 6. ACTUALIZACIÓN DE ESTADOS DESDE EL MODAL ---
cuerpoModal?.addEventListener('change', async (e) => {
    if (!idActual) return;
    const snap = await getDoc(doc(db, "requerimientos", idActual));
    if (snap.data().estadoGeneral === "ANULADO") return;

    let items = snap.data().items;
    const index = e.target.dataset.index;

    if (e.target.classList.contains('inp-oc')) items[index].nroOC = e.target.value.toUpperCase().trim();
    if (e.target.classList.contains('sel-estado')) items[index].estadoItem = e.target.value;

    const todosTerminados = items.every(i => i.estadoItem === 'ENTREGADO' || i.estadoItem === 'ANULADO');
    const nuevoEstadoGeneral = todosTerminados ? "COMPLETADO" : "EN PROCESO";

    await updateDoc(doc(db, "requerimientos", idActual), { 
        items: items,
        estadoGeneral: nuevoEstadoGeneral
    });

    renderModal(items, nuevoEstadoGeneral); 
});

// --- 7. FILTROS ---
function aplicarFiltros() {
    const term = document.getElementById('busqueda').value.toLowerCase();
    const proyecto = document.getElementById('filtroProyecto').value.toUpperCase();
    const estado = document.getElementById('filtroEstado').value;
    const filas = tablaReq?.querySelectorAll('tr') || [];

    filas.forEach(fila => {
        if (fila.cells.length < 5) return;
        const textoFila = fila.innerText.toLowerCase();
        const valorProyecto = fila.cells[2].innerText.toUpperCase(); 
        const valorEstado = fila.cells[4].innerText.trim(); 

        const coincideBusqueda = textoFila.includes(term);
        const coincideProyecto = proyecto === "" || valorProyecto.includes(proyecto);
        const coincideEstado = estado === "" || valorEstado === estado;

        fila.style.display = (coincideBusqueda && coincideProyecto && coincideEstado) ? '' : 'none';
    });
}

document.getElementById('busqueda')?.addEventListener('input', aplicarFiltros);
document.getElementById('filtroProyecto')?.addEventListener('change', aplicarFiltros);
document.getElementById('filtroEstado')?.addEventListener('change', aplicarFiltros);
document.getElementById('btnLimpiarFiltros').onclick = () => {
    document.getElementById('busqueda').value = "";
    document.getElementById('filtroProyecto').value = "";
    document.getElementById('filtroEstado').value = "";
    aplicarFiltros();
};

iniciarEscuchaRequerimientos();