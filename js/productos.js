import { db, auth, supabase } from './config.js';
import { collection, onSnapshot, query, orderBy, addDoc, deleteDoc, doc, getDoc } from './supabase-db-compat.js';
import { onAuthStateChanged, signOut } from './supabase-auth-compat.js';

const tablaProductos = document.getElementById('tablaProductos');
const formNuevoProducto = document.getElementById('formNuevoProducto');
const inputBuscador = document.getElementById('inputBuscador');
const filtroTipo = document.getElementById('filtroTipo');
const btnImportar = document.getElementById('btnImportarProductos');
const btnPlantilla = document.getElementById('btnDescargarPlantilla');
const btnNuevo = document.getElementById('btnNuevoProducto');
const inputImportar = document.getElementById('inputImportarProductos');
const resultadoImportacion = document.getElementById('resultadoImportacion');
const ayudaImportacion = document.getElementById('ayudaImportacion');
const contadorProductos = document.getElementById('contadorProductos');

let listaMaestraProductos = [];
let seleccionadosParaRQ = [];
let rolActual = '';

const puedeCrearImportarProductos = () => ['admin','comprador','admin_obra'].includes(rolActual);
const puedeEliminarProductos = () => ['admin','comprador'].includes(rolActual);

onAuthStateChanged(auth, async (user) => {
    if (!user) return window.location.href = '../index.html';
    try {
        const snap = await getDoc(doc(db,'usuarios',user.uid));
        rolActual = snap.exists() ? String(snap.data().rol || '').toLowerCase() : '';
        if (rolActual === 'editor') rolActual = 'admin_obra';
        aplicarPermisosUI();
        iniciarCargaDatos();
    } catch (error) {
        console.error(error);
        window.location.href='../index.html';
    }
});

document.getElementById('btnCerrarSesion')?.addEventListener('click', async () => {
    await signOut(auth);
    window.location.href='../index.html';
});

function aplicarPermisosUI() {
    const gestionar = puedeCrearImportarProductos();
    btnImportar?.classList.toggle('d-none', !gestionar);
    btnPlantilla?.classList.toggle('d-none', !gestionar);
    btnNuevo?.classList.toggle('d-none', !gestionar);
    ayudaImportacion?.classList.toggle('d-none', !gestionar);
}

function iniciarCargaDatos() {
    const q = query(collection(db,'productos'), orderBy('descripcion','asc'));
    onSnapshot(q, snapshot => {
        listaMaestraProductos = snapshot.docs.map(d => ({id:d.id, ...d.data()}));
        if (contadorProductos) contadorProductos.textContent = `${listaMaestraProductos.length.toLocaleString('es-PE')} productos registrados`;
        actualizarFiltroTipos();
        ejecutarFiltroCombinado();
    });
}

function actualizarBotonListo() {
    let btn = document.getElementById('btnListoRQ');
    if (seleccionadosParaRQ.length > 0) {
        if (!btn) {
            btn = document.createElement('button');
            btn.id='btnListoRQ';
            btn.className='btn btn-success btn-lg shadow-lg position-fixed fw-bold';
            btn.style.cssText='bottom:30px;right:30px;z-index:2000;border-radius:50px;padding:15px 30px';
            btn.onclick=()=>{sessionStorage.setItem('productosParaRQ',JSON.stringify(seleccionadosParaRQ));window.location.href='requerimiento.html';};
            document.body.appendChild(btn);
        }
        btn.innerHTML=`<i class="bi bi-check-all"></i> LISTO (${seleccionadosParaRQ.length})`;
    } else btn?.remove();
}

function actualizarTabla(productos) {
    if (!tablaProductos) return;
    tablaProductos.innerHTML='';
    if (!productos.length) {
        tablaProductos.innerHTML='<tr><td colspan="5" class="text-center py-4 text-muted">No hay productos en el catálogo.</td></tr>';
        return;
    }
    productos.forEach(p => {
        const seleccionado = seleccionadosParaRQ.some(x=>x.codigo===p.codigo);
        const tr=document.createElement('tr');
        tr.innerHTML=`
            <td class="text-center fw-bold text-primary small">${esc(p.codigo || 'S/C')}</td>
            <td class="text-uppercase"><span class="badge-tipo">${esc(p.tipo || 'GENERAL')}</span></td>
            <td class="text-uppercase small">${esc(p.descripcion || '')}</td>
            <td class="text-center small">${esc(p.unidad || 'UND')}</td>
            <td class="text-center"><div class="btn-group">
                <button class="btn btn-sm ${seleccionado?'btn-primary':'btn-success'} btn-usar" data-id="${p.id}"><i class="bi ${seleccionado?'bi-check-circle-fill':'bi-plus-circle-fill'}"></i> ${seleccionado?'AÑADIDO':'USAR'}</button>
                ${puedeEliminarProductos()?`<button class="btn btn-sm btn-outline-danger btn-eliminar" data-id="${p.id}"><i class="bi bi-trash"></i></button>`:''}
            </div></td>`;
        tablaProductos.appendChild(tr);
    });
}

