import { db, auth } from './config.js';
import { 
    collection, onSnapshot, query, orderBy, doc, updateDoc, getDoc 
} from "./supabase-db-compat.js";
import { signOut, onAuthStateChanged } from "./supabase-auth-compat.js";
import { cargarConfiguracionDocumentos } from './document-config.js';
import { generarPDFOrden } from './pdf-order.js';

const tablaHistorial = document.getElementById('tablaHistorial');

// --- 1. SEGURIDAD Y VALIDACIÓN DE ROL ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        try {
            const userDoc = await getDoc(doc(db, "usuarios", user.uid));
            if (userDoc.exists()) {
                const rol = userDoc.data().rol.toLowerCase();
                console.log("Acceso verificado para historial:", rol);
            }
        } catch (error) {
            console.error("Error validando permisos:", error);
        }
    } else {
        window.location.href = '../index.html';
    }
});

// --- 2. ESCUCHA EN TIEMPO REAL ---
function iniciarEscuchaHistorial() {
    const q = query(collection(db, "ordenesCompra"), orderBy("createdAt", "desc"));
    onSnapshot(q, (snapshot) => {
        renderizarTabla(snapshot);
        aplicarFiltros(); 
    }, (error) => {
        console.error("Error en tiempo real:", error);
    });
}

// --- 3. RENDERIZADO DE LA TABLA ---
function renderizarTabla(snapshot) {
    if (!tablaHistorial) return;
    tablaHistorial.innerHTML = "";

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    snapshot.forEach((docSnap) => {
        const d = docSnap.data();
        const id = docSnap.id;
        const fila = document.createElement('tr');

        const estadoSolped = d.estadoSolped || 'PENDIENTE';
        const estadoPago = d.estadoPago || 'PENDIENTE';
        const formaPago = d.proveedor?.pago || '---';
        const tieneFacturaAdjunta = !!d.facturaPdfBase64;
        
        const colorSolped = estadoSolped === 'ENVIADA' ? 'btn-success' : (estadoSolped === 'ANULADA' ? 'btn-danger' : 'btn-warning');
        const colorPago = estadoPago === 'PAGO REALIZADO' ? 'btn-primary' : 'btn-secondary';
        
        const facturaValue = d.factura || '';
        const solpedCodeValue = d.codigoSolped || '';
        const simb = d.moneda || 'S/';

        // --- LÓGICA DE ALERTA DE VENCIMIENTO (3 DÍAS ANTES) ---
        let alertaVencimiento = "";
        if (d.fechaVencimiento && estadoPago !== 'PAGO REALIZADO') {
            const fVenc = new Date(d.fechaVencimiento + "T00:00:00");
            const diffTime = fVenc - hoy;
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            
            if (diffDays <= 3) {
                alertaVencimiento = "color: red; font-weight: bold;";
            }
        }

        fila.innerHTML = `
            <td class="fw-bold">${d.nroOC || 'S/N'}</td>
            <td class="fw-bold text-primary small">${formaPago}</td>
            <td>
                <div class="d-flex align-items-center gap-1 justify-content-center">
                    <input type="text" class="form-control form-control-sm text-center input-editable" 
                        value="${facturaValue}" 
                        data-id="${id}" data-campo="factura"
                        placeholder="Factura" ${facturaValue !== '' ? 'disabled' : ''} style="width: 100px;">
                    
                    <button class="btn btn-sm p-0 border-0 btn-adjuntar-base64" data-id="${id}" title="${tieneFacturaAdjunta ? 'Ver Factura Adjunta' : 'Adjuntar Factura'}">
                        <i class="bi ${tieneFacturaAdjunta ? 'bi-file-earmark-check-fill text-primary' : 'bi-paperclip text-secondary'} h5"></i>
                    </button>
                </div>
            </td>
            <td>${d.fechaEmision || '---'}</td>
            <td class="small">${d.nroCotizacion || '---'}</td>
            <td style="${alertaVencimiento}">${d.fechaVencimiento || '---'}</td>
            <td class="text-start">${d.proveedor?.razonSocial || '---'}</td>
            <td>${(d.comprador?.proyecto || '---').toUpperCase()}</td>
            <td>
                <input type="text" class="form-control form-control-sm text-center input-editable" 
                    value="${solpedCodeValue}" 
                    data-id="${id}" data-campo="codigoSolped"
                    placeholder="Código" ${solpedCodeValue !== '' ? 'disabled' : ''}>
            </td>
            <td>
                <button class="btn btn-sm ${colorSolped} w-100 btn-estado" data-id="${id}" data-campo="estadoSolped" data-valor="${estadoSolped}" ${estadoSolped !== 'PENDIENTE' ? 'disabled' : ''}>${estadoSolped}</button>
            </td>
            <td>
                <button class="btn btn-sm ${colorPago} w-100 btn-estado" data-id="${id}" data-campo="estadoPago" data-valor="${estadoPago}" ${estadoPago !== 'PENDIENTE' ? 'disabled' : ''}>${estadoPago}</button>
            </td>
            <td class="fw-bold">${simb} ${d.total || '0.00'}</td>
            <td>
                <div class="btn-group">
                    <button class="btn btn-sm btn-outline-primary btn-pdf" data-id="${id}" data-accion="ver"><i class="bi bi-eye"></i></button>
                    <button class="btn btn-sm btn-outline-success btn-pdf" data-id="${id}" data-accion="descargar"><i class="bi bi-download"></i></button>
                    <button class="btn btn-sm btn-outline-danger btn-anular" data-id="${id}"><i class="bi bi-x-circle"></i></button>
                </div>
            </td>
        `;
        tablaHistorial.appendChild(fila);
    });
}

