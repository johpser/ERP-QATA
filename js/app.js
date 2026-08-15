import { db, auth } from './config.js'; 
import { doc, getDoc, setDoc, addDoc, collection, serverTimestamp, getDocs } from './supabase-db-compat.js';
import { signOut, onAuthStateChanged } from "./supabase-auth-compat.js";
import { cargarConfiguracionDocumentos, DEFAULT_CONFIG_DOCUMENTOS } from './document-config.js';
import { siguienteCorrelativo } from './sequences.js';
import { generarPDFOrden } from './pdf-order.js';

// --- 1. SEGURIDAD Y CONTROL DE ACCESO ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        try {
            const userDoc = await getDoc(doc(db, "usuarios", user.uid));
            if (userDoc.exists()) {
                const rol = userDoc.data().rol.toLowerCase();
                // Bloqueo si no es admin e intenta acceder a orden.html
                if (rol !== "admin" && window.location.pathname.includes("orden.html")) {
                    window.location.href = "menu2.html";
                }
            }
        } catch (error) {
            console.error("Error validando permisos:", error);
        }
    } else {
        window.location.href = '../index.html';
    }
});

// --- 2. CONFIGURACIÓN MAESTRA (editable desde configuracion.html) ---
let configDocumentos = DEFAULT_CONFIG_DOCUMENTOS;
let compradoresMaster = {};
let proyectosMaster = {};

let productosTabla = [];
let listaMaestraProductos = []; // Almacena el catálogo de productos de Supabase en memoria

// --- 3. FUNCIONES DE CÁLCULO ---
const calcularVencimiento = () => {
    const fechaEmision = document.getElementById('fechaoc').value;
    const dias = parseInt(document.getElementById('diasCredito').value) || 0;
    
    if (fechaEmision) {
        const [y, m, d] = fechaEmision.split('-').map(Number);
        const fecha = new Date(y, m - 1, d);
        fecha.setDate(fecha.getDate() + dias);
        
        const vy = fecha.getFullYear();
        const vm = String(fecha.getMonth() + 1).padStart(2, '0');
        const vd = String(fecha.getDate()).padStart(2, '0');
        
        document.getElementById('fechaVencimiento').value = `${vy}-${vm}-${vd}`;
    }
};

const renderTabla = () => {
    const tbody = document.getElementById('detalle');
    if (!tbody) return;
    tbody.innerHTML = "";
    let subtotal = 0;
    const simb = document.getElementById('moneda').value || "S/";

    productosTabla.forEach((item, index) => {
        subtotal += item.total;
        tbody.innerHTML += `
            <tr>
                <td style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 130px; font-size: 11px;">${item.codigo}</td>
                <td style="word-break: break-word; min-width: 220px; text-align: left; line-height: 1.2;">${item.desc}</td>
                <td style="white-space: nowrap; text-align: center;">${item.unidad}</td>
                <td style="white-space: nowrap; text-align: center;">${item.cant}</td>
                <td style="white-space: nowrap; text-align: right;">${simb} ${item.precio.toFixed(2)}</td>
                <td style="white-space: nowrap; text-align: right; font-weight: bold;">${simb} ${item.total.toFixed(2)}</td>
                <td style="text-align: center;">
                    <button class="btn btn-danger btn-sm" onclick="eliminarProducto(${index})"><i class="bi bi-trash"></i></button>
                </td>
            </tr>`;
    });

    const igv = subtotal * 0.18;
    const total = subtotal + igv;
    document.querySelectorAll('.simbolo-moneda').forEach(el => el.innerText = simb);
    document.getElementById('subtotalTxt').innerText = subtotal.toFixed(2);
    document.getElementById('igvTxt').innerText = igv.toFixed(2);
    document.getElementById('totalTxt').innerText = total.toFixed(2);
};

window.eliminarProducto = (index) => {
    productosTabla.splice(index, 1);
    renderTabla();
};

// --- 4. PDF de OC: se genera mediante js/pdf-order.js. La OS usa su módulo independiente. ---

// --- 5. LÓGICA DE BÚSQUEDA INTERACTIVA DE PRODUCTOS (CATÁLOGO EN MEMORIA) ---
async function cargarCatalogoProductos() {
    try {
        const querySnapshot = await getDocs(collection(db, "productos"));
        listaMaestraProductos = [];
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            listaMaestraProductos.push({
                codigo: data.codigo || "",
                descripcion: data.descripcion || "",
                unidad: data.unidad || "UND"
            });
        });
        console.log(`✅ Catálogo cargado: ${listaMaestraProductos.length} productos listos para la búsqueda.`);
    } catch (error) {
        console.error("Error al precargar el catálogo de productos:", error);
    }
}

