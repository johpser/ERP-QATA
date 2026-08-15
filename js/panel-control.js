import { modulosPorPerfil, normalizarRol, PAGE_TO_MODULE } from './access-control.js';
import { auth, db } from './config.js';
import { collection, getDocs, doc, getDoc } from "./supabase-db-compat.js";
import { onAuthStateChanged, signOut } from "./supabase-auth-compat.js";

const $ = id => document.getElementById(id);
const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[ch]));

function numero(value) {
    if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
    const raw = String(value ?? '').replace(/[^0-9,.-]/g, '').trim();
    if (!raw) return 0;
    const normal = raw.includes(',') && raw.includes('.')
        ? raw.replace(/,/g, '')
        : raw.replace(',', '.');
    const n = Number(normal);
    return Number.isFinite(n) ? n : 0;
}

function fecha(data) {
    const raw = data?.fechaEmision || data?.fechaGeneracion || data?.fecha || data?.createdAt?.toDate?.();
    if (!raw) return '—';
    if (raw instanceof Date) return raw.toLocaleDateString('es-PE');
    const d = new Date(raw);
    return Number.isNaN(d.getTime()) ? String(raw) : d.toLocaleDateString('es-PE');
}

function marcaTiempo(data) {
    const c = data?.createdAt;
    if (c?.seconds) return c.seconds * 1000;
    if (typeof c === 'string') { const tc = new Date(c).getTime(); if (!Number.isNaN(tc)) return tc; }
    const raw = data?.fechaEmision || data?.fechaGeneracion || data?.fecha || '';
    const t = new Date(raw).getTime();
    return Number.isNaN(t) ? 0 : t;
}

function simbolo(moneda='') {
    return String(moneda).toUpperCase().includes('USD') || moneda === '$' ? '$' : 'S/';
}

function ocPendientePago(o) {
    const estado = String(o.estadoPago || o.estado_pago || o.pagoEstado || '').trim().toUpperCase();
    if (!estado) return true;
    return !['PAGADO','PAGADA','CANCELADO','CANCELADA'].includes(estado);
}

function filaVacia(cols, texto='Sin registros') {
    return `<tr><td colspan="${cols}" class="empty">${esc(texto)}</td></tr>`;
}

async function documentos(nombre) {
    const snap = await getDocs(collection(db, nombre));
    return snap.docs.map(d => ({ id:d.id, ...d.data() }));
}

async function cargarPanel() {
    $('btnActualizar').disabled = true;
    $('panelMensaje').textContent = 'Actualizando indicadores…';
    try {
        const [req, oc, os, guias] = await Promise.all([
            documentos('requerimientos'),
            documentos('ordenesCompra'),
            documentos('ordenesServicio'),
            documentos('guiasRemision')
        ]);
        const valorOC = oc.reduce((sum, x) => sum + numero(x.total), 0);
        $('kpiReq').textContent = req.length;
        $('kpiOC').textContent = oc.length;
        $('kpiOS').textContent = os.length;
        $('kpiGuias').textContent = guias.length;
        $('kpiPago').textContent = oc.filter(ocPendientePago).length;
        $('kpiValor').textContent = `S/ ${valorOC.toLocaleString('es-PE',{minimumFractionDigits:2,maximumFractionDigits:2})}`;

        const ocRec = [...oc].sort((a,b)=>marcaTiempo(b)-marcaTiempo(a)).slice(0,6);
        $('tablaOC').innerHTML = ocRec.length ? ocRec.map(o => `<tr><td class="fw-bold">${esc(o.nroOC || o.numero || o.id)}</td><td>${esc(fecha(o))}</td><td>${esc(o.proveedor?.razonSocial || '')}</td><td><span class="badge badge-soft">${esc(o.comprador?.proyecto || o.proyecto || '—')}</span></td><td class="text-end fw-bold">${esc(o.moneda || 'S/')} ${numero(o.total).toFixed(2)}</td></tr>`).join('') : filaVacia(5);

        const osRec = [...os].sort((a,b)=>marcaTiempo(b)-marcaTiempo(a)).slice(0,6);
        $('tablaOS').innerHTML = osRec.length ? osRec.map(o => `<tr><td class="fw-bold text-success">${esc(o.nroOS || o.id)}</td><td>${esc(fecha(o))}</td><td>${esc(o.proveedor?.razonSocial || '')}</td><td><span class="badge badge-soft">${esc(o.proyecto || '—')}</span></td><td class="text-end fw-bold">${simbolo(o.moneda)} ${numero(o.total).toFixed(2)}</td></tr>`).join('') : filaVacia(5);

        const reqRec = [...req].sort((a,b)=>marcaTiempo(b)-marcaTiempo(a)).slice(0,7);
        $('tablaReq').innerHTML = reqRec.length ? reqRec.map(r => `<tr><td>${esc(fecha(r))}</td><td>${esc(r.solicitante || r.solicitadoPor || r.usuario || '—')}</td><td>${esc(r.proyecto || '—')}</td><td><span class="badge text-bg-light border">${esc(r.estado || 'REGISTRADO')}</span></td></tr>`).join('') : filaVacia(4);
        $('panelMensaje').textContent = `Actualizado: ${new Date().toLocaleString('es-PE')}. El Panel de Control es solo de consulta.`;
    } catch (error) {
        console.error(error);
        $('panelMensaje').className = 'alert alert-danger mt-3 mb-0 small';
        $('panelMensaje').textContent = 'No se pudieron cargar todos los indicadores. Revisa la conexión y permisos de Supabase.';
    } finally {
        $('btnActualizar').disabled = false;
    }
}

$('btnActualizar').addEventListener('click', cargarPanel);
$('btnCerrarSesion').addEventListener('click', async () => { await signOut(auth); location.href='../index.html'; });

onAuthStateChanged(auth, async user => {
    if (!user) return location.href='../index.html';
    const snap = await getDoc(doc(db,'usuarios',user.uid));
    const perfil = snap.exists() ? (snap.data() || {}) : {};
    const modulos = new Set(modulosPorPerfil(perfil));
    if (!modulos.has('dashboard')) return location.href = normalizarRol(perfil.rol)==='admin' ? 'menu.html' : 'menu2.html';
    document.querySelectorAll('a[href]').forEach(a => {
        const page = String(a.getAttribute('href')||'').split('/').pop();
        const required = PAGE_TO_MODULE[page];
        if (required && required !== 'dashboard' && !modulos.has(required)) a.classList.add('d-none');
        if (page==='configuracion.html' && !modulos.has('admin_config')) a.classList.add('d-none');
    });
    await cargarPanel();
});