// --- 4. LÓGICA PARA ADJUNTAR / VER FACTURA ---
tablaHistorial.addEventListener('click', async (e) => {
    const btnAdjuntar = e.target.closest('.btn-adjuntar-base64');
    if (!btnAdjuntar) return;

    const id = btnAdjuntar.dataset.id;
    const docRef = doc(db, "ordenesCompra", id);
    const docSnap = await getDoc(docRef);
    const data = docSnap.data();

    if (data.facturaPdfBase64) {
        const win = window.open();
        win.document.write(`<iframe src="${data.facturaPdfBase64}" frameborder="0" style="border:0; top:0px; left:0px; bottom:0px; right:0px; width:100%; height:100%;" allowfullscreen></iframe>`);
    } else {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'application/pdf';
        input.onchange = async () => {
            const file = input.files[0];
            if (!file) return;
            if (file.size > 1000000) return alert("El archivo es muy pesado. Máximo 1MB.");
            btnAdjuntar.innerHTML = `<span class="spinner-border spinner-border-sm text-primary"></span>`;
            const reader = new FileReader();
            reader.onload = async (event) => {
                const base64String = event.target.result;
                try {
                    await updateDoc(docRef, { facturaPdfBase64: base64String });
                    alert("✅ Factura adjuntada con éxito.");
                } catch (err) {
                    console.error(err);
                    alert("Error al guardar la factura.");
                    renderizarTabla();
                }
            };
            reader.readAsDataURL(file);
        };
        input.click();
    }
});

// --- 5. PDF DE OC: usa la plantilla actual con términos configurables ---

// --- EVENTOS Y FILTROS ---
tablaHistorial.addEventListener('click', async (e) => {
    const target = e.target.closest('button');
    if (!target) return;
    if (target.classList.contains('btn-adjuntar-base64')) return;

    const { id, campo, valor, accion } = target.dataset;

    if (target.classList.contains('btn-estado')) {
        if (valor !== 'PENDIENTE') return;
        let nuevoValor = campo === 'estadoSolped' ? 'ENVIADA' : (campo === 'estadoPago' ? 'PAGO REALIZADO' : '');
        if (nuevoValor) await updateDoc(doc(db, "ordenesCompra", id), { [campo]: nuevoValor });
    }

    if (target.classList.contains('btn-pdf')) {
        const docSnap = await getDoc(doc(db, "ordenesCompra", id));
        if (docSnap.exists()) {
            const orden = docSnap.data();
            if (!orden.terminosCondiciones || !orden.documentacionObligatoria || !orden.empresa) {
                const config = await cargarConfiguracionDocumentos();
                await generarPDFOrden({
                    ...orden,
                    empresa: orden.empresa || config.empresa,
                    documentacionObligatoria: orden.documentacionObligatoria || config.documentacionObligatoria,
                    terminosCondiciones: orden.terminosCondiciones || config.terminosCondiciones
                }, accion);
            } else {
                await generarPDFOrden(orden, accion);
            }
        }
    }

    if (target.classList.contains('btn-anular')) {
        if (confirm("¿Seguro que desea ANULAR esta orden?")) {
            await updateDoc(doc(db, "ordenesCompra", id), {
                estadoSolped: "ANULADA", total: "0.00", subtotal: "0.00", igv: "0.00"
            });
        }
    }
});

tablaHistorial.addEventListener('keypress', async (e) => {
    if (e.target.classList.contains('input-editable') && e.key === 'Enter') {
        const id = e.target.dataset.id;
        const campo = e.target.dataset.campo;
        const valor = e.target.value.trim();

        if (valor === "") return;

        try {
            const docRef = doc(db, "ordenesCompra", id);
            await updateDoc(docRef, { [campo]: valor });
            e.target.disabled = true;
            alert(`✅ ${campo.toUpperCase()} guardado correctamente.`);
        } catch (error) {
            console.error("Error al guardar:", error);
            alert("❌ Error al guardar el dato.");
        }
    }
});