function esc(v='') { return String(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }

 tablaProductos?.addEventListener('click', async e => {
    const btn=e.target.closest('button'); if(!btn) return;
    const prod=listaMaestraProductos.find(p=>p.id===btn.dataset.id); if(!prod) return;
    if(btn.classList.contains('btn-usar')) {
        const i=seleccionadosParaRQ.findIndex(x=>x.codigo===prod.codigo);
        if(i===-1) seleccionadosParaRQ.push({codigo:prod.codigo,descripcion:prod.descripcion,unidad:prod.unidad}); else seleccionadosParaRQ.splice(i,1);
        actualizarBotonListo(); ejecutarFiltroCombinado();
    }
    if(btn.classList.contains('btn-eliminar') && puedeEliminarProductos()) {
        if(confirm(`¿Eliminar definitivamente "${prod.descripcion}"?`)) await deleteDoc(doc(db,'productos',prod.id));
    }
});

function codigoBase(tipo, descripcion) {
    const limpia = v => String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^A-Z0-9]/gi,'').toUpperCase();
    const a=(limpia(tipo)||'GENE').slice(0,4).padEnd(4,'X');
    const b=(limpia(descripcion)||'ITEM').slice(0,4).padEnd(4,'X');
    return `${a}-${b}`;
}

function generarCodigoLocal(tipo, descripcion, usados) {
    const base=codigoBase(tipo,descripcion);
    let max=0;
    for(const cod of usados) {
        const m=String(cod).match(new RegExp(`^${base.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}-(\\d+)$`));
        if(m) max=Math.max(max,Number(m[1])||0);
    }
    let n=max+1, codigo='';
    do { codigo=`${base}-${String(n++).padStart(4,'0')}`; } while(usados.has(codigo));
    usados.add(codigo);
    return codigo;
}

async function generarCodigoCorrelativo(tipo, descripcion) {
    return generarCodigoLocal(tipo,descripcion,new Set(listaMaestraProductos.map(p=>String(p.codigo||'').toUpperCase())));
}

formNuevoProducto?.addEventListener('submit', async e => {
    e.preventDefault(); if(!puedeCrearImportarProductos()) return;
    const btn=document.getElementById('btnGuardarProducto'); btn.disabled=true; btn.innerHTML='<span class="spinner-border spinner-border-sm"></span> Procesando...';
    const tipo=document.getElementById('newTipo').value.trim().toUpperCase();
    const descripcion=document.getElementById('newDescripcion').value.trim().toUpperCase();
    const unidad=document.getElementById('newUnidad').value;
    try {
        const codigo=await generarCodigoCorrelativo(tipo,descripcion);
        await addDoc(collection(db,'productos'),{tipo,codigo,descripcion,unidad});
        bootstrap.Modal.getInstance(document.getElementById('modalNuevoProducto'))?.hide();
        formNuevoProducto.reset();
        alert(`✅ Producto guardado.\nCódigo: ${codigo}`);
    } catch(error) { console.error(error); alert('❌ No se pudo registrar el producto.'); }
    finally { btn.disabled=false; btn.innerHTML='GUARDAR PRODUCTO'; }
});

function normHeader(v) {
    return String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]+/g,'_').replace(/^_|_$/g,'');
}
function valorFila(row, aliases) {
    const mapa={}; Object.entries(row||{}).forEach(([k,v])=>mapa[normHeader(k)]=v);
    for(const a of aliases) { const v=mapa[normHeader(a)]; if(v!==undefined && v!==null && String(v).trim()!=='') return v; }
    return '';
}
function normalizarProducto(row) {
    return {
        codigo:String(valorFila(row,['CODIGO','CÓDIGO','SKU','CODIGO_PRODUCTO','CODIGO_MATERIAL'])||'').trim().toUpperCase(),
        tipo:String(valorFila(row,['TIPO','CATEGORIA','CATEGORÍA','FAMILIA'])||'GENERAL').trim().toUpperCase(),
        descripcion:String(valorFila(row,['DESCRIPCION','DESCRIPCIÓN','PRODUCTO','NOMBRE','DESCRIPCION_PRODUCTO'])||'').trim().toUpperCase(),
        unidad:String(valorFila(row,['UNIDAD','UM','U_M','U.M.','UNIDAD_MEDIDA'])||'UND').trim().toUpperCase()
    };
}

