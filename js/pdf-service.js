function esc(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}

function multiline(value) {
    return esc(value || '').replace(/\r?\n/g, '<br>');
}

function monedaSimbolo(moneda) {
    return String(moneda || '').toUpperCase().includes('USD') || moneda === '$' ? '$' : 'S/';
}

function fechaBonita(value) {
    if (!value) return '---';
    const [y,m,d] = String(value).split('-').map(Number);
    if (!y || !m || !d) return esc(value);
    return new Intl.DateTimeFormat('es-PE', { day:'2-digit', month:'2-digit', year:'numeric' }).format(new Date(y,m-1,d));
}

function dividirTerminos(texto) {
    const t = String(texto || '').trim();
    const marcas = [
        { re:/\n8\.\s*Documentaci[oó]n:/i, titulo:'HOJA 2 de 4' },
        { re:/\n19\.\s*Embalajes y marcas:/i, titulo:'HOJA 3 de 4' },
        { re:/\n25\.\s*Resoluci[oó]n por conveniencia:/i, titulo:'HOJA 4 de 4' }
    ];
    const posiciones = marcas.map(m => {
        const match = t.match(m.re);
        return match ? t.indexOf(match[0]) + 1 : -1;
    });
    if (posiciones.some(p => p < 0)) {
        const lineas = t.split(/\r?\n/);
        const tam = Math.ceil(lineas.length / 4);
        return [0,1,2,3].map((_,i) => lineas.slice(i*tam,(i+1)*tam).join('\n'));
    }
    return [
        t.slice(0, posiciones[0]).trim(),
        t.slice(posiciones[0], posiciones[1]).trim(),
        t.slice(posiciones[1], posiciones[2]).trim(),
        t.slice(posiciones[2]).trim()
    ];
}

function terminosHtml(texto) {
    return String(texto || '').split(/\r?\n/).map(linea => {
        const limpia = linea.trim();
        if (!limpia) return '<div style="height:3px"></div>';
        const segura = esc(limpia);
        if (/^\d+\.\s/.test(limpia)) return `<div style="font-weight:700;margin:4px 0 1px;page-break-after:avoid">${segura}</div>`;
        if (/^[a-z]\.\s/i.test(limpia) || /^-/.test(limpia)) return `<div style="margin:1px 0 1px 8px">${segura}</div>`;
        return `<div style="margin:1px 0 2px">${segura}</div>`;
    }).join('');
}

function encabezadoResumen(data) {
    const e = data.empresa || {};
    return `
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">
        <div style="width:55%;font-size:8px;line-height:1.35">
            <img src="../imagenes/LOGOQATA.png" style="width:80px;margin-bottom:3px"><br>
            <b style="font-size:9px">${esc(e.razonSocial || 'QATA ASOCIADOS S.A.C.')}</b><br>
            RUC: ${esc(e.ruc || '20605226362')}<br>${esc(e.direccion || '')}
        </div>
        <div style="width:38%;text-align:right;font-size:9px">
            <div style="font-size:16px;font-weight:800">ORDEN DE SERVICIO</div>
            <div style="font-size:11px;font-weight:700">Nro. ${esc(data.nroReferencia || '---')} &nbsp; - &nbsp; ${esc(data.nroOS || '---')}</div>
            <div style="margin-top:24px">Generada el: &nbsp;&nbsp; ${fechaBonita(data.fechaGeneracion)}</div>
        </div>
    </div>`;
}

function cuadroResumen(data) {
    return `
    <table style="width:100%;border-collapse:collapse;font-size:7.3px;table-layout:fixed;margin-bottom:7px">
        <tr>
            <td style="border:1px solid #222;padding:2px;width:11%;font-weight:700">PROVEEDOR</td>
            <td style="border:1px solid #222;padding:2px;width:39%">${esc(data.proveedor?.nombre || data.proveedor?.razonSocial || '')}</td>
            <td style="border:1px solid #222;padding:2px;width:13%;font-weight:700">CLASIFICACIÓN</td>
            <td style="border:1px solid #222;padding:2px;width:25%">${esc(data.clasificacion || '')}</td>
            <td style="border:1px solid #222;padding:2px;width:12%;text-align:center">${esc(data.porcentaje || '')}</td>
        </tr>
        <tr>
            <td style="border:1px solid #222;padding:2px;font-weight:700">RAZÓN SOCIAL</td><td style="border:1px solid #222;padding:2px">${esc(data.proveedor?.razonSocial || '')}</td>
            <td style="border:1px solid #222;padding:2px;font-weight:700">MONEDA</td><td colspan="2" style="border:1px solid #222;padding:2px">${esc(data.moneda || '')}</td>
        </tr>
        <tr>
            <td style="border:1px solid #222;padding:2px;font-weight:700">RUC</td><td style="border:1px solid #222;padding:2px">${esc(data.proveedor?.ruc || '')}</td>
            <td style="border:1px solid #222;padding:2px;font-weight:700">LUGAR DE ENTREGA:</td><td colspan="2" style="border:1px solid #222;padding:2px">${esc(data.lugarEntrega || '')}</td>
        </tr>
        <tr>
            <td style="border:1px solid #222;padding:2px;font-weight:700;vertical-align:top">DIRECCIÓN</td><td rowspan="2" style="border:1px solid #222;padding:2px;vertical-align:top">${multiline(data.proveedor?.direccion || '')}</td>
            <td style="border:1px solid #222;padding:2px;font-weight:700;vertical-align:top">CONDICIÓN DE PAGO</td><td rowspan="2" style="border:1px solid #222;padding:2px;vertical-align:top">${multiline(data.condicionPago || '')}</td>
            <td style="border:1px solid #222;padding:2px;font-weight:700;vertical-align:top">FECHA DE ENTREGA COMPROMETIDA:<br><span style="font-weight:400">${fechaBonita(data.fechaEntrega)}</span></td>
        </tr>
        <tr>
            <td style="border:1px solid #222;padding:2px;font-weight:700">CONTACTO<br><span style="font-weight:400">${esc(data.proveedor?.contacto || '')}</span><br>TELÉFONO<br><span style="font-weight:400">${esc(data.proveedor?.telefono || '')}</span></td>
            <td style="border:1px solid #222;padding:2px;font-weight:700;vertical-align:top">PROFORMA DEL PROVEEDOR:<br><span style="font-weight:400">${esc(data.proformaProveedor || '')}</span></td>
        </tr>
    </table>`;
}

