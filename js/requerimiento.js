import { db, auth } from './config.js';
import { 
    collection, addDoc, getDocs, doc, setDoc, serverTimestamp, getDoc 
} from "./supabase-db-compat.js";
import { onAuthStateChanged } from "./supabase-auth-compat.js";
import { cargarConfiguracionDocumentos } from './document-config.js';

const tabla = document.getElementById('cuerpoTablaReq');
const datalist = document.getElementById('listaProductos');
let productosDB = [];
async function cargarProyectosConfigurablesReq() {
    try {
        const config = await cargarConfiguracionDocumentos();
        const select = document.getElementById('reqProyecto');
        if (select) {
            select.innerHTML = (config.proyectos || []).map(p => `<option value="${p.nombre}">${p.nombre}</option>`).join('');
            const pred = config.proyectoPredeterminado || 'CAMBRIDGE';
            if ((config.proyectos || []).some(p => p.nombre === pred)) select.value = pred;
        }
    } catch (error) {
        console.warn('No se pudieron cargar proyectos configurables para requerimientos.', error);
    }
}


// --- 1. SEGURIDAD Y REDIRECCIÓN ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        try {
            const userDoc = await getDoc(doc(db, "usuarios", user.uid));
            if (userDoc.exists()) {
                const rol = userDoc.data().rol.toLowerCase();
                const path = window.location.pathname;

                // Si un usuario logueado intenta ir al index, lo mandamos a su menú correspondiente
                if (path.includes("index.html") || path.endsWith("/")) {
                    window.location.href = (rol === "admin") ? "page/menu.html" : "page/menu2.html";
                }
            }
        } catch (error) {
            console.error("Error validando sesión:", error);
        }
    } else {
        // Si no hay usuario, fuera de la carpeta page
        if (!window.location.pathname.includes("index.html")) {
            window.location.href = '../index.html';
        }
    }
});

// --- 2. CARGAR PRODUCTOS PARA AUTOCOMPLETADO ---
async function cargarProductos() {
    try {
        const snap = await getDocs(collection(db, "productos"));
        if (datalist) {
            datalist.innerHTML = "";
            productosDB = [];
            snap.forEach(docSnap => {
                const p = docSnap.data();
                productosDB.push(p);
                const opt = document.createElement('option');
                opt.value = p.descripcion.toUpperCase();
                datalist.appendChild(opt);
            });
        }
    } catch (err) {
        console.error("Error cargando productos:", err);
    }
}

// --- 3. LÓGICA DE AUTOCOMPLETADO EN TABLA ---
if (tabla) {
    tabla.addEventListener('input', (e) => {
        const fila = e.target.closest('tr');
        if (!fila) return;
        const inpCod = fila.querySelector('.inp-codigo');
        const inpDesc = fila.querySelector('.inp-desc');
        const inpUnd = fila.querySelector('.inp-und');

        if (e.target.classList.contains('inp-codigo')) {
            const cod = e.target.value.toUpperCase().trim();
            const match = productosDB.find(p => String(p.codigo).toUpperCase() === cod);
            if (match) {
                inpDesc.value = (match.descripcion || "").toUpperCase();
                inpUnd.value = (match.unidad || "UND").toUpperCase();
            }
        }
        if (e.target.classList.contains('inp-desc')) {
            const desc = e.target.value.toUpperCase().trim();
            const match = productosDB.find(p => p.descripcion.toUpperCase() === desc);
            if (match) {
                inpCod.value = match.codigo || "";
                inpUnd.value = (match.unidad || "UND").toUpperCase();
            }
        }
    });

    // --- 4. ACCIONES DE FILA (ELIMINAR Y EDITAR) ---
    tabla.addEventListener('click', (e) => {
        const fila = e.target.closest('tr');

        if (e.target.closest('.btn-eliminar')) {
            if (document.querySelectorAll('#cuerpoTablaReq tr').length > 1) {
                fila.remove();
            } else {
                alert("No puedes eliminar la única fila disponible.");
            }
        }

        if (e.target.closest('.btn-editar')) {
            fila.classList.add('fila-editando');
            fila.querySelector('.inp-partida').focus();
            setTimeout(() => {
                fila.classList.remove('fila-editando');
            }, 1200);
        }
    });
}

