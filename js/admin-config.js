import { auth, db, supabase } from './config.js';
import { signOut, onAuthStateChanged } from "./supabase-auth-compat.js";
import { doc, getDoc } from "./supabase-db-compat.js";
import { cargarConfiguracionDocumentos, guardarConfiguracionDocumentos, DEFAULT_CONFIG_DOCUMENTOS } from './document-config.js';
import { cargarCorrelativos, guardarCorrelativo, vistaPreviaCorrelativo } from './sequences.js';
import { MODULOS, modulosPredeterminados, modulosPorPerfil, nombreRol, normalizarRol } from './access-control.js';

let configActual = structuredClone(DEFAULT_CONFIG_DOCUMENTOS);
let correlativosActuales = {};

const $ = (id) => document.getElementById(id);

function normalizarCorrelativos(rows = []) {
    const map = Object.fromEntries((rows || []).map(r => [String(r.document_type || '').toUpperCase(), r]));
    return {
        OC: map.OC || { document_type:'OC', prefix:'OC-', suffix:'', next_number:1, padding:4 },
        OS: map.OS || { document_type:'OS', prefix:'', suffix:'D', next_number:1, padding:7 },
        GUIA: map.GUIA || { document_type:'GUIA', prefix:'GR-ALM-', suffix:'', next_number:1, padding:4 }
    };
}

function actualizarVistaCorrelativos() {
    const configs = [
        ['OC','ocPrefijo','ocSufijo','ocSiguiente','ocDigitos','previewOC'],
        ['OS','osPrefijoNumero','osSufijoNumero','osSiguiente','osDigitos','previewOS'],
        ['GUIA','guiaPrefijo','guiaSufijo','guiaSiguiente','guiaDigitos','previewGUIA']
    ];
    for (const [, pref, suf, next, pad, out] of configs) {
        if (!$(out)) continue;
        $(out).textContent = vistaPreviaCorrelativo({
            prefix: $(pref)?.value || '',
            suffix: $(suf)?.value || '',
            nextNumber: Number($(next)?.value || 1),
            padding: Number($(pad)?.value || 4)
        });
    }
}

function renderCorrelativos(rows = []) {
    correlativosActuales = normalizarCorrelativos(rows);
    const set = (tipo, pref, suf, next, pad) => {
        const c = correlativosActuales[tipo];
        $(pref).value = c.prefix || '';
        $(suf).value = c.suffix || '';
        $(next).value = Number(c.next_number || 1);
        $(pad).value = Number(c.padding || 4);
    };
    set('OC','ocPrefijo','ocSufijo','ocSiguiente','ocDigitos');
    set('OS','osPrefijoNumero','osSufijoNumero','osSiguiente','osDigitos');
    set('GUIA','guiaPrefijo','guiaSufijo','guiaSiguiente','guiaDigitos');
    actualizarVistaCorrelativos();
}

async function guardarCorrelativosFormulario() {
    const configs = [
        ['OC','ocPrefijo','ocSufijo','ocSiguiente','ocDigitos'],
        ['OS','osPrefijoNumero','osSufijoNumero','osSiguiente','osDigitos'],
        ['GUIA','guiaPrefijo','guiaSufijo','guiaSiguiente','guiaDigitos']
    ];
    for (const [tipo, pref, suf, next, pad] of configs) {
        const nextNumber = Number($(next).value || 1);
        const padding = Number($(pad).value || 4);
        if (!Number.isInteger(nextNumber) || nextNumber < 1) throw new Error(`El próximo número de ${tipo} debe ser un entero mayor o igual a 1.`);
        await guardarCorrelativo(tipo, {
            prefix: $(pref).value.trim().toUpperCase(),
            suffix: $(suf).value.trim().toUpperCase(),
            nextNumber,
            padding
        });
    }
}


let usuariosRolesCache = [];