function configurarBuscadoresInteractivos() {
    const codigoProd = document.getElementById('codigoProd');
    const productoDesc = document.getElementById('producto');
    const unidadMedida = document.getElementById('unidadMedida');
    
    const sugerenciasCodigo = document.getElementById('sugerenciasCodigo');
    const sugerenciasDesc = document.getElementById('sugerenciasDesc');

    if (!codigoProd || !productoDesc) return;

    // A. Filtrar coincidencias mientras se escribe en el Código de Producto
    codigoProd.addEventListener('input', () => {
        const term = codigoProd.value.toLowerCase().trim();
        if (term === "") {
            sugerenciasCodigo.style.display = 'none';
            return;
        }

        const filtrados = listaMaestraProductos.filter(p => p.codigo.toLowerCase().includes(term));
        if (filtrados.length === 0) {
            sugerenciasCodigo.style.display = 'none';
            return;
        }

        renderizarPanelFlotante(sugerenciasCodigo, filtrados, codigoProd, productoDesc, unidadMedida);
    });

    // B. Filtrar coincidencias en vivo mientras se escribe en la Descripción
    productoDesc.addEventListener('input', () => {
        const term = productoDesc.value.toLowerCase().trim();
        if (term === "") {
            sugerenciasDesc.style.display = 'none';
            return;
        }

        const filtrados = listaMaestraProductos.filter(p => 
            p.descripcion.toLowerCase().includes(term) || 
            p.codigo.toLowerCase().includes(term)
        );

        if (filtrados.length === 0) {
            sugerenciasDesc.style.display = 'none';
            return;
        }

        renderizarPanelFlotante(sugerenciasDesc, filtrados, codigoProd, productoDesc, unidadMedida);
    });

    // Ocultar las tablas emergentes al hacer clic fuera de las cajas de texto de búsqueda
    document.addEventListener('click', (e) => {
        if (e.target !== codigoProd && e.target !== productoDesc) {
            if (sugerenciasCodigo) sugerenciasCodigo.style.display = 'none';
            if (sugerenciasDesc) sugerenciasDesc.style.display = 'none';
        }
    });
}

function renderizarPanelFlotante(contenedor, lista, inpCod, inpDesc, selUnd) {
    let html = `<table class="table table-sm table-hover border bg-white mb-0 shadow-sm" style="font-size:0.8rem; text-align: left;"><tbody>`;
    
    lista.slice(0, 8).forEach(p => {
        html += `
            <tr data-codigo="${p.codigo}" data-descripcion="${p.descripcion}" data-unidad="${p.unidad}">
                <td class="fw-bold text-primary" style="width: 25%;">${p.codigo}</td>
                <td style="width: 55%;">${p.descripcion}</td>
                <td class="text-muted text-center" style="width: 20%;">${p.unidad}</td>
            </tr>
        `;
    });
    html += `</tbody></table>`;
    
    contenedor.innerHTML = html;
    contenedor.style.display = 'block';

    contenedor.querySelectorAll('tbody tr').forEach(row => {
        row.addEventListener('mousedown', (e) => {
            e.preventDefault();
            inpCod.value = row.getAttribute('data-codigo').toUpperCase();
            inpDesc.value = row.getAttribute('data-descripcion').toUpperCase();
            
            if (selUnd) {
                selUnd.value = normalizarUnidad(row.getAttribute('data-unidad'));
            }
            
            contenedor.style.display = 'none';
        });
    });
}

function normalizarUnidad(und) {
    const u = String(und).toUpperCase().trim();
    if (u === "MTR" || u === "METRO") return "MTR";
    if (u === "GLN" || u === "GALON" || u === "GALÓN") return "GLN";
    if (u === "CAJA") return "CAJA";
    if (u === "PAQ" || u === "PQT" || u === "PAQUETE") return "PAQ";
    if (u === "MLL" || u === "MILLAR") return "MLL";
    if (u === "KG" || u === "KILOGRAMO") return "KG";
    return "UND";
}

