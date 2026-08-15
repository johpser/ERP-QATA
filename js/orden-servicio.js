import { db, auth } from './config.js';
import { doc, getDoc, setDoc, addDoc, collection, serverTimestamp } from './supabase-db-compat.js';
import { signOut, onAuthStateChanged } from "./supabase-auth-compat.js";
import { cargarConfiguracionDocumentos, DEFAULT_CONFIG_DOCUMENTOS } from './document-config.js';
import { siguienteCorrelativo } from './sequences.js';
import { generarPDFServicio } from './pdf-service.js';

const $ = id => document.getElementById(id);
let configDocumentos = DEFAULT_CONFIG_DOCUMENTOS;
let items = [];
let proyectos = {};

function setFechaHoy() {
    const hoy = new Date();
    const local = new Date(hoy.getTime() - hoy.getTimezoneOffset()*60000).toISOString().slice(0,10);
    if (!$('fechaGeneracion').value) $('fechaGeneracion').value = local;
}

function renderItems() {
    const tbody = $('detalleServicios');
    tbody.innerHTML = '';
    let subtotal = 0;
    items.forEach((i,idx) => {
        subtotal += Number(i.total || 0);
        const tr = document.createElement('tr');
        tr.innerHTML = `<td class="text-center">${String(idx+1).padStart(2,'0')}</td>
            <td>${i.descripcion}</td><td style="white-space:pre-line">${i.detalle || ''}</td>
            <td class="text-center">${i.unidad}</td><td class="text-end">${Number(i.cantidad).toFixed(2)}</td>
            <td class="text-end">${Number(i.precio).toFixed(2)}</td><td class="text-end fw-bold">${Number(i.total).toFixed(2)}</td>
            <td class="text-center"><button type="button" class="btn btn-outline-danger btn-sm"><i class="bi bi-trash"></i></button></td>`;
        tr.querySelector('button').onclick = () => { items.splice(idx,1); renderItems(); };
        tbody.appendChild(tr);
    });
    const igv = subtotal * .18;
    $('subtotalOS').textContent = subtotal.toFixed(2);
    $('igvOS').textContent = igv.toFixed(2);
    $('totalOS').textContent = (subtotal + igv).toFixed(2);
}

function validarBase() {
    if (!$('nroReferencia').value.trim()) return 'Ingrese el Nro. referencia / interno de la OS.';
    if (!$('rucProveedor').value.trim()) return 'Ingrese el RUC del proveedor.';
    if (!$('razonSocialProveedor').value.trim()) return 'Ingrese la razón social del proveedor.';
    if (!$('fechaEntrega').value) return 'Ingrese la fecha de entrega comprometida.';
    if (!$('proformaProveedor').value.trim()) return 'Ingrese la proforma del proveedor.';
    if (!items.length) return 'Agregue al menos un servicio o producto.';
    if (!$('descripcionFactura').value.trim()) return 'Ingrese la descripción para la factura.';
    if (!$('centroCostos').value.trim()) return 'Ingrese el centro de costos.';
    if (!$('codigoSolped').value.trim()) return 'Ingrese el código SOLPED.';
    return '';
}

function recogerData(nroOS = $('nroOSManual').value.trim() || 'VISTA-PREVIA') {
    return {
        tipoDocumento: 'OS',
        nroOS,
        nroReferencia: $('nroReferencia').value.trim().toUpperCase(),
        fechaGeneracion: $('fechaGeneracion').value,
        fechaEntrega: $('fechaEntrega').value,
        proformaProveedor: $('proformaProveedor').value.trim(),
        proveedor: {
            ruc: $('rucProveedor').value.trim(),
            nombre: $('nombreProveedor').value.trim().toUpperCase(),
            razonSocial: $('razonSocialProveedor').value.trim().toUpperCase(),
            direccion: $('direccionProveedor').value.trim(),
            contacto: $('contactoProveedor').value.trim(),
            telefono: $('telefonoProveedor').value.trim()
        },
        proyecto: $('proyectoOS').value,
        clasificacion: $('clasificacion').value.trim(),
        porcentaje: $('porcentaje').value.trim(),
        moneda: $('monedaOS').value,
        lugarEntrega: $('lugarEntrega').value.trim(),
        condicionPago: $('condicionPago').value.trim(),
        items: structuredClone(items),
        subtotal: Number($('subtotalOS').textContent || 0),
        igv: Number($('igvOS').textContent || 0),
        total: Number($('totalOS').textContent || 0),
        descripcionFactura: $('descripcionFactura').value.trim(),
        horarioFacturas: $('horarioFacturas').value.trim(),
        horarioObra: $('horarioObra').value.trim(),
        requisitosIngreso: $('requisitosIngreso').value.trim(),
        documentosEntrega: $('documentosEntrega').value.trim(),
        aprobadorNombre: $('aprobadorNombre').value.trim(),
        aprobadorCargo: $('aprobadorCargo').value.trim(),
        centroCostos: $('centroCostos').value.trim(),
        compradorCodigo: $('compradorCodigo').value.trim(),
        codigoSolped: $('codigoSolped').value.trim(),
        solicitanteCodigo: $('solicitanteCodigo').value.trim(),
        tipologia: $('tipologia').value.trim(),
        empresa: configDocumentos.empresa,
        terminosCondiciones: configDocumentos.terminosCondiciones
    };
}

async function obtenerNumeroOS() {
    const manual = $('nroOSManual').value.trim().toUpperCase();
    if (manual) return manual;
    return siguienteCorrelativo('OS');
}

async function guardarOS() {
    const error = validarBase();
    if (error) return alert(error);
    const btn = $('btnGuardarOS');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> REGISTRANDO...';
    try {
        const nroOS = await obtenerNumeroOS();
        const data = recogerData(nroOS);
        data.createdAt = serverTimestamp();
        data.estado = 'EMITIDA';
        await addDoc(collection(db,'ordenesServicio'), data);
        await setDoc(doc(db,'proveedores',data.proveedor.ruc), {
            razonSocial:data.proveedor.razonSocial,
            direccion:data.proveedor.direccion,
            atencion:data.proveedor.contacto,
            tlf:data.proveedor.telefono
        }, { merge:true });
        $('vistaNroOS').textContent = nroOS;
        await generarPDFServicio(data,'descargar');
        alert(`✅ Orden de Servicio ${nroOS} registrada correctamente.`);
        location.reload();
    } catch (e) {
        console.error(e);
        alert('❌ No se pudo registrar la OS. Revisa la conexión y permisos de Supabase.');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="bi bi-save"></i> GUARDAR Y GENERAR OS';
    }
}

function aplicarConfiguracion(config) {
    configDocumentos = config;
    proyectos = Object.fromEntries((config.proyectos || []).map(p => [p.nombre,p.direccion]));
    $('proyectoOS').innerHTML = (config.proyectos || []).map(p => `<option value="${p.nombre}">${p.nombre}</option>`).join('');
    const pred = config.proyectoPredeterminado || config.proyectos?.[0]?.nombre || '';
    $('proyectoOS').value = pred;
    $('lugarEntrega').value = proyectos[pred] || config.os?.lugarEntrega || '';
    const os = config.os || {};
    $('condicionPago').value = os.condicionPago || '';
    $('horarioFacturas').value = os.horarioFacturas || '';
    $('horarioObra').value = os.horarioObra || '';
    $('requisitosIngreso').value = os.requisitosIngreso || '';
    $('documentosEntrega').value = os.documentosEntrega || '';
    $('aprobadorNombre').value = os.aprobadorNombre || '';
    $('aprobadorCargo').value = os.aprobadorCargo || '';
    $('tipologia').value = os.tipologia || 'Servicio';
    $('clasificacion').value = os.clasificacion || '';
    $('porcentaje').value = os.porcentaje || '';
    if (os.moneda) $('monedaOS').value = os.moneda;
}

$('btnAgregarServicio').onclick = () => {
    const descripcion = $('descripcionServicio').value.trim();
    const detalle = $('detalleAdicional').value.trim();
    const unidad = $('unidadOS').value;
    const cantidad = Number($('cantidadOS').value);
    const precio = Number($('precioOS').value);
    if (!descripcion || !cantidad || Number.isNaN(precio)) return alert('Complete descripción, cantidad y precio unitario.');
    items.push({ descripcion, detalle, unidad, cantidad, precio, total:cantidad*precio });
    ['descripcionServicio','detalleAdicional','precioOS'].forEach(id => $(id).value='');
    $('cantidadOS').value='1';
    renderItems();
};

$('nroReferencia').addEventListener('input', e => $('vistaNroReferencia').textContent = e.target.value || '----');
$('nroOSManual').addEventListener('input', e => $('vistaNroOS').textContent = e.target.value || 'AL GUARDAR');
$('proyectoOS').addEventListener('change', e => { if (proyectos[e.target.value]) $('lugarEntrega').value = proyectos[e.target.value]; });

$('rucProveedor').addEventListener('blur', async e => {
    const ruc = e.target.value.trim();
    if (ruc.length < 8) return;
    try {
        const snap = await getDoc(doc(db,'proveedores',ruc));
        if (!snap.exists()) return;
        const d = snap.data();
        $('nombreProveedor').value = d.razonSocial || '';
        $('razonSocialProveedor').value = d.razonSocial || '';
        $('direccionProveedor').value = d.direccion || '';
        $('contactoProveedor').value = d.atencion || '';
        $('telefonoProveedor').value = d.tlf || '';
    } catch(e2) { console.warn(e2); }
});

$('btnVistaPrevia').onclick = () => {
    const error = validarBase();
    if (error) return alert(error);
    generarPDFServicio(recogerData(),'ver');
};
$('btnGuardarOS').onclick = guardarOS;
$('btnCerrarSesion').onclick = async () => { await signOut(auth); window.location.href='../index.html'; };

onAuthStateChanged(auth, async user => {
    if (!user) return window.location.href='../index.html';
    try {
        const snap = await getDoc(doc(db,'usuarios',user.uid));
        const rol = snap.exists() ? String(snap.data().rol || '').toLowerCase() : '';
        if (rol !== 'admin') return window.location.href='menu2.html';
        aplicarConfiguracion(await cargarConfiguracionDocumentos());
        setFechaHoy();
        renderItems();
    } catch(e) {
        console.error(e);
        aplicarConfiguracion(DEFAULT_CONFIG_DOCUMENTOS);
        setFechaHoy();
    }
});