function escHtml(v='') { return String(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }

function renderSelectorModulos(keys = []) {
    const cont=$('usuarioModulos');
    if (!cont) return;
    const selected=new Set(keys);
    cont.innerHTML=MODULOS.map(m=>`<label class="permission-card form-check">
        <input class="form-check-input permiso-modulo" type="checkbox" value="${m.key}" ${selected.has(m.key)?'checked':''}>
        <span><strong>${escHtml(m.label)}</strong><small class="d-block text-muted">${escHtml(m.href)}</small></span>
    </label>`).join('');
}

function aplicarPlantillaRol(rol, mantenerEmail=true) {
    const r=normalizarRol(rol);
    renderSelectorModulos(modulosPredeterminados(r));
    const nota=$('notaPermisosRol');
    if (nota) nota.textContent = r==='admin'
        ? 'El Administrador principal siempre conserva acceso total.'
        : 'Estos son los permisos predeterminados del rol. Puedes marcar o desmarcar módulos antes de guardar.';
    document.querySelectorAll('.permiso-modulo').forEach(ch=>{ ch.disabled = r==='admin'; if(r==='admin') ch.checked=true; });
    if (!mantenerEmail && $('usuarioRolEmail')) $('usuarioRolEmail').value='';
}

function modulosSeleccionados() {
    return [...document.querySelectorAll('.permiso-modulo:checked')].map(ch=>ch.value);
}

async function cargarUsuariosRoles() {
    const tbody=$('tablaUsuariosRoles');
    if (!tbody) return;
    try {
        const {data,error}=await supabase.from('qata_documents').select('id,data,updated_at').eq('bucket','usuarios').order('updated_at',{ascending:false});
        if (error) throw error;
        usuariosRolesCache=data || [];
        tbody.innerHTML=usuariosRolesCache.length ? usuariosRolesCache.map(r=>{
            const perfil=r.data || {};
            const rol=normalizarRol(perfil.rol);
            const mods=modulosPorPerfil(perfil);
            const fecha=r.updated_at ? new Date(r.updated_at).toLocaleString('es-PE') : '';
            return `<tr>
                <td>${escHtml(perfil.email || '')}</td>
                <td><span class="badge text-bg-light border">${escHtml(nombreRol(rol))}</span></td>
                <td class="small">${mods.length} módulo${mods.length===1?'':'s'}</td>
                <td class="small">${escHtml(fecha)}</td>
                <td class="text-end"><button type="button" class="btn btn-outline-primary btn-sm btn-editar-acceso" data-id="${escHtml(r.id)}"><i class="bi bi-pencil-square"></i> Editar</button></td>
            </tr>`;
        }).join('') : '<tr><td colspan="5" class="text-center text-muted py-3">No hay perfiles ERP asignados.</td></tr>';
    } catch(error) {
        console.error(error);
        tbody.innerHTML='<tr><td colspan="5" class="text-center text-danger py-3">No se pudo cargar la lista de usuarios.</td></tr>';
    }
}

function editarAccesoUsuario(id) {
    const row=usuariosRolesCache.find(r=>r.id===id); if(!row) return;
    const perfil=row.data || {};
    $('usuarioRolEmail').value=perfil.email || '';
    $('usuarioRolSelect').value=normalizarRol(perfil.rol) || 'comprador';
    renderSelectorModulos(modulosPorPerfil(perfil));
    document.querySelectorAll('.permiso-modulo').forEach(ch=>{ ch.disabled=normalizarRol(perfil.rol)==='admin'; });
    $('usuarioRolEmail').scrollIntoView({behavior:'smooth',block:'center'});
}

async function guardarAccesoUsuario() {
    const email=$('usuarioRolEmail')?.value.trim().toLowerCase();
    const rol=normalizarRol($('usuarioRolSelect')?.value);
    if (!email) return mensaje('Ingresa el correo del usuario que ya creaste en Authentication → Users.','warning');
    const modulos=rol==='admin' ? modulosPredeterminados('admin') : modulosSeleccionados();
    const btn=$('btnAsignarRol'); btn.disabled=true;
    try {
        const {data,error}=await supabase.rpc('qata_set_user_access',{p_email:email,p_role:rol,p_modules:modulos});
        if (error) throw error;
        mensaje(`Acceso guardado correctamente para ${email}.`);
        $('usuarioRolEmail').value='';
        $('usuarioRolSelect').value='comprador';
        aplicarPlantillaRol('comprador');
        await cargarUsuariosRoles();
        return data;
    } catch(error) {
        console.error(error);
        const msg=String(error?.message || error);
        mensaje(msg.includes('USUARIO_AUTH_NO_ENCONTRADO') ? 'Ese correo todavía no existe en Authentication → Users. Créalo allí primero.' : `No se pudo guardar el acceso: ${msg}`,'danger');
    } finally { btn.disabled=false; }
}

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
    const os = config.os || {};
    $('osCondicionPago').value = os.condicionPago || '';
    $('osHorarioFacturas').value = os.horarioFacturas || '';
    $('osHorarioObra').value = os.horarioObra || '';
    $('osRequisitosIngreso').value = os.requisitosIngreso || '';
    $('osDocumentosEntrega').value = os.documentosEntrega || '';
    $('osAprobadorNombre').value = os.aprobadorNombre || '';
    $('osAprobadorCargo').value = os.aprobadorCargo || '';
    $('osTipologia').value = os.tipologia || 'Servicio';
    $('osClasificacion').value = os.clasificacion || '';
    $('osPorcentaje').value = os.porcentaje || '';
    $('osMoneda').value = os.moneda || 'PEN Soles';
    $('osLugarEntrega').value = os.lugarEntrega || '';

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
        os: {
            correlativoSufijo: configActual.os?.correlativoSufijo || 'D',
            condicionPago: $('osCondicionPago').value.trim(),
            horarioFacturas: $('osHorarioFacturas').value.trim(),
            horarioObra: $('osHorarioObra').value.trim(),
            requisitosIngreso: $('osRequisitosIngreso').value.trim(),
            documentosEntrega: $('osDocumentosEntrega').value.trim(),
            aprobadorNombre: $('osAprobadorNombre').value.trim(),
            aprobadorCargo: $('osAprobadorCargo').value.trim(),
            tipologia: $('osTipologia').value.trim(),
            clasificacion: $('osClasificacion').value.trim(),
            porcentaje: $('osPorcentaje').value.trim(),
            moneda: $('osMoneda').value.trim(),
            lugarEntrega: $('osLugarEntrega').value.trim()
        },
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
        await guardarCorrelativosFormulario();
        render(configActual);
        renderCorrelativos(await cargarCorrelativos());
        mensaje('✅ Configuración y correlativos guardados correctamente en Supabase.');
    } catch (error) {
        console.error(error);
        mensaje(`No se pudo guardar: ${error?.message || 'revisa la conexión y permisos de Supabase.'}`, 'danger');
    } finally {
        btn.disabled = false;
    }
};