function poblarMaestrosDesdeConfiguracion() {
    compradoresMaster = Object.fromEntries((configDocumentos.compradores || []).map(c => [c.nombre, c]));
    proyectosMaster = Object.fromEntries((configDocumentos.proyectos || []).map(p => [p.nombre, p.direccion || '']));

    const selComprador = document.getElementById('nombreComp');
    if (selComprador) {
        selComprador.innerHTML = '<option value="">Seleccione...</option>' + (configDocumentos.compradores || [])
            .map(c => `<option value="${c.nombre}">${c.nombre}</option>`).join('');
    }

    const selProyecto = document.getElementById('proyectoComp');
    if (selProyecto) {
        selProyecto.innerHTML = '<option value="">Seleccione...</option>' + (configDocumentos.proyectos || [])
            .map(p => `<option value="${p.nombre}">${p.nombre}</option>`).join('');
        const predeterminado = configDocumentos.proyectoPredeterminado || 'CAMBRIDGE';
        if ((configDocumentos.proyectos || []).some(p => p.nombre === predeterminado)) {
            selProyecto.value = predeterminado;
            document.getElementById('lugarComp').value = proyectosMaster[predeterminado] || '';
        }
    }

    const selPago = document.getElementById('pagoProv');
    if (selPago) {
        selPago.innerHTML = (configDocumentos.formasPago || []).map(f => `<option value="${f}">${f}</option>`).join('');
    }

    const hora = document.getElementById('horaComp');
    if (hora && configDocumentos.horarioRecepcion) hora.value = configDocumentos.horarioRecepcion;
}

// --- 6. INICIALIZACIÓN DE LA APP ---
const iniciarApp = async () => {
    configDocumentos = await cargarConfiguracionDocumentos();
    poblarMaestrosDesdeConfiguracion();
    await cargarCatalogoProductos();
    configurarBuscadoresInteractivos();

    // Eventos Comprador
    document.getElementById('nombreComp')?.addEventListener('change', (e) => {
        const data = compradoresMaster[e.target.value];
        document.getElementById('tlfComp').value = data ? data.tlf : "";
        document.getElementById('correoComp').value = data ? data.correo : "";
    });

    document.getElementById('proyectoComp')?.addEventListener('change', (e) => {
        const direccion = proyectosMaster[e.target.value];
        document.getElementById('lugarComp').value = direccion || "";
    });

    // Eventos Fechas y Moneda
    document.getElementById('fechaoc')?.addEventListener('change', calcularVencimiento);
    document.getElementById('diasCredito')?.addEventListener('input', calcularVencimiento);
    document.getElementById('moneda')?.addEventListener('change', renderTabla);

    // Búsqueda Proveedor por RUC
    document.getElementById('rucProv')?.addEventListener('blur', async (e) => {
        const ruc = e.target.value.trim();
        if (ruc.length >= 8) {
            const docSnap = await getDoc(doc(db, "proveedores", ruc));
            if (docSnap.exists()) {
                const d = docSnap.data();
                document.getElementById('razonProv').value = d.razonSocial || "";
                document.getElementById('dirProv').value = d.direccion || "";
                document.getElementById('atencionProv').value = d.atencion || "";
                document.getElementById('tlfProv').value = d.tlf || "";
                document.getElementById('corProv').value = d.corProv || d.correo || "";
                document.getElementById('diasCredito').value = d.diasCredito || 0;
                
                const selectorPago = document.getElementById('pagoProv');
                if (selectorPago) selectorPago.value = (d.medioPago || d.pago || "CONTADO").toUpperCase();
                calcularVencimiento();
            }
        }
    });

    // Búsqueda Producto por Código Exacto
    document.getElementById('codigoProd')?.addEventListener('blur', async (e) => {
        const cod = e.target.value.toUpperCase().trim();
        if (cod) {
            const snap = await getDoc(doc(db, "productos", cod));
            if (snap.exists()) {
                document.getElementById('producto').value = snap.data().descripcion.toUpperCase();
                document.getElementById('unidadMedida').value = normalizarUnidad(snap.data().unidad);
            }
        }
    });

    // Añadir Producto a Tabla
    document.getElementById('btnAnadir')?.addEventListener('click', () => {
        const codigo = document.getElementById('codigoProd').value.toUpperCase();
        const desc = document.getElementById('producto').value.toUpperCase();
        const cant = parseFloat(document.getElementById('cantidad').value);
        const precio = parseFloat(document.getElementById('precio').value);
        const unidad = document.getElementById('unidadMedida').value;
        
        if (!desc || isNaN(cant) || isNaN(precio)) return alert("Datos incompletos");
        
        productosTabla.push({ codigo: codigo || "S/C", desc, unidad, cant, precio, total: cant * precio });
        renderTabla();
        
        ['codigoProd', 'producto', 'cantidad', 'precio'].forEach(id => document.getElementById(id).value = '');
        document.getElementById('codigoProd').focus();
    });

    // Cerrar Sesión
    document.getElementById('btnCerrarSesion')?.addEventListener('click', async (e) => {
        e.preventDefault();
        try { await signOut(auth); window.location.href = '../index.html'; } catch (error) { console.error("Error al salir:", error); }
    });

    document.getElementById('btnFinalizar')?.addEventListener('click', guardarOrden);
    
    if (document.getElementById('fechaoc')) {
        if (!document.getElementById('fechaoc').value) {
            document.getElementById('fechaoc').valueAsDate = new Date();
        }
        calcularVencimiento();
    }
};