// --- 5. GUARDAR REQUERIMIENTO ---
const btnGuardar = document.getElementById('btnGuardarReq');
if (btnGuardar) {
    btnGuardar.onclick = async () => {
        const items = [];
        const filas = document.querySelectorAll('#cuerpoTablaReq tr');
        
        const selectCC = document.getElementById('reqCentroCosto');
        const centroCostoTexto = selectCC.options[selectCC.selectedIndex].text;
        const centroCostoValue = selectCC.value;

        const fechaSolicitada = document.getElementById('reqFechaSolicitada').value;
        const fechaRequerida = document.getElementById('reqFechaRequerida').value;
        const solicitante = document.getElementById('reqSolicitante').value.toUpperCase().trim();

        if (!solicitante) return alert("Por favor ingrese el nombre del solicitante");
        if (!centroCostoValue) return alert("Por favor seleccione un Centro de Costo");
        if (!fechaSolicitada || !fechaRequerida) return alert("Por favor complete ambas fechas");

        btnGuardar.disabled = true;
        btnGuardar.innerText = "GUARDANDO...";

        for (const fila of filas) {
            const partida = fila.querySelector('.inp-partida').value.toUpperCase().trim();
            const codigo = fila.querySelector('.inp-codigo').value.toUpperCase().trim();
            const desc = fila.querySelector('.inp-desc').value.toUpperCase().trim();
            const observacion = fila.querySelector('.inp-observacion').value.trim();
            const und = fila.querySelector('.inp-und').value.toUpperCase().trim() || "UND";
            const cant = fila.querySelector('.inp-cant').value;

            if (desc) {
                items.push({
                    partida: partida || "S/P",
                    codigo: codigo || "S/C",
                    descripcion: desc,
                    observacion: observacion || "",
                    unidad: und,
                    cantidad: cant,
                    nroOC: "", 
                    estadoItem: "PENDIENTE"
                });

                if (codigo && codigo !== "S/C") {
                    await setDoc(doc(db, "productos", codigo), {
                        codigo: codigo,
                        descripcion: desc,
                        unidad: und
                    }, { merge: true });
                }
            }
        }

        if (items.length === 0) {
            btnGuardar.disabled = false;
            btnGuardar.innerText = "GENERAR REQUERIMIENTO";
            return alert("Debe agregar al menos un producto");
        }

        try {
            await addDoc(collection(db, "requerimientos"), {
                proyecto: document.getElementById('reqProyecto').value.toUpperCase(),
                solicitante: solicitante,
                centroCosto: centroCostoTexto,
                fechaSolicitada: fechaSolicitada,
                fechaRequerida: fechaRequerida,
                estadoGeneral: "PENDIENTE",
                fecha: new Date().toLocaleDateString(),
                createdAt: serverTimestamp(),
                items: items
            });
            alert("✅ Requerimiento guardado correctamente");
            location.reload();
        } catch (err) { 
            console.error("Error al guardar:", err);
            alert("Hubo un error al guardar.");
            btnGuardar.disabled = false;
            btnGuardar.innerText = "GENERAR REQUERIMIENTO";
        }
    };
}

// --- 6. GESTIÓN DE FILAS ---
const btnAgregar = document.getElementById('btnAgregarFila');
if (btnAgregar) {
    btnAgregar.onclick = () => {
        const primeraFila = tabla.querySelector('tr');
        const nuevaFila = primeraFila.cloneNode(true);
        nuevaFila.querySelectorAll('input').forEach(i => i.value = "");
        nuevaFila.querySelector('.inp-cant').value = "1";
        nuevaFila.classList.remove('fila-editando');
        tabla.appendChild(nuevaFila);
    };
}

// --- 7. RECEPCIÓN DE MÚLTIPLES PRODUCTOS DESDE CATÁLOGO ---
window.addEventListener('DOMContentLoaded', async () => {
    await cargarProyectosConfigurablesReq();
    // Primero cargamos los productos para asegurar autocompletado
    await cargarProductos();

    const productosJson = sessionStorage.getItem('productosParaRQ');
    
    if (productosJson) {
        const productosArr = JSON.parse(productosJson); // Recibimos el array de productos
        
        productosArr.forEach((prodData) => {
            const filas = document.querySelectorAll('#cuerpoTablaReq tr');
            let filaDestino = filas[filas.length - 1];

            // Si la última fila ya tiene contenido (descripción llena), agregamos una nueva fila
            if (filaDestino.querySelector('.inp-desc').value !== "") {
                if (btnAgregar) btnAgregar.click();
                const nuevasFilas = document.querySelectorAll('#cuerpoTablaReq tr');
                filaDestino = nuevasFilas[nuevasFilas.length - 1];
            }

            // Inyectamos los datos del producto actual en la fila destino
            filaDestino.querySelector('.inp-codigo').value = prodData.codigo || "";
            filaDestino.querySelector('.inp-desc').value = prodData.descripcion || "";
            filaDestino.querySelector('.inp-und').value = prodData.unidad || "UND";
            filaDestino.querySelector('.inp-cant').value = "1"; // Cantidad por defecto
        });

        // Limpiamos la memoria para evitar que se carguen de nuevo al refrescar
        sessionStorage.removeItem('productosParaRQ');
        console.log(`✅ Se cargaron ${productosArr.length} productos desde el catálogo.`);
    }
});
