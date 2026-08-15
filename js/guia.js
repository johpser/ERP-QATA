import { db, auth } from './config.js';
import { doc, getDoc, addDoc, collection, serverTimestamp } from './supabase-db-compat.js';
import { signOut, onAuthStateChanged } from "./supabase-auth-compat.js";
import { cargarConfiguracionDocumentos } from './document-config.js';
import { siguienteCorrelativo } from './sequences.js';

// --- MAESTROS PARA GUÍAS INDEPENDIENTES ---
let proyectosMaster = {
    "TORRE PRIMA": "Calle Chinchon 980, San Isidro",
    "GRID 154": "Calle Mario Valdivia 154, San Miguel",
    "WYNK": "Jr.Ucello 111, San Borja",
    "PISO 19A": "Av. EL Derby 2550, Santiago de Surco",
    "PISO 19B": "Av. EL Derby 2550, Santiago de Surco",
    "POSVENTA": "Av. Caminon Real 1236, San Isidro",
    "QUALITY": "Centro Comercial Puruchuco",
    "CORIL": "Av. EL Derby 2550, Santiago de Surco",
    "ADMIN": "Av. Caminon Real 1236, San Isidro",
    "CAJAMARCA": "MEGAPLAZA CAJAMARCA, Av. Bolognesi 1350, Cajamarca"
};

let itemsGuia = [];

// --- 1. SEGURIDAD Y ESTADO DE SESIÓN ---
onAuthStateChanged(auth, (user) => {
    if (!user) {
        window.location.href = '../index.html';
    } else {
        iniciarGuia();
    }
});

const iniciarGuia = async () => {
    try {
        const config = await cargarConfiguracionDocumentos();
        proyectosMaster = Object.fromEntries((config.proyectos || []).map(p => [p.nombre, p.direccion || '']));
        const select = document.getElementById('proyectoComp');
        if (select) {
            select.innerHTML = '<option value="">Seleccione...</option>' + (config.proyectos || []).map(p => `<option value="${p.nombre}">${p.nombre}</option>`).join('');
            const pred = config.proyectoPredeterminado || 'CAMBRIDGE';
            if ((config.proyectos || []).some(p => p.nombre === pred)) {
                select.value = pred;
                document.getElementById('lugarComp').value = proyectosMaster[pred] || '';
            }
        }
    } catch (error) {
        console.warn('No se pudieron cargar proyectos configurables para la guía.', error);
    }

    // A. Llenado automático de dirección por proyecto
    const selectProyecto = document.getElementById('proyectoComp');
    if (selectProyecto) {
        selectProyecto.addEventListener('change', (e) => {
            const direccion = proyectosMaster[e.target.value];
            document.getElementById('lugarComp').value = direccion || "";
        });
    }

    // B. Buscar producto por código (Llenado automático desde Supabase)
    const inputCodigo = document.getElementById('codigoProd');
    if (inputCodigo) {
        inputCodigo.addEventListener('blur', async (e) => {
            const cod = e.target.value.toUpperCase().trim();
            if (cod) {
                try {
                    const snap = await getDoc(doc(db, "productos", cod));
                    if (snap.exists()) {
                        document.getElementById('producto').value = snap.data().descripcion.toUpperCase();
                    }
                } catch (error) {
                    console.error("Error al buscar producto:", error);
                }
            }
        });
    }

    // C. Añadir productos a la tabla local
    const btnAnadir = document.getElementById('btnAnadir');
    if (btnAnadir) {
        btnAnadir.onclick = () => {
            const codigo = document.getElementById('codigoProd').value.toUpperCase();
            const desc = document.getElementById('producto').value.toUpperCase();
            const cant = parseFloat(document.getElementById('cantidad').value);
            const unidad = document.getElementById('unidadMedida').value;

            if (!desc || isNaN(cant) || cant <= 0) return alert("Complete descripción y cantidad válida.");

            itemsGuia.push({ codigo: codigo || "S/C", desc, cant, unidad });
            renderTablaGuia();
            
            // Limpiar campos y devolver foco
            ['codigoProd', 'producto', 'cantidad'].forEach(id => document.getElementById(id).value = '');
            document.getElementById('codigoProd').focus();
        };
    }

    // D. Botón Finalizar
    const btnFinalizar = document.getElementById('btnFinalizar');
    if (btnFinalizar) {
        btnFinalizar.onclick = finalizarGuia;
    }
};

// --- RENDERIZADO DE TABLA ---
function renderTablaGuia() {
    const tbody = document.getElementById('detalle');
    if (!tbody) return;
    tbody.innerHTML = "";

    itemsGuia.forEach((item, index) => {
        const fila = document.createElement('tr');
        fila.innerHTML = `
            <td>${item.codigo}</td>
            <td class="text-start">${item.desc}</td>
            <td>${item.unidad}</td>
            <td class="fw-bold">${item.cant}</td>
            <td><button class="btn btn-danger btn-sm" onclick="eliminarItemGuia(${index})"><i class="bi bi-trash"></i></button></td>
        `;
        tbody.appendChild(fila);
    });
}