$('usuarioRolSelect')?.addEventListener('change', e => aplicarPlantillaRol(e.target.value));
$('btnRestaurarPermisosRol')?.addEventListener('click', () => aplicarPlantillaRol($('usuarioRolSelect')?.value || 'comprador'));
$('btnAsignarRol')?.addEventListener('click', guardarAccesoUsuario);
$('tablaUsuariosRoles')?.addEventListener('click', e => {
    const btn=e.target.closest('.btn-editar-acceso');
    if (btn) editarAccesoUsuario(btn.dataset.id);
});
['ocPrefijo','ocSufijo','ocSiguiente','ocDigitos','osPrefijoNumero','osSufijoNumero','osSiguiente','osDigitos','guiaPrefijo','guiaSufijo','guiaSiguiente','guiaDigitos']
    .forEach(id => $(id)?.addEventListener('input', actualizarVistaCorrelativos));

$('btnCerrarSesion').onclick = async () => {
    await signOut(auth);
    window.location.href = '../index.html';
};

onAuthStateChanged(auth, async (user) => {
    if (!user) return window.location.href = '../index.html';
    const userSnap = await getDoc(doc(db, 'usuarios', user.uid));
    const perfil = userSnap.exists() ? (userSnap.data() || {}) : {};
    const rol = normalizarRol(perfil.rol);
    const modulos = new Set(modulosPorPerfil(perfil));
    if (!modulos.has('admin_config')) {
        alert('Tu usuario no tiene habilitado Administración / Configuración.');
        return window.location.href = rol === 'admin' ? 'menu.html' : 'menu2.html';
    }
    const [config, correlativos] = await Promise.all([cargarConfiguracionDocumentos(), cargarCorrelativos()]);
    render(config);
    renderCorrelativos(correlativos);
    if (rol === 'admin') {
        $('gestionUsuariosSection')?.classList.remove('d-none');
        aplicarPlantillaRol($('usuarioRolSelect')?.value || 'comprador');
        await cargarUsuariosRoles();
    } else {
        $('gestionUsuariosSection')?.classList.add('d-none');
    }
});