function paginaTerminos(data, texto, indice) {
    return `
    <section style="page-break-before:always;padding:8mm 8mm 6mm;font-family:Arial,sans-serif;color:#111;background:#fff">
        ${encabezadoResumen(data)}
        ${cuadroResumen(data)}
        <div style="font-size:7.2px;line-height:1.25;text-align:justify">
            <div style="font-size:8.5px;font-weight:800;margin:7px 0 5px">TÉRMINOS Y CONDICIONES GENERALES DE COMPRAS, SERVICIOS Y CONTRATACIONES [HOJA ${indice} de 4]</div>
            ${terminosHtml(texto)}
            ${indice === 4 ? '<div style="font-weight:700;margin-top:6px">Fin de los Términos y Condiciones de la Orden de Compra / Servicio</div>' : ''}
        </div>
    </section>`;
}

export function generarPDFServicio(data, modo = 'descargar') {
    const simbolo = monedaSimbolo(data.moneda);
    const terminos = dividirTerminos(data.terminosCondiciones || '');
    const element = document.createElement('div');
    const items = data.items || [];

    element.innerHTML = `
    <section style="padding:7mm 8mm 6mm;font-family:Arial,sans-serif;color:#111;background:#fff;min-height:280mm">
        ${encabezadoResumen(data)}
        ${cuadroResumen(data)}

        <table style="width:100%;border-collapse:collapse;font-size:7.4px;table-layout:fixed;margin-bottom:6px">
            <thead><tr>
                <th style="border:1px solid #222;padding:2px;width:7%">#</th>
                <th style="border:1px solid #222;padding:2px;width:26%;text-align:left">DESCRIPCIÓN DEL SERVICIO / PRODUCTO</th>
                <th style="border:1px solid #222;padding:2px;width:26%;text-align:left">DETALLE ADICIONAL</th>
                <th style="border:1px solid #222;padding:2px;width:8%">UM</th>
                <th style="border:1px solid #222;padding:2px;width:7%">CANT</th>
                <th style="border:1px solid #222;padding:2px;width:12%">PRECIO UNIT</th>
                <th style="border:1px solid #222;padding:2px;width:14%">PRECIO TOTAL</th>
            </tr></thead>
            <tbody>${items.map((i,idx)=>`<tr>
                <td style="border-right:1px dotted #999;padding:2px;vertical-align:top;text-align:center">${String(idx+1).padStart(2,'0')}</td>
                <td style="border-right:1px dotted #999;padding:2px;vertical-align:top">${esc(i.descripcion)}</td>
                <td style="border-right:1px dotted #999;padding:2px;vertical-align:top;white-space:pre-line">${esc(i.detalle)}</td>
                <td style="border-right:1px dotted #999;padding:2px;vertical-align:top;text-align:center">${esc(i.unidad)}</td>
                <td style="border-right:1px dotted #999;padding:2px;vertical-align:top;text-align:right">${Number(i.cantidad||0).toFixed(2)}</td>
                <td style="border-right:1px dotted #999;padding:2px;vertical-align:top;text-align:right">${Number(i.precio||0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}</td>
                <td style="padding:2px;vertical-align:top;text-align:right">${Number(i.total||0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}</td>
            </tr>`).join('')}</tbody>
        </table>

        <div style="display:flex;justify-content:flex-end;font-size:7.5px;margin:2px 0 8px">
            <table style="border-collapse:collapse;width:30%">
                <tr><td style="font-weight:700;text-align:right;padding:1px 5px">Subtotal:</td><td style="text-align:right">${simbolo} ${Number(data.subtotal||0).toLocaleString('en-US',{minimumFractionDigits:2})}</td></tr>
                <tr><td style="font-weight:700;text-align:right;padding:1px 5px">IGV (18%):</td><td style="text-align:right">${simbolo} ${Number(data.igv||0).toLocaleString('en-US',{minimumFractionDigits:2})}</td></tr>
                <tr><td style="font-weight:800;text-align:right;padding:1px 5px">Total ${esc(data.moneda || '')}</td><td style="text-align:right;font-weight:800">${simbolo} ${Number(data.total||0).toLocaleString('en-US',{minimumFractionDigits:2})}</td></tr>
            </table>
        </div>

        <div style="font-size:7.1px;line-height:1.28">
            <div style="font-weight:700;margin-top:4px">1. DESCRIPCIÓN PARA LA FACTURA</div>
            <div style="font-size:11px;margin:4px 0 10px;white-space:pre-line">${esc(data.descripcionFactura || '')}</div>
            <div style="font-weight:700">2. HORARIO RECEPCIÓN DE FACTURAS Y DE MERCANCÍAS EN OFICINA CENTRAL</div><div style="white-space:pre-line;margin:1px 0 6px">${esc(data.horarioFacturas || '')}</div>
            <div style="font-weight:700">3. HORARIO RECEPCIÓN DE PRODUCTOS O SERVICIOS EN OBRA O PROYECTO</div><div style="white-space:pre-line;margin:1px 0 6px">${esc(data.horarioObra || '')}</div>
            <div style="font-weight:700">4. REQUISITOS MÍNIMOS PARA INGRESO A LA OFICINA CENTRAL, OBRA O PROYECTO</div><div style="white-space:pre-line;margin:1px 0 6px">${esc(data.requisitosIngreso || '')}</div>
            <div style="font-weight:700">5. DOCUMENTOS Y REQUISITOS OBLIGATORIOS PARA ENTREGA DE PRODUCTOS</div><div style="white-space:pre-line;margin:1px 0 8px">${esc(data.documentosEntrega || '')}</div>
        </div>

        <div style="border-top:1px solid #222;padding-top:4px;display:flex;justify-content:flex-end;font-size:7px;text-align:right;margin-bottom:5px">
            <div>Orden aprobada por:<br><b>${esc(data.aprobadorNombre || '')}</b><br>${esc(data.aprobadorCargo || '')}</div>
        </div>

        <table style="width:100%;border-collapse:collapse;font-size:6.7px;table-layout:fixed">
            <tr><td style="border:1px solid #222;padding:2px;font-weight:700;width:12%">CENTRO DE COSTOS</td><td style="border:1px solid #222;padding:2px;width:38%">${esc(data.centroCostos || '')}</td><td style="border:1px solid #222;padding:2px;font-weight:700;width:12%">COMPRADOR</td><td style="border:1px solid #222;padding:2px;width:38%">${esc(data.compradorCodigo || '')}</td></tr>
            <tr><td style="border:1px solid #222;padding:2px;font-weight:700">CÓDIGO SOLPED</td><td style="border:1px solid #222;padding:2px">${esc(data.codigoSolped || '')}</td><td style="border:1px solid #222;padding:2px;font-weight:700">SOLICITANTE</td><td style="border:1px solid #222;padding:2px">${esc(data.solicitanteCodigo || '')}</td></tr>
            <tr><td style="border:1px solid #222;padding:2px;font-weight:700">TIPOLOGÍA</td><td style="border:1px solid #222;padding:2px">${esc(data.tipologia || '')}</td><td style="border:1px solid #222;padding:2px;font-weight:700">CLASIFICACIÓN</td><td style="border:1px solid #222;padding:2px">${esc(data.clasificacion || '')} &nbsp;&nbsp; ${esc(data.porcentaje || '')}</td></tr>
        </table>
        <div style="font-size:7.4px;text-align:center;font-weight:800;margin-top:7px;line-height:1.25">ESTE DOCUMENTO TIENE 05 PÁGINAS<br>ESTIMADO PROVEEDOR, REVISAR DETENIDAMENTE LOS TÉRMINOS Y CONDICIONES GENERALES DETALLADOS A CONTINUACIÓN (4 HOJAS)<br>LA EMISIÓN Y REMISIÓN DE LA FACTURA ASOCIADA A ESTA ORDEN INVOLUCRA UNA ACEPTACIÓN DE TODO LO DETALLADO EN LA MISMA</div>
    </section>
    ${terminos.map((t,i)=>paginaTerminos(data,t,i+1)).join('')}`;

    const filename = `${data.nroOS || 'ORDEN-SERVICIO'}.pdf`;
    const opt = {
        margin: 0,
        filename,
        image: { type:'jpeg', quality:.98 },
        html2canvas: { scale:2.1, useCORS:true },
        jsPDF: { unit:'mm', format:'a4', orientation:'portrait' },
        pagebreak: { mode:['css','legacy'] }
    };
    if (modo === 'ver') return html2pdf().set(opt).from(element).outputPdf('bloburl').then(url => window.open(url,'_blank'));
    return html2pdf().set(opt).from(element).save();
}