window.eliminarItemGuia = (index) => {
    itemsGuia.splice(index, 1);
    renderTablaGuia();
};

// --- GUARDADO Y GENERACIÓN DE PDF ---
async function finalizarGuia() {
    if (itemsGuia.length === 0) return alert("Añada al menos un artículo.");
    
    const btn = document.getElementById('btnFinalizar');
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner-border spinner-border-sm"></span> PROCESANDO...`;

    try {
        // A. Obtener correlativo atómico configurado en Supabase
        const nroGR = await siguienteCorrelativo('GUIA');

        // B. Estructura de datos para Supabase
        const dataGuia = {
            nroGR,
            nroOC: "ALMACÉN", 
            fechaEmision: new Date().toLocaleDateString('es-PE'),
            proveedor: {
                razonSocial: "QATA ASOCIADOS S.A.C.",
                ruc: "20605226362",
                direccion: document.getElementById('dirProv').value
            },
            comprador: {
                proyecto: document.getElementById('proyectoComp').value,
                lugarEntrega: document.getElementById('lugarComp').value.toUpperCase()
            },
            items: [...itemsGuia],
            createdAt: serverTimestamp()
        };

        // C. Guardar en la colección
        await addDoc(collection(db, "guiasRemision"), dataGuia);
        
        // D. Generar PDF
        await generarPDFGuia_Template(dataGuia);

        alert("✅ Guía " + nroGR + " generada y descargada.");
        location.reload();

    } catch (e) {
        console.error(e);
        alert("Error al procesar la guía.");
        btn.disabled = false;
        btn.innerHTML = `<i class="bi bi-cloud-arrow-up"></i> GUARDAR GUÍA EN SISTEMA`;
    }
}

// --- FUNCIÓN DE IMPRESIÓN (DISEÑO ESTILO ORDEN DE COMPRA) ---
async function generarPDFGuia_Template(data) {
    const element = document.createElement('div');
    
    element.innerHTML = `
        <div style="padding: 10mm; font-family: 'Segoe UI', Arial, sans-serif; color: #333; background: #fff;">
            
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <div style="width: 25%;">
                    <img src="../imagenes/LOGOQATA.png" style="width: 140px;">
                </div>
                <div style="width: 45%; text-align: center; font-size: 11px; line-height: 1.4;">
                    <h3 style="margin: 0; color: #333; font-size: 16px;">QATA ASOCIADOS S.A.C.</h3>
                    <p style="margin: 0;">Av. Camino Real 1236, San Isidro - Lima</p>
                    <p style="margin: 0;">RUC: 20605226362 | Paster@grupoqata.pe</p>
                    <p style="margin: 0;">TLF: 957 254 498</p> 
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
                    <div style="flex: 1;">
                        <b style="color: #007bff;">DESTINO / PROYECTO:</b><br>
                        ${data.comprador.proyecto}
                    </div>
                    <div style="flex: 1;">
                        <b style="color: #007bff;">PUNTO PARTIDA:</b><br>
                        ${data.proveedor.direccion}
                    </div>
                    <div style="flex: 1;">
                        <b style="color: #007bff;">PUNTO LLEGADA:</b><br>
                        ${data.comprador.lugarEntrega}
                    </div>
                </div>
            </div>

            <table style="width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 30px; table-layout: fixed;">
                <thead>
                    <tr style="background: #212529; color: white; text-align: center;">
                        <th style="padding: 10px; border: 1px solid #333; width: 100px;">Cód.</th>
                        <th style="padding: 10px; border: 1px solid #333; text-align: left;">Descripción</th>
                        <th style="padding: 10px; border: 1px solid #333; width: 60px;">Und.</th>
                        <th style="padding: 10px; border: 1px solid #333; width: 60px;">Cant.</th>
                    </tr>
                </thead>
                <tbody>
                    ${data.items.map(i => `
                        <tr>
                            <td style="border: 1px solid #ddd; padding: 8px; text-align: center; color: #333; font-size: 8px; word-break: break-all;">${i.codigo}</td>
                            <td style="border: 1px solid #ddd; padding: 8px;">${i.desc}</td>
                            <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${i.unidad}</td>
                            <td style="border: 1px solid #ddd; padding: 8px; text-align: center; font-weight: bold;">${i.cant}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
            
            <div style="margin-top: 100px; display: flex; justify-content: center; text-align: center; font-size: 11px;">
                <div style="border-top: 1px solid #333; width: 250px; padding-top: 8px;">
                    <b>RECIBIDO POR EL PROYECTO</b><br>
                    <span style="color: #666;">Nombre / DNI / Firma</span>
                </div>
            </div>
        </div>`;

    const opt = {
        margin: 0,
        filename: `${data.nroGR}.pdf`,
        html2canvas: { scale: 3, useCORS: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    return html2pdf().set(opt).from(element).save();
}

// --- LÓGICA CERRAR SESIÓN ---
document.getElementById('btnCerrarSesion')?.addEventListener('click', async (e) => {
    e.preventDefault();
    try {
        await signOut(auth);
        window.location.href = '../index.html';
    } catch (error) {
        console.error("Error al cerrar sesión:", error);
    }
});