function aplicarFiltros() {
    const term = document.getElementById('busqueda').value.toLowerCase();
    const proyecto = document.getElementById('filtroProyecto').value.toUpperCase();
    const solped = document.getElementById('filtroSolped').value;
    const pago = document.getElementById('filtroPago').value;
    
    // Filtros de fecha
    const fechaDesde = document.getElementById('fechaDesde').value;
    const fechaHasta = document.getElementById('fechaHasta').value;

    const filas = tablaHistorial.querySelectorAll('tr');

    filas.forEach(fila => {
        const textoFila = fila.innerText.toLowerCase();
        const valorProyecto = fila.cells[7].innerText.toUpperCase();
        const valorVencimiento = fila.cells[5].innerText; // Columna Vencimiento

        const coincideBusqueda = textoFila.includes(term);
        const coincideProyecto = proyecto === "" || valorProyecto === proyecto;
        const coincideSolped = solped === "" || fila.querySelector('[data-campo="estadoSolped"]').innerText.trim() === solped;
        const coincidePago = pago === "" || fila.querySelector('[data-campo="estadoPago"]').innerText.trim() === pago;
        
        // Lógica de rango de fechas
        let coincideFecha = true;
        if (fechaDesde || fechaHasta) {
            if (valorVencimiento === '---') {
                coincideFecha = false;
            } else {
                const dateVenc = new Date(valorVencimiento + "T00:00:00");
                if (fechaDesde && dateVenc < new Date(fechaDesde + "T00:00:00")) coincideFecha = false;
                if (fechaHasta && dateVenc > new Date(fechaHasta + "T00:00:00")) coincideFecha = false;
            }
        }

        fila.style.display = (coincideBusqueda && coincideProyecto && coincideSolped && coincidePago && coincideFecha) ? '' : 'none';
    });
}

// --- BOTÓN LIMPIAR ---
document.getElementById('btnLimpiarFiltros').addEventListener('click', () => {
    document.getElementById('busqueda').value = "";
    document.getElementById('filtroProyecto').value = "";
    document.getElementById('filtroSolped').value = "";
    document.getElementById('filtroPago').value = "";
    document.getElementById('fechaDesde').value = "";
    document.getElementById('fechaHasta').value = "";
    aplicarFiltros();
});

document.getElementById('busqueda').addEventListener('input', aplicarFiltros);
document.getElementById('filtroProyecto').addEventListener('change', aplicarFiltros);
document.getElementById('filtroSolped').addEventListener('change', aplicarFiltros);
document.getElementById('filtroPago').addEventListener('change', aplicarFiltros);
document.getElementById('fechaDesde').addEventListener('change', aplicarFiltros);
document.getElementById('fechaHasta').addEventListener('change', aplicarFiltros);

document.getElementById('btnExportarExcel').onclick = function() {
    const filas = tablaHistorial.querySelectorAll('tr');
    const datosExcel = [];
    filas.forEach(f => {
        if (f.style.display !== 'none') {
            const tds = f.querySelectorAll('td');
            const ins = f.querySelectorAll('input');
            const btns = f.querySelectorAll('button');
            datosExcel.push({
                "N° ORDEN": tds[0].innerText,
                "PAGO": tds[1].innerText,
                "FACTURA": ins[0].value,
                "FECHA": tds[3].innerText,
                "COTIZACION": tds[4].innerText,
                "VENCIMIENTO": tds[5].innerText,
                "PROVEEDOR": tds[6].innerText,
                "PROYECTO": tds[7].innerText,
                "COD. SOLPED": ins[1].value,
                "ESTADO SOLPED": btns[0].innerText,
                "ESTADO PAGO": btns[1].innerText,
                "TOTAL": tds[11].innerText
            });
        }
    });
    const ws = XLSX.utils.json_to_sheet(datosExcel);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Historial");
    XLSX.writeFile(wb, "Historial_QATA.xlsx");
};

async function cargarFiltrosConfigurables() {
    try {
        const config = await cargarConfiguracionDocumentos();
        const select = document.getElementById('filtroProyecto');
        if (select) {
            select.innerHTML = '<option value="">TODOS</option>' + (config.proyectos || [])
                .map(p => `<option value="${p.nombre}">${p.nombre}</option>`).join('');
        }
    } catch (error) {
        console.warn('No se pudieron cargar proyectos configurables en el historial.', error);
    }
}

cargarFiltrosConfigurables().then(() => iniciarEscuchaHistorial());