// --- 7. GUARDADO EN FIREBASE ---
async function guardarOrden() {
    if (productosTabla.length === 0) return alert("La tabla de productos está vacía.");
    const rucProv = document.getElementById('rucProv').value.trim();
    if (!rucProv) return alert("Ingrese el RUC del proveedor.");

    const btn = document.getElementById('btnFinalizar');
    btn.disabled = true;
    btn.innerText = "⌛ REGISTRANDO...";

    try {
        // Correlativo atómico administrado desde Supabase.
        const nroOC = await siguienteCorrelativo('OC');

        const numeroBaseOC = nroOC.match(/(\d+)(?!.*\d)/)?.[1] || nroOC;
        const data = {
            nroOC,
            nroGR: `GR-${numeroBaseOC}`,
            fechaEmision: document.getElementById('fechaoc').value,
            fechaVencimiento: document.getElementById('fechaVencimiento').value,
            nroCotizacion: document.getElementById('nroCotizacion').value.toUpperCase(),
            moneda: document.getElementById('moneda').value,
            subtotal: document.getElementById('subtotalTxt').innerText,
            igv: document.getElementById('igvTxt').innerText,
            total: document.getElementById('totalTxt').innerText,
            items: [...productosTabla],
            createdAt: serverTimestamp(),
            estadoSolped: "PENDIENTE",
            estadoPago: "PENDIENTE",
            proveedor: {
                ruc: rucProv,
                razonSocial: document.getElementById('razonProv').value.toUpperCase(),
                direccion: document.getElementById('dirProv').value.toUpperCase(),
                atencion: document.getElementById('atencionProv').value.toUpperCase(),
                // En la base el campo sigue llamándose pago. En UI/PDF se muestra FORMA DE PAGO.
                pago: document.getElementById('pagoProv').value,
                tlf: document.getElementById('tlfProv').value,
                correo: document.getElementById('corProv').value,
                diasCredito: document.getElementById('diasCredito').value
            },
            comprador: {
                nombre: document.getElementById('nombreComp').value.toUpperCase(),
                tlf: document.getElementById('tlfComp').value,
                correo: document.getElementById('correoComp').value,
                proyecto: document.getElementById('proyectoComp').value,
                lugarEntrega: document.getElementById('lugarComp').value,
                horarioRecepcion: document.getElementById('horaComp').value
            },
            empresa: configDocumentos.empresa,
            documentacionObligatoria: configDocumentos.documentacionObligatoria,
            terminosCondiciones: configDocumentos.terminosCondiciones
        };

        // IMPORTANTE: se mantiene el comportamiento original: cada OC crea su registro de guía automáticamente.
        await addDoc(collection(db, "ordenesCompra"), data);
        await addDoc(collection(db, "guiasRemision"), data);

        await setDoc(doc(db, "proveedores", rucProv), data.proveedor, { merge: true });

        await generarPDFOrden(data, 'descargar');
        alert(`✅ Registrado con éxito: ${nroOC}`);
        location.reload();
    } catch (e) {
        console.error(e);
        alert("❌ No se pudo registrar la orden. Revisa la conexión y permisos de Supabase.");
        btn.disabled = false;
        btn.innerHTML = '<i class="bi bi-save"></i> GUARDAR ORDEN DE COMPRA';
    }
}

iniciarApp();