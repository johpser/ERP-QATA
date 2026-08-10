import { auth, db } from './config.js';
import { signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { cargarConfiguracionDocumentos, guardarConfiguracionDocumentos, DEFAULT_CONFIG_DOCUMENTOS } from './document-config.js';

let configActual = structuredClone(DEFAULT_CONFIG_DOCUMENTOS);

const $ = (id) => document.getElementById(id);

function mensaje(texto, tipo = 'success') {
    const el = $('mensaje');
    el.className = `alert alert-${tipo} mt-3`;
    el.textContent = texto;
}

function filaProyecto(p = { nombre:'', direccion:'' }) {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td><input class="form-control form-control-sm campo-proyecto"></td>
        <td><input class="form-control form-control-sm campo-direccion"></td>
        <td class="text-center"><button class="btn btn-outline-danger btn-sm btn-eliminar" type="button"><i class="bi bi-trash"></i></button></td>`;
    tr.querySelector('.campo-proyecto').value = p.nombre || '';
    tr.querySelector('.campo-direccion').value = p.direccion || '';
    tr.querySelector('.btn-eliminar').onclick = () => { tr.remove(); actualizarSelectProyecto(); };
    tr.querySelector('.campo-proyecto').addEventListener('input', actualizarSelectProyecto);
    return tr;
}

function filaComprador(c = { nombre:'', tlf:'', correo:'' }) {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td><input class="form-control form-control-sm campo-nombre"></td>
        <td><input class="form-control form-control-sm campo-tlf"></td>
        <td><input class="form-control form-control-sm campo-correo"></td>
        <td class="text-center"><button class="btn btn-outline-danger btn-sm btn-eliminar" type="button"><i class="bi bi-trash"></i></button></td>`;
    tr.querySelector('.campo-nombre').value = c.nombre || '';
    tr.querySelector('.campo-tlf').value = c.tlf || '';
    tr.querySelector('.campo-correo').value = c.correo || '';
    tr.querySelector('.btn-eliminar').onclick = () => tr.remove();
    return tr;
}

function filaPago(valor = '') {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td><input class="form-control form-control-sm campo-pago"></td>
        <td class="text-center"><button class="btn btn-outline-danger btn-sm btn-eliminar" type="button"><i class="bi bi-trash"></i></button></td>`;
    tr.querySelector('.campo-pago').value = valor || '';
    tr.querySelector('.btn-eliminar').onclick = () => tr.remove();
    return tr;
}

function obtenerProyectos() {
    return [...$('tablaProyectos').querySelectorAll('tr')].map(tr => ({
        nombre: tr.querySelector('.campo-proyecto').value.trim().toUpperCase(),
        direccion: tr.querySelector('.campo-direccion').value.trim()
    })).filter(p => p.nombre);
}

function actualizarSelectProyecto() {
    const actual = $('proyectoPredeterminado').value;
    const proyectos = obtenerProyectos();
    $('proyectoPredeterminado').innerHTML = proyectos.map(p => `<option value="${p.nombre}">${p.nombre}</option>`).join('');
    if (proyectos.some(p => p.nombre === actual)) $('proyectoPredeterminado').value = actual;
}

function render(config) {
    configActual = structuredClone(config);
    $('empresaRazon').value = config.empresa?.razonSocial || '';
    $('empresaRuc').value = config.empresa?.ruc || '';
    $('empresaDireccion').value = config.empresa?.direccion || '';
    $('empresaCorreo').value = config.empresa?.correo || '';
    $('empresaTelefono').value = config.empresa?.telefono || '';
    $('horarioRecepcion').value = config.horarioRecepcion || '';
    $('documentacionObligatoria').value = config.documentacionObligatoria || '';
    $('terminosCondiciones').value = config.terminosCondiciones || '';

    $('tablaProyectos').innerHTML = '';
    (config.proyectos || []).forEach(p => $('tablaProyectos').appendChild(filaProyecto(p)));
    actualizarSelectProyecto();
    $('proyectoPredeterminado').value = config.proyectoPredeterminado || 'CAMBRIDGE';

    $('tablaCompradores').innerHTML = '';
    (config.compradores || []).forEach(c => $('tablaCompradores').appendChild(filaComprador(c)));

    $('tablaPagos').innerHTML = '';
    (config.formasPago || []).forEach(v => $('tablaPagos').appendChild(filaPago(v)));
}

function recopilar() {
    const proyectos = obtenerProyectos();
    const compradores = [...$('tablaCompradores').querySelectorAll('tr')].map(tr => ({
        nombre: tr.querySelector('.campo-nombre').value.trim(),
        tlf: tr.querySelector('.campo-tlf').value.trim(),
        correo: tr.querySelector('.campo-correo').value.trim()
    })).filter(c => c.nombre);
    const formasPago = [...$('tablaPagos').querySelectorAll('.campo-pago')]
        .map(i => i.value.trim().toUpperCase()).filter(Boolean);

    return {
        empresa: {
            razonSocial: $('empresaRazon').value.trim(),
            ruc: $('empresaRuc').value.trim(),
            direccion: $('empresaDireccion').value.trim(),
            correo: $('empresaCorreo').value.trim(),
            telefono: $('empresaTelefono').value.trim()
        },
        proyectos,
        compradores,
        formasPago,
        proyectoPredeterminado: $('proyectoPredeterminado').value || proyectos[0]?.nombre || '',
        horarioRecepcion: $('horarioRecepcion').value.trim(),
        documentacionObligatoria: $('documentacionObligatoria').value.trim(),
        terminosCondiciones: $('terminosCondiciones').value.trim()
    };
}

$('agregarProyecto').onclick = () => { $('tablaProyectos').appendChild(filaProyecto()); actualizarSelectProyecto(); };
$('agregarComprador').onclick = () => $('tablaCompradores').appendChild(filaComprador());
$('agregarPago').onclick = () => $('tablaPagos').appendChild(filaPago());
$('btnRestaurar').onclick = () => {
    if (confirm('¿Cargar los valores iniciales en el formulario? No se guardarán hasta que pulses "Guardar configuración".')) {
        render(structuredClone(DEFAULT_CONFIG_DOCUMENTOS));
        mensaje('Valores iniciales cargados. Pulsa Guardar configuración para aplicarlos.', 'warning');
    }
};
$('btnGuardar').onclick = async () => {
    const btn = $('btnGuardar');
    const data = recopilar();
    if (!data.proyectos.length) return mensaje('Debe existir al menos un proyecto.', 'danger');
    if (!data.formasPago.length) return mensaje('Debe existir al menos una forma de pago.', 'danger');
    if (!data.terminosCondiciones) return mensaje('Los términos y condiciones no pueden quedar vacíos.', 'danger');
    btn.disabled = true;
    try {
        configActual = await guardarConfiguracionDocumentos(data);
        render(configActual);
        mensaje('✅ Configuración guardada correctamente en Firebase.');
    } catch (error) {
        console.error(error);
        mensaje('No se pudo guardar. Revisa las reglas/permisos de Firestore para configuracion/documentos.', 'danger');
    } finally {
        btn.disabled = false;
    }
};

$('btnCerrarSesion').onclick = async () => {
    await signOut(auth);
    window.location.href = '../index.html';
};

onAuthStateChanged(auth, async (user) => {
    if (!user) return window.location.href = '../index.html';
    const userSnap = await getDoc(doc(db, 'usuarios', user.uid));
    const rol = userSnap.exists() ? String(userSnap.data().rol || '').toLowerCase() : '';
    if (rol !== 'admin') {
        alert('Acceso restringido al administrador.');
        return window.location.href = 'menu2.html';
    }
    render(await cargarConfiguracionDocumentos());
});
