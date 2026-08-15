import { db, auth } from './config.js';
import { 
    collection, onSnapshot, query, orderBy, doc, getDoc, updateDoc 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const tablaHistorial = document.getElementById('tablaHistorialGuias');
const inputBusqueda = document.getElementById('busqueda');

// --- 1. SEGURIDAD Y CONTROL DE ACCESO ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        try {
            const userDoc = await getDoc(doc(db, "usuarios", user.uid));
            if (userDoc.exists()) {
                const rol = userDoc.data().rol.toLowerCase();
                console.log("Acceso verificado para:", rol);
            }
        } catch (error) {
            console.error("Error validando sesión:", error);
        }
    } else {
        window.location.href = '../index.html';
    }
});

// --- 2. ESCUCHA EN TIEMPO REAL ---
function iniciarEscuchaHistorial() {
    const q = query(collection(db, "guiasRemision"), orderBy("createdAt", "desc"));
    
    onSnapshot(q, (snapshot) => {
        renderizarTabla(snapshot);
    }, (error) => {
        console.error("Error en tiempo real:", error);
    });
}

// --- 3. RENDERIZADO DE TABLA EN PANTALLA ---
function renderizarTabla(snapshot) {
    if (!tablaHistorial) return;
    tablaHistorial.innerHTML = "";

    snapshot.forEach((docSnap) => {
        const d = docSnap.data();
        const id = docSnap.id;
        const fila = document.createElement('tr');

        const proyectoMayus = (d.comprador?.proyecto || '---').toUpperCase();
        const esAnulada = d.nroGR === "ANULADA";

        fila.innerHTML = `
            <td class="fw-bold ${esAnulada ? 'text-danger' : 'text-success'}">${d.nroGR || 'S/N'} ${esAnulada ? '(X)' : ''}</td>
            <td>${d.nroOC || 'ALMACÉN'}</td>
            <td>${d.fechaTraslado || d.fechaEmision || '---'}</td>
            <td class="text-start">${d.proveedor?.razonSocial || '---'}</td>
            <td>${proyectoMayus}</td>
            <td class="small">${d.comprador?.lugarEntrega || '---'}</td>
            <td>
                <div class="btn-group align-items-center gap-1">
                    <button class="btn btn-sm btn-outline-primary btn-pdf" data-id="${id}" data-accion="ver" title="Ver Guía">
                        <i class="bi bi-eye"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-success btn-pdf" data-id="${id}" data-accion="descargar" title="Descargar Guía">
                        <i class="bi bi-download"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-danger btn-anular" data-id="${id}" ${esAnulada ? 'disabled' : ''} title="Anular Guía">
                        <i class="bi bi-trash"></i>
                    </button>
                </div>
            </td>
        `;
        tablaHistorial.appendChild(fila);
    });
}

// --- 4. LÓGICA ANULAR GUÍA ---
document.addEventListener('click', async (e) => {
    const btn = e.target.closest('.btn-anular');
    if (!btn) return;

    const id = btn.dataset.id;

    if (confirm("¿Estás seguro de que deseas ANULAR esta Guía de Remisión?")) {
        try {
            const docRef = doc(db, "guiasRemision", id);
            await updateDoc(docRef, {
                nroGR: "ANULADA",
                items: [] 
            });
            alert("✅ Guía anulada correctamente.");
        } catch (err) {
            console.error("Error al anular:", err);
            alert("Error al intentar anular la guía.");
        }
    }
});

// --- 5. GENERACIÓN DE PDF (Ajustado para que el código no deforme el cuadro) ---
async function generarPDF_Guia_Historial(data, modo) {
    const element = document.createElement('div');
    element.innerHTML = `
        <div style="padding: 10mm; font-family: 'Segoe UI', Arial, sans-serif; color: #333; background: #fff;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <div style="width: 25%;">
                    <img src="../imagenes/LOGOQATA.png" style="width: 140px;">
                </div>
                <div style="width: 45%; text-align: center; font-size: 11px; line-height: 1.4;">
                    <h3 style="margin: 0; font-size: 16px;">QATA ASOCIADOS S.A.C.</h3>
                    <p style="margin: 0;">Av. Camino Real 1236, San Isidro - Lima</p>
                    <p style="margin: 0;">RUC: 20605226362</p>
                </div>
                <div style="width: 30%; border: 2.5px solid #000; text-align: center; padding: 12px; border-radius: 10px; background: #f0f7ff;">
                    <h5 style="margin: 0; font-size: 13px;">RUC: 20605226362</h5>
                    <h4 style="margin: 5px 0; font-size: 15px;">GUÍA DE REMISIÓN</h4>
                    <h3 style="margin: 0; color: #dc3545; font-size: 18px;">${data.nroGR}</h3>
                </div>
            </div>

            <div style="border: 1px solid #ddd; border-radius: 6px; overflow: hidden; margin-bottom: 20px;">
                <div style="background: #007bff; color: white; padding: 6px 10px; font-weight: bold; font-size: 12px;">INFORMACIÓN DEL TRASLADO</div>
                <div style="padding: 12px; font-size: 11px; display: flex; justify-content: space-between; gap: 20px; line-height: 1.6;">
                    <div style="flex: 1;"><b style="color:#007bff;">DESTINO / PROYECTO:</b><br>${(data.comprador?.proyecto || '---').toUpperCase()}</div>
                    <div style="flex: 1;"><b style="color:#007bff;">PUNTO PARTIDA:</b><br>${data.proveedor?.direccion || 'ALMACÉN CENTRAL'}</div>
                    <div style="flex: 1;"><b style="color:#007bff;">PUNTO LLEGADA:</b><br>${(data.comprador?.lugarEntrega || '---').toUpperCase()}</div>
                </div>
            </div>

            <table style="width: 100%; border-collapse: collapse; font-size: 11px; table-layout: fixed;">
                <thead>
                    <tr style="background: #212529; color: white;">
                        <th style="padding: 10px; border: 1px solid #333; width: 15%;">Cód.</th>
                        <th style="padding: 10px; border: 1px solid #333; text-align: left; width: 55%;">Descripción</th>
                        <th style="padding: 10px; border: 1px solid #333; width: 15%;">Und.</th>
                        <th style="padding: 10px; border: 1px solid #333; width: 15%;">Cant.</th>
                    </tr>
                </thead>
                <tbody>
                    ${data.items.map(i => `
                        <tr>
                            <td style="border:1px solid #ddd; padding:8px; text-align:center; font-size: 9px; word-break: break-all;">${i.codigo}</td>
                            <td style="border:1px solid #ddd; padding:8px;">${i.desc || i.descripcion}</td>
                            <td style="border:1px solid #ddd; padding:8px; text-align:center;">${i.unidad}</td>
                            <td style="border:1px solid #ddd; padding:8px; text-align:center; font-weight:bold;">${i.cant || i.cantidad}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>

            <div style="margin-top: 10px; display: flex; gap: 15px; page-break-inside: avoid;">
                <div style="flex: 1; border: 1px solid #333; border-radius: 12px; padding: 15px; font-size: 11px; text-align: center;">
                    <div style="text-align: justify; line-height: 1.4;">Para constancia de que se recibe los productos/servicios antes mencionados a entera satisfacción firma el receptor.</div>
                </div>
                <div style="flex: 1; border: 1px solid #333; border-radius: 12px; padding: 15px; font-size: 10.5px; text-align: center;">
                    <div style="text-align: left; line-height: 1.2;color: #dc3545;">Nota: Tener en cuenta que cualquier material dañado, no devuelto o entregado en un plazo de dos días hábiles a partir de la fecha de esta constancia será sujeto a un cargo en su correspondiente pago.</div>
                </div>
            </div>
            <div style="margin-top: 90px; display:flex; justify-content:center; text-align:center; font-size:11px;">
                <div style="border-top:1px solid #333; width:250px; padding-top:8px;"><b>RECEPCIONADO</b><br>Nombre / DNI / Firma</div>
            </div>
        </div>`;

    const opt = {
        margin: 0,
        filename: `${data.nroGR}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 3, useCORS: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    if (modo === 'ver') {
        html2pdf().set(opt).from(element).outputPdf('bloburl').then(url => { window.open(url, '_blank'); });
    } else {
        html2pdf().set(opt).from(element).save();
    }
}

// --- 6. EVENTOS DE BOTONES PDF ---
document.addEventListener('click', async (e) => {
    const btn = e.target.closest('.btn-pdf');
    if (!btn) return;

    const { id, accion } = btn.dataset;
    try {
        const docSnap = await getDoc(doc(db, "guiasRemision", id));
        if (docSnap.exists()) {
            generarPDF_Guia_Historial(docSnap.data(), accion);
        }
    } catch (err) {
        console.error("Error al obtener guía:", err);
    }
});

// --- 7. BUSCADOR ---
if (inputBusqueda) {
    inputBusqueda.oninput = function() {
        const term = this.value.toLowerCase();
        const filas = tablaHistorial.querySelectorAll('tr');
        filas.forEach(f => f.style.display = f.innerText.toLowerCase().includes(term) ? '' : 'none');
    };
}

// --- 8. EXCEL ---
const btnExcel = document.getElementById('btnExportarExcel');
if (btnExcel) {
    btnExcel.onclick = function() {
        const filas = tablaHistorial.querySelectorAll('tr');
        const datosExcel = [];
        filas.forEach(f => {
            if (f.style.display !== 'none') {
                const tds = f.querySelectorAll('td');
                datosExcel.push({
                    "GUÍA": tds[0].innerText,
                    "OC": tds[1].innerText,
                    "FECHA": tds[2].innerText,
                    "PROVEEDOR": tds[3].innerText,
                    "PROYECTO": tds[4].innerText.toUpperCase()
                });
            }
        });
        const ws = XLSX.utils.json_to_sheet(datosExcel);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Guias");
        XLSX.writeFile(wb, "Historial_Guias_QATA.xlsx");
    };
}

// --- 9. LOGOUT ---
document.getElementById('btnCerrarSesion')?.addEventListener('click', async (e) => {
    e.preventDefault();
    try {
        await signOut(auth);
        window.location.href = '../index.html';
    } catch (error) {
        console.error("Error al cerrar sesión:", error);
    }
});

iniciarEscuchaHistorial();