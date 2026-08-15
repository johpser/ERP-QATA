import { db, auth } from './config.js';
import { collection, getDocs, doc, getDoc } from "./supabase-db-compat.js";
import { onAuthStateChanged, signOut } from "./supabase-auth-compat.js";
import { cargarConfiguracionDocumentos } from './document-config.js';
import { generarPDFServicio } from './pdf-service.js';

const $ = id => document.getElementById(id);
const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[ch]));
let registros = [];
let visibles = [];

function moneda(d) { return String(d.moneda||'').toUpperCase().includes('USD') || d.moneda==='$' ? '$' : 'S/'; }
function aplicarFiltros() {
    const q = $('buscarOS').value.trim().toLowerCase();
    const p = $('filtroProyectoOS').value;
    const desde = $('desdeOS').value;
    const hasta = $('hastaOS').value;
    visibles = registros.filter(d => {
        const bag = [d.nroOS,d.nroReferencia,d.proveedor?.ruc,d.proveedor?.razonSocial,d.codigoSolped,d.centroCostos].join(' ').toLowerCase();
        return (!q || bag.includes(q)) && (!p || d.proyecto===p) && (!desde || d.fechaGeneracion>=desde) && (!hasta || d.fechaGeneracion<=hasta);
    });
    render();
}

function render() {
    $('tablaOS').innerHTML = visibles.map((d,i)=>`<tr><td class="fw-bold text-success">${esc(d.nroOS||'')}</td><td>${esc(d.nroReferencia||'')}</td><td>${esc(d.fechaGeneracion||'')}</td><td>${esc(d.proveedor?.razonSocial||'')}</td><td>${esc(d.proveedor?.ruc||'')}</td><td>${esc(d.proyecto||'')}</td><td>${esc(`${d.clasificacion||''} ${d.porcentaje||''}`.trim())}</td><td>${esc(d.codigoSolped||'')}</td><td>${esc(d.fechaEntrega||'')}</td><td class="text-end fw-bold">${moneda(d)} ${Number(d.total||0).toFixed(2)}</td><td class="text-center"><button class="btn btn-outline-primary btn-sm me-1" data-i="${i}" data-a="ver" title="Ver PDF"><i class="bi bi-eye"></i></button><button class="btn btn-outline-success btn-sm" data-i="${i}" data-a="descargar" title="Descargar PDF"><i class="bi bi-file-earmark-pdf"></i></button></td></tr>`).join('') || '<tr><td colspan="11" class="text-center text-muted py-4">No hay Órdenes de Servicio para los filtros seleccionados.</td></tr>';
    $('tablaOS').querySelectorAll('button[data-i]').forEach(b => b.onclick = () => generarPDFServicio(visibles[Number(b.dataset.i)], b.dataset.a==='ver'?'ver':'descargar'));
}

async function cargar() {
    const snap = await getDocs(collection(db,'ordenesServicio'));
    registros = snap.docs.map(x=>({id:x.id,...x.data()})).sort((a,b)=>new Date(b.createdAt||0)-new Date(a.createdAt||0));
    aplicarFiltros();
}

function exportarExcel() {
    const filas = visibles.map(d => ({
        'N° OS': d.nroOS || '',
        'N° REFERENCIA': d.nroReferencia || '',
        'FECHA': d.fechaGeneracion || '',
        'FECHA ENTREGA': d.fechaEntrega || '',
        'RUC': d.proveedor?.ruc || '',
        'PROVEEDOR': d.proveedor?.razonSocial || '',
        'PROYECTO': d.proyecto || '',
        'CLASIFICACIÓN': `${d.clasificacion || ''} ${d.porcentaje || ''}`.trim(),
        'SOLPED': d.codigoSolped || '',
        'CENTRO DE COSTOS': d.centroCostos || '',
        'MONEDA': d.moneda || '',
        'SUBTOTAL': Number(d.subtotal || 0),
        'IGV': Number(d.igv || 0),
        'TOTAL': Number(d.total || 0)
    }));
    if (!filas.length) return alert('No hay Órdenes de Servicio para exportar.');
    const ws = XLSX.utils.json_to_sheet(filas);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Historial OS');
    XLSX.writeFile(wb, 'Historial_OS_QATA.xlsx');
}

['buscarOS','filtroProyectoOS','desdeOS','hastaOS'].forEach(id => $(id).addEventListener(id==='buscarOS'?'input':'change', aplicarFiltros));
$('btnExportarOS').addEventListener('click', exportarExcel);
$('btnCerrarSesion').onclick = async () => { await signOut(auth); location.href='../index.html'; };

onAuthStateChanged(auth, async user => {
    if (!user) return location.href='../index.html';
    const us = await getDoc(doc(db,'usuarios',user.uid));
    if (String(us.data()?.rol||'').toLowerCase() !== 'admin') return location.href='menu2.html';
    const c = await cargarConfiguracionDocumentos();
    $('filtroProyectoOS').innerHTML = '<option value="">TODOS</option>' + (c.proyectos||[]).map(p=>`<option value="${esc(p.nombre)}">${esc(p.nombre)}</option>`).join('');
    await cargar();
});