btnImportar?.addEventListener('click',()=>inputImportar?.click());
inputImportar?.addEventListener('change', async () => {
    const file=inputImportar.files?.[0]; inputImportar.value='';
    if(!file || !puedeCrearImportarProductos()) return;
    btnImportar.disabled=true; btnImportar.innerHTML='<span class="spinner-border spinner-border-sm"></span> IMPORTANDO...';
    mostrarResultado('Leyendo archivo...','info');
    try {
        const buffer=await file.arrayBuffer();
        const wb=XLSX.read(buffer,{type:'array'});
        const ws=wb.Sheets[wb.SheetNames[0]];
        const raw=XLSX.utils.sheet_to_json(ws,{defval:'',raw:false});
        if(!raw.length) throw new Error('El archivo no contiene filas de productos.');

        const usados=new Set(listaMaestraProductos.map(p=>String(p.codigo||'').trim().toUpperCase()).filter(Boolean));
        const existentesPorCodigo=new Map(listaMaestraProductos.filter(p=>p.codigo).map(p=>[String(p.codigo).trim().toUpperCase(),p]));
        const lotePorCodigo=new Map();
        let omitidos=0;

        for(const r of raw) {
            const p=normalizarProducto(r);
            if(!p.descripcion) { omitidos++; continue; }
            if(!p.codigo) p.codigo=generarCodigoLocal(p.tipo,p.descripcion,usados);
            usados.add(p.codigo);
            lotePorCodigo.set(p.codigo,p); // si viene repetido en Excel, queda la última versión del mismo código
        }

        if(!lotePorCodigo.size) throw new Error('No encontré productos válidos. La columna DESCRIPCION es obligatoria.');
        const filas=[]; let nuevos=0, actualizados=0;
        for(const p of lotePorCodigo.values()) {
            const existe=existentesPorCodigo.get(p.codigo);
            const existenteData = existe ? Object.fromEntries(Object.entries(existe).filter(([k]) => k !== 'id')) : {};
            filas.push({
                bucket:'productos',
                id:existe?.id || crypto.randomUUID(),
                data:{...existenteData, codigo:p.codigo, tipo:p.tipo||'GENERAL', descripcion:p.descripcion, unidad:p.unidad||'UND'},
                updated_at:new Date().toISOString()
            });
            existe ? actualizados++ : nuevos++;
        }

        for(let i=0;i<filas.length;i+=200) {
            const chunk=filas.slice(i,i+200);
            const {error}=await supabase.from('qata_documents').upsert(chunk,{onConflict:'bucket,id'});
            if(error) throw error;
        }
        mostrarResultado(`✅ Importación completada: ${nuevos} nuevos, ${actualizados} actualizados${omitidos?`, ${omitidos} filas omitidas por no tener descripción`:''}.`,'success');
    } catch(error) {
        console.error(error);
        mostrarResultado(`❌ No se pudo importar: ${error?.message || error}`,'danger');
    } finally {
        btnImportar.disabled=false; btnImportar.innerHTML='<i class="bi bi-file-earmark-spreadsheet"></i> IMPORTAR EXCEL / CSV';
    }
});

btnPlantilla?.addEventListener('click',()=>{
    const data=[
        {CODIGO:'ELEC-CABL-0001',TIPO:'ELECTRICO',DESCRIPCION:'CABLE TIERRA AMARILLO 9',UNIDAD:'MTR'},
        {CODIGO:'',TIPO:'FERRETERIA',DESCRIPCION:'TORNILLO AUTOPERFORANTE 1 PULGADA',UNIDAD:'UND'}
    ];
    const ws=XLSX.utils.json_to_sheet(data);
    ws['!cols']=[{wch:22},{wch:20},{wch:55},{wch:14}];
    const wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,ws,'PRODUCTOS');
    XLSX.writeFile(wb,'PLANTILLA_IMPORTAR_PRODUCTOS_QATA.xlsx');
});

function mostrarResultado(texto,tipo) {
    if(!resultadoImportacion) return;
    resultadoImportacion.className=`alert alert-${tipo}`;
    resultadoImportacion.textContent=texto;
}

function actualizarFiltroTipos() {
    if (!filtroTipo) return;
    const actual = filtroTipo.value;
    const tipos = [...new Set(listaMaestraProductos.map(p => String(p.tipo || 'GENERAL').trim().toUpperCase()).filter(Boolean))].sort();
    filtroTipo.innerHTML = '<option value="">🔍 TODOS LOS TIPOS</option>' + tipos.map(t => `<option value="${esc(t)}">${esc(t)}</option>`).join('');
    if (tipos.includes(actual)) filtroTipo.value = actual;
}

function ejecutarFiltroCombinado() {
    const term=inputBuscador?.value.toLowerCase().trim()||'';
    const tipo=filtroTipo?.value.toLowerCase().trim()||'';
    actualizarTabla(listaMaestraProductos.filter(p=>{
        const txt=!term || String(p.descripcion||'').toLowerCase().includes(term) || String(p.codigo||'').toLowerCase().includes(term) || String(p.tipo||'').toLowerCase().includes(term);
        const tip=!tipo || String(p.tipo||'').toLowerCase()===tipo;
        return txt && tip;
    }));
}
inputBuscador?.addEventListener('input',ejecutarFiltroCombinado);
filtroTipo?.addEventListener('change',ejecutarFiltroCombinado);
