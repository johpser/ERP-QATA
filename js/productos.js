import { db, auth } from './config.js';
import { 
    collection, onSnapshot, query, orderBy, addDoc, deleteDoc, doc, getDocs, where 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const tablaProductos = document.getElementById('tablaProductos');
const formNuevoProducto = document.getElementById('formNuevoProducto');
const inputBuscador = document.getElementById('inputBuscador');
const filtroTipo = document.getElementById('filtroTipo'); // Selector de filtro por tipo en tu HTML

let listaMaestraProductos = [];
let seleccionadosParaRQ = [];

// 1. SEGURIDAD Y CARGA INICIAL
onAuthStateChanged(auth, (user) => {
    if (user) iniciarCargaDatos();
    else window.location.href = '../index.html';
});

function iniciarCargaDatos() {
    const q = query(collection(db, "productos"), orderBy("descripcion", "asc"));
    onSnapshot(q, (snapshot) => {
        listaMaestraProductos = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        // Al cargar o actualizar datos, aplicamos los filtros activos inmediatamente
        ejecutarFiltroCombinado();
    });
}

// 2. BOTÓN LISTO PARA REQUERIMIENTO
function actualizarBotónListo() {
    let btnListo = document.getElementById('btnListoRQ');
    if (seleccionadosParaRQ.length > 0) {
        if (!btnListo) {
            btnListo = document.createElement('button');
            btnListo.id = 'btnListoRQ';
            btnListo.innerHTML = `<i class="bi bi-check-all"></i> LISTO (${seleccionadosParaRQ.length})`;
            btnListo.className = "btn btn-success btn-lg shadow-lg position-fixed fw-bold";
            btnListo.style.cssText = "bottom: 30px; right: 30px; z-index: 2000; border-radius: 50px; padding: 15px 30px;";
            btnListo.onclick = () => {
                sessionStorage.setItem('productosParaRQ', JSON.stringify(seleccionadosParaRQ));
                window.location.href = 'requerimiento.html';
            };
            document.body.appendChild(btnListo);
        } else {
            btnListo.innerHTML = `<i class="bi bi-check-all"></i> LISTO (${seleccionadosParaRQ.length})`;
        }
    } else if (btnListo) {
        btnListo.remove();
    }
}

// 3. RENDERIZAR TABLA
function actualizarTabla(productos) {
    if (!tablaProductos) return;
    tablaProductos.innerHTML = "";
    
    if (productos.length === 0) {
        tablaProductos.innerHTML = `<tr><td colspan="5" class="text-center py-4 text-muted">No hay productos en el catálogo.</td></tr>`;
        return;
    }

    productos.forEach(p => {
        const yaSeleccionado = seleccionadosParaRQ.some(item => item.codigo === p.codigo);
        const fila = document.createElement('tr');
        fila.innerHTML = `
            <td class="text-center fw-bold text-primary small">${p.codigo}</td>
            <td class="text-uppercase"><span class="badge-tipo">${p.tipo || 'GENERAL'}</span></td>
            <td class="text-uppercase small">${p.descripcion}</td>
            <td class="text-center small">${p.unidad}</td>
            <td class="text-center">
                <div class="btn-group">
                    <button class="btn btn-sm ${yaSeleccionado ? 'btn-primary' : 'btn-success'} btn-usar" data-id="${p.id}">
                        <i class="bi ${yaSeleccionado ? 'bi-check-circle-fill' : 'bi-plus-circle-fill'}"></i> ${yaSeleccionado ? 'AÑADIDO' : 'USAR'}
                    </button>
                    <button class="btn btn-sm btn-outline-danger btn-eliminar" data-id="${p.id}">
                        <i class="bi bi-trash"></i>
                    </button>
                </div>
            </td>
        `;
        tablaProductos.appendChild(fila);
    });
}

// 4. ACCIONES DE LA TABLA
tablaProductos.addEventListener('click', async (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    
    const id = btn.dataset.id;
    const prod = listaMaestraProductos.find(p => p.id === id);
    if (!prod) return;

    if (btn.classList.contains('btn-usar')) {
        const indice = seleccionadosParaRQ.findIndex(item => item.codigo === prod.codigo);
        if (indice === -1) {
            seleccionadosParaRQ.push({
                codigo: prod.codigo,
                descripcion: prod.descripcion,
                unidad: prod.unidad
            });
        } else {
            seleccionadosParaRQ.splice(indice, 1);
        }
        actualizarBotónListo();
        // Mantiene el filtro actual visible tras pulsar el botón de usar producto
        ejecutarFiltroCombinado();
    }

    if (btn.classList.contains('btn-eliminar')) {
        if (confirm(`¿Estás seguro de eliminar definitivamente: "${prod.descripcion}"?`)) {
            try {
                await deleteDoc(doc(db, "productos", id));
            } catch (error) {
                console.error("Error al eliminar:", error);
            }
        }
    }
});

// 5. GENERADOR DE CÓDIGO AUTOGENERADO
async function generarCodigoCorrelativo(tipo, descripcion) {
    const prefijoTipo = tipo.substring(0, 4).toUpperCase().padEnd(4, 'X');
    const prefijoDesc = descripcion.substring(0, 4).toUpperCase().padEnd(4, 'X');
    const baseCodigo = `${prefijoTipo}-${prefijoDesc}`;

    try {
        const q = query(collection(db, "productos"), where("codigo", ">=", baseCodigo), where("codigo", "<=", baseCodigo + "\uf8ff"));
        const querySnapshot = await getDocs(q);
        
        let maxNumero = 0;
        querySnapshot.forEach((doc) => {
            const codigoExistente = doc.data().codigo;
            const partes = codigoExistente.split('-');
            const correlativo = parseInt(partes[partes.length - 1]);
            if (!isNaN(correlativo) && correlativo > maxNumero) {
                maxNumero = correlativo;
            }
        });

        const nuevoNumero = (maxNumero + 1).toString().padStart(4, '0');
        return `${baseCodigo}-${nuevoNumero}`;
    } catch (error) {
        console.error("Error generando código:", error);
        return `${baseCodigo}-9999`;
    }
}

// 6. FORMULARIO NUEVO PRODUCTO
formNuevoProducto.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btnGuardar = document.getElementById('btnGuardarProducto');
    
    btnGuardar.disabled = true;
    btnGuardar.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Procesando...';

    const tipo = document.getElementById('newTipo').value.trim().toUpperCase();
    const descripcion = document.getElementById('newDescripcion').value.trim().toUpperCase();
    const unidad = document.getElementById('newUnidad').value;

    try {
        const codigoAuto = await generarCodigoCorrelativo(tipo, descripcion);
        
        await addDoc(collection(db, "productos"), {
            tipo: tipo,
            codigo: codigoAuto,
            descripcion: descripcion,
            unidad: unidad
        });

        // Cerrar modal de forma segura
        const modalEl = document.getElementById('modalNuevoProducto');
        const modalInstance = bootstrap.Modal.getInstance(modalEl);
        if (modalInstance) modalInstance.hide();
        
        formNuevoProducto.reset();
        alert(`✅ Producto guardado.\nCódigo: ${codigoAuto}`);

    } catch (error) {
        console.error("Error al registrar:", error);
        alert("❌ No se pudo registrar el producto.");
    } finally {
        btnGuardar.disabled = false;
        btnGuardar.innerHTML = 'GUARDAR PRODUCTO';
    }
});

// 7. FUNCIÓN DE FILTRADO COMBINADO (BÚSQUEDA + TIPO)
function ejecutarFiltroCombinado() {
    const term = inputBuscador ? inputBuscador.value.toLowerCase().trim() : "";
    const tipoSeleccionado = filtroTipo ? filtroTipo.value.toLowerCase().trim() : "";

    const filtrados = listaMaestraProductos.filter(p => {
        // Validación de coincidencia de texto (Buscador)
        const coincideTexto = term === "" || 
            (p.descripcion && p.descripcion.toLowerCase().includes(term)) || 
            (p.codigo && p.codigo.toLowerCase().includes(term)) ||
            (p.tipo && p.tipo.toLowerCase().includes(term));

        // Validación de coincidencia de categoría (Filtro Select)
        const coincideTipo = tipoSeleccionado === "" || 
            (p.tipo && p.tipo.toLowerCase() === tipoSeleccionado);

        return coincideTexto && coincideTipo;
    });

    actualizarTabla(filtrados);
}

// Escuchas de eventos para actualizar la tabla dinámicamente al interactuar con los filtros
inputBuscador?.addEventListener('input', ejecutarFiltroCombinado);
filtroTipo?.addEventListener('change', ejecutarFiltroCombinado);