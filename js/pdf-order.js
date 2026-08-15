function esc(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}

function terminosHtml(texto) {
    return String(texto || '').split(/\r?\n/).map(linea => {
        const limpia = linea.trim();
        if (!limpia) return '<div style="height:4px"></div>';
        const segura = esc(limpia);
        if (/^\d+\.\s/.test(limpia)) {
            return `<div style="font-weight:700; margin:7px 0 3px; page-break-after:avoid;">${segura}</div>`;
        }
        if (/^[a-z]\.\s/i.test(limpia) || /^-/.test(limpia)) {
            return `<div style="margin:2px 0 2px 10px;">${segura}</div>`;
        }
        return `<div style="margin:2px 0 5px;">${segura}</div>`;
    }).join('');
}

export async function generarPDFOrden(data, modo = 'descargar') {
    const numero = data.nroOC || 'OC';
    const titulo = 'ORDEN DE COMPRA';
    const simb = data.moneda || 'S/';
    const subtotalVal = data.subtotal || (parseFloat(data.total || 0) / 1.18).toFixed(2);
    const igvVal = data.igv || (parseFloat(data.total || 0) - parseFloat(subtotalVal || 0)).toFixed(2);
    const empresa = data.empresa || {};
    const terminos = data.terminosCondiciones || '';
    const documentacion = data.documentacionObligatoria || '';

    const element = document.createElement('div');
    element.innerHTML = `
        <div style="padding: 10mm; font-family: 'Segoe UI', Arial, sans-serif; color: #333; background: #fff;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
                <div style="width:25%;"><img src="../imagenes/LOGOQATA.png" style="width:150px;"></div>
                <div style="width:45%; text-align:center; font-size:10px; line-height:1.45;">
                    <h3 style="margin:0; color:#030303; font-size:16px;">${esc(empresa.razonSocial || 'QATA ASOCIADOS S.A.C.')}</h3>
                    <p style="margin:0;">${esc(empresa.direccion || 'Av. Camino Real 1236, San Isidro - Lima')}</p>
                    <p style="margin:0;">Email: ${esc(empresa.correo || 'Paster@grupoqata.pe')}</p>
                    <p style="margin:0;">Teléfono: ${esc(empresa.telefono || '957 254 498')}</p>
                </div>
                <div style="width:30%; border:2.5px solid #000; text-align:center; padding:10px; border-radius:8px; background:#f0f7ff;">
                    <h5 style="margin:0; font-size:12px;">RUC: ${esc(empresa.ruc || '20605226362')}</h5>
                    <h4 style="margin:5px 0; font-size:14px;">${titulo}</h4>
                    <h3 style="margin:0; color:#dc3545; font-size:18px;">${esc(numero)}</h3>
                </div>
            </div>

            <div style="display:flex; gap:12px; margin-bottom:10px;">
                <div style="flex:1; border:1px solid #ddd; border-radius:6px; overflow:hidden;">
                    <div style="background:#007bff; color:white; padding:6px 10px; font-weight:bold; font-size:11px;">DATOS DEL PROVEEDOR</div>
                    <div style="padding:9px; font-size:10px; line-height:1.55;">
                        <b>SEÑORES:</b> ${esc(data.proveedor?.razonSocial || '---')}<br>
                        <b>RUC:</b> ${esc(data.proveedor?.ruc || '---')}<br>
                        <b>DIRECCIÓN:</b> ${esc(data.proveedor?.direccion || '---')}<br>
                        <b>ATENCIÓN:</b> ${esc(data.proveedor?.atencion || '---')}<br>
                        <b>TLF:</b> ${esc(data.proveedor?.tlf || '---')}<br>
                        <b>CORREO:</b> ${esc(data.proveedor?.correo || '---')}
                    </div>
                </div>
                <div style="flex:1; border:1px solid #ddd; border-radius:6px; overflow:hidden;">
                    <div style="background:#007bff; color:white; padding:6px 10px; font-weight:bold; font-size:11px;">DETALLES DEL DOCUMENTO</div>
                    <div style="padding:9px; font-size:10px; line-height:1.55;">
                        <b>FECHA EMISIÓN:</b> ${esc(data.fechaEmision || '---')}<br>
                        <b>N° COTIZACIÓN:</b> ${esc(data.nroCotizacion || '---')}<br>
                        <b>FECHA VENC.:</b> <span style="color:red; font-weight:bold;">${esc(data.fechaVencimiento || '---')}</span><br>
                        <b>PROYECTO:</b> ${esc(data.comprador?.proyecto || '---')}<br>
                        <b>LUGAR ENTREGA:</b> ${esc(data.comprador?.lugarEntrega || '---')}<br>
                        <b>SOLICITADO POR:</b> ${esc(data.comprador?.nombre || '---')}
                    </div>
                </div>
            </div>

            <div style="border:1.5px solid #333; border-radius:6px; padding:8px 12px; margin:0 0 12px; font-size:11px; background:#f8f9fa; display:flex; justify-content:space-between; gap:10px;">
                <div><b>FORMA DE PAGO:</b> ${esc(data.proveedor?.pago || '---')}</div>
                <div><b>DÍAS CRÉDITO:</b> ${esc(data.proveedor?.diasCredito || '0')}</div>
                <div><b>HORARIO RECEPCIÓN:</b> ${esc(data.comprador?.horarioRecepcion || '---')}</div>
            </div>

            <table style="width:100%; border-collapse:collapse; font-size:10px; margin-bottom:14px; table-layout:fixed;">
                <thead>
                    <tr style="background:#212529; color:white; text-align:center;">
                        <th style="padding:8px; border:1px solid #333; width:15%;">CÓD.</th>
                        <th style="padding:8px; border:1px solid #333; text-align:left; width:39%;">DESCRIPCIÓN</th>
                        <th style="padding:8px; border:1px solid #333; width:9%;">UND</th>
                        <th style="padding:8px; border:1px solid #333; width:9%;">CANT.</th>
                        <th style="padding:8px; border:1px solid #333; width:13%;">P. UNIT</th>
                        <th style="padding:8px; border:1px solid #333; width:15%;">TOTAL</th>
                    </tr>
                </thead>
                <tbody>
                    ${(data.items || []).map(i => `
                        <tr>
                            <td style="border:1px solid #ddd; padding:7px 5px; text-align:center; font-size:8px; word-break:break-all;">${esc(i.codigo)}</td>
                            <td style="border:1px solid #ddd; padding:7px; line-height:1.35;">${esc(i.desc)}</td>
                            <td style="border:1px solid #ddd; padding:7px; text-align:center;">${esc(i.unidad)}</td>
                            <td style="border:1px solid #ddd; padding:7px; text-align:center; font-weight:bold;">${esc(i.cant)}</td>
                            <td style="border:1px solid #ddd; padding:7px; text-align:right;">${esc(simb)} ${Number(i.precio || 0).toFixed(2)}</td>
                            <td style="border:1px solid #ddd; padding:7px; text-align:right; font-weight:bold;">${esc(simb)} ${Number(i.total || 0).toFixed(2)}</td>
                        </tr>`).join('')}
                </tbody>
            </table>

            <div style="display:flex; justify-content:flex-end; margin-bottom:12px; page-break-inside:avoid;">
                <div style="width:35%; font-size:11px;">
                    <div style="padding:3px 0;">Subtotal: <b>${esc(simb)} ${esc(subtotalVal)}</b></div>
                    <div style="padding:3px 0;">IGV (18%): <b>${esc(simb)} ${esc(igvVal)}</b></div>
                    <div style="padding:7px 0; border-top:2px solid #007bff; font-weight:bold; color:#007bff; font-size:14px;">TOTAL: ${esc(simb)} ${esc(data.total || '0.00')}</div>
                </div>
            </div>

            <div style="border:1px solid #333; border-radius:8px; padding:10px; font-size:9.5px; page-break-inside:avoid;">
                <div style="font-weight:bold; text-align:center; border-bottom:1px solid #ccc; padding-bottom:6px; margin-bottom:7px;">DOCUMENTACIÓN OBLIGATORIA</div>
                <div style="text-align:justify; line-height:1.4;">${esc(documentacion)}</div>
            </div>
            <div style="text-align:center; width:100%; margin-top:8px; page-break-inside:avoid;">
                <img src="../imagenes/sello.png" style="width:70px; height:auto;">
            </div>

            <div style="page-break-before:always; font-size:8.5px; line-height:1.35; text-align:justify;">
                <h3 style="text-align:center; font-size:13px; margin:0 0 12px;">TÉRMINOS Y CONDICIONES GENERALES DE COMPRAS, SERVICIOS Y CONTRATACIONES</h3>
                <div style="white-space:normal;">${terminosHtml(terminos)}</div>
            </div>
        </div>`;

    const opt = {
        margin: 0,
        filename: `${numero}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2.4, useCORS: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak: { mode: ['css', 'legacy'] }
    };

    if (modo === 'ver') {
        return html2pdf().set(opt).from(element).outputPdf('bloburl').then(url => window.open(url, '_blank'));
    }
    return html2pdf().set(opt).from(element).save();
}
