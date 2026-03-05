// Genera el PDF de una cotización para descarga desde el dashboard
const {
    Cotizacion,
    DetalleCotizacion,
    Estado,
    Usuario,
    CotizacionTecnica,
    CotizacionTalla,
    CotizacionColor,
    CotizacionInsumo,
    Tecnica,
    Talla,
    Color,
    Insumo,
    Producto,
    Parte,
    SubParte,
} = require('../models');

const PDFDocument = require('pdfkit');
const https = require('https');
const http  = require('http');

// ─────────────────────────────────────────────────────────
// Descarga una imagen remota y devuelve un Buffer
// ─────────────────────────────────────────────────────────
function fetchImageBuffer(url) {
    return new Promise((resolve, reject) => {
        if (!url) return resolve(null);
        const lib = url.startsWith('https') ? https : http;
        lib.get(url, (res) => {
            const chunks = [];
            res.on('data', c => chunks.push(c));
            res.on('end',  () => resolve(Buffer.concat(chunks)));
            res.on('error', reject);
        }).on('error', reject);
    });
}

// ─────────────────────────────────────────────────────────
// Paleta de colores (coherente con el design system)
// ─────────────────────────────────────────────────────────
const P = {
    navy:        '#1a2540',
    navyLight:   '#2d3f6e',
    accent:      '#4f8ef7',
    accentSoft:  '#eef3fe',
    success:     '#16a34a',
    successSoft: '#f0fdf4',
    warning:     '#d97706',
    warningSoft: '#fffbeb',
    danger:      '#dc2626',
    dangerSoft:  '#fef2f2',
    purple:      '#7c3aed',
    purpleSoft:  '#f5f3ff',
    muted:       '#64748b',
    border:      '#e2e8f0',
    bg:          '#f8fafc',
    white:       '#ffffff',
    text:        '#0f172a',
};

// Estado → color de badge
const estadoColor = (nombre) => ({
    Pendiente:  P.warning,
    Aprobada:   P.success,
    Cancelada:  P.danger,
    Procesada:  P.accent,
}[nombre] || P.muted);

const estadoSoft = (nombre) => ({
    Pendiente:  P.warningSoft,
    Aprobada:   P.successSoft,
    Cancelada:  P.dangerSoft,
    Procesada:  P.accentSoft,
}[nombre] || P.bg);

// ─────────────────────────────────────────────────────────
// Helpers de dibujo reutilizables
// ─────────────────────────────────────────────────────────

/** Rectángulo con relleno y radio (PDFKit no tiene roundedRect nativo en todos los trazados) */
function fillRect(doc, x, y, w, h, color) {
    doc.rect(x, y, w, h).fill(color);
}

/** Línea divisoria suave */
function divider(doc, x1, x2, y, color = P.border, lw = 0.5) {
    doc.moveTo(x1, y).lineTo(x2, y).strokeColor(color).lineWidth(lw).stroke();
}

/** Etiqueta + valor en dos líneas (para la ficha de cliente) */
function labelValue(doc, label, value, x, y, colW) {
    doc.fillColor(P.muted).font('Helvetica').fontSize(8).text(label.toUpperCase(), x, y, { width: colW });
    doc.fillColor(P.text).font('Helvetica-Bold').fontSize(10).text(value || 'N/A', x, y + 10, { width: colW });
}

/** Badge de estado (rectángulo coloreado con texto) */
function drawEstadoBadge(doc, texto, x, y, w = 90) {
    const color = estadoColor(texto);
    const soft  = estadoSoft(texto);
    doc.roundedRect(x, y, w, 20, 10).fill(soft);
    doc.fillColor(color).font('Helvetica-Bold').fontSize(8)
        .text(texto.toUpperCase(), x, y + 6, { width: w, align: 'center' });
}

/** Chip pequeño de texto (tallas, colores…) */
function drawChip(doc, texto, x, y, color = P.accent, softColor = P.accentSoft) {
    const tw = doc.widthOfString(texto, { font: 'Helvetica', size: 8 });
    const chipW = tw + 14;
    doc.roundedRect(x, y, chipW, 14, 7).fill(softColor);
    doc.fillColor(color).font('Helvetica').fontSize(8).text(texto, x + 7, y + 3);
    return chipW + 5; // margen derecho
}

/** Cabecera de sección reutilizable */
function sectionHeader(doc, titulo, y, pageW, iconChar = '') {
    fillRect(doc, 50, y, pageW, 24, P.navy);
    doc.fillColor(P.white).font('Helvetica-Bold').fontSize(10)
        .text(`${iconChar}  ${titulo}`.trim(), 62, y + 7, { width: pageW - 24 });
    return y + 24;
}

// ─────────────────────────────────────────────────────────
// CONTROLADOR PRINCIPAL
// ─────────────────────────────────────────────────────────
exports.descargarPdfCotizacion = async (req, res) => {
    try {
        const { cotizacionID } = req.params;

        console.log('\n' + '='.repeat(60));
        console.log('GENERANDO PDF DE COTIZACIÓN #' + cotizacionID);
        console.log('='.repeat(60));

        // ── 1. Obtener cotización completa ──
        const cotizacion = await Cotizacion.findByPk(cotizacionID, {
            include: [
                { model: Usuario,  as: 'usuario' },
                { model: Estado,   as: 'estado'  },
                {
                    model: DetalleCotizacion,
                    as: 'detalles',
                    include: [
                        { model: Producto, as: 'producto' },
                        {
                            model: CotizacionTecnica,
                            as: 'tecnicas',
                            include: [
                                { model: Tecnica,  as: 'tecnica'  },
                                { model: Parte,    as: 'parte'    },
                                // Incluye SubParte si existe en el modelo
                                ...(SubParte ? [{ model: SubParte, as: 'subparte' }] : []),
                            ]
                        },
                        { model: CotizacionTalla,  as: 'tallas',  include: [{ model: Talla,  as: 'talla'  }] },
                        { model: CotizacionColor,  as: 'colores', include: [{ model: Color,  as: 'color'  }] },
                        { model: CotizacionInsumo, as: 'insumos', include: [{ model: Insumo, as: 'insumo' }] },
                    ]
                }
            ]
        });

        if (!cotizacion) {
            return res.status(404).json({ message: 'Cotización no encontrada', cotizacionID });
        }

        // ── 2. Validar que todos los diseños tienen costo ──
        const todasLasTecnicas = cotizacion.detalles?.flatMap(d => d.tecnicas || []) || [];
        const tecnicasSinCosto = todasLasTecnicas.filter(t => !t.CostoTecnica || parseFloat(t.CostoTecnica) === 0);

        if (tecnicasSinCosto.length > 0) {
            return res.status(400).json({
                message: `No se puede generar el PDF. Hay ${tecnicasSinCosto.length} diseño(s) sin precio asignado.`,
                tecnicasSinCosto: tecnicasSinCosto.map(t => `${t.tecnica?.Nombre || 'Técnica'} en ${t.parte?.Nombre || 'N/A'}`),
                instruccion: 'Asigna el costo de todos los diseños antes de descargar el PDF.'
            });
        }

        // ── 3. Pre-cargar imágenes de diseños ──
        const imagenesDisenos = {};
        for (const detalle of cotizacion.detalles || []) {
            for (const tec of detalle.tecnicas || []) {
                const imgUrl = tec.ImagenDiseno || tec.tecnica?.ImagenURL || tec.ImagenURL || null;
                if (imgUrl && !imagenesDisenos[imgUrl]) {
                    try {
                        imagenesDisenos[imgUrl] = await fetchImageBuffer(imgUrl);
                    } catch (e) {
                        console.warn('No se pudo cargar imagen:', imgUrl, e.message);
                        imagenesDisenos[imgUrl] = null;
                    }
                }
            }
        }

        // ── 4. Crear el documento PDF ──
        const doc = new PDFDocument({
            size: 'A4',
            margin: 50,
            info: {
                Title:   `Cotización #${cotizacion.CotizacionID}`,
                Author:  'StampLab',
                Subject: 'Cotización de productos personalizados',
            },
        });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="cotizacion_${cotizacion.CotizacionID}.pdf"`);
        doc.pipe(res);

        const pageW  = doc.page.width - 100;   // ancho útil
        const LEFT   = 50;
        const RIGHT  = doc.page.width - 50;

        // ══════════════════════════════════════════════
        // ▌ ENCABEZADO NAVY
        // ══════════════════════════════════════════════
        const HEADER_H = 100;
        // Fondo degradado simulado con dos rectángulos
        doc.rect(0, 0, doc.page.width, HEADER_H).fill(P.navy);
        doc.rect(0, 0, doc.page.width / 2, HEADER_H).fill(P.navyLight);

        // Nombre empresa
        doc.fillColor(P.white).font('Helvetica-Bold').fontSize(24)
            .text('StampLab', LEFT, 22);

        doc.fillColor('rgba(255,255,255,0.6)').font('Helvetica').fontSize(9)
            .text('Cotización de Productos Personalizados', LEFT, 50);

        // Número de cotización (derecha)
        doc.fillColor(P.white).font('Helvetica-Bold').fontSize(20)
            .text(`#${cotizacion.CotizacionID}`, 0, 18, { align: 'right', width: RIGHT });

        // Fecha (derecha)
        doc.fillColor('rgba(255,255,255,0.6)').font('Helvetica').fontSize(9)
            .text(
                new Date(cotizacion.FechaCotizacion).toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' }),
                0, 44, { align: 'right', width: RIGHT }
            );

        // Badge estado
        const estadoNombre = cotizacion.estado?.Nombre || 'Pendiente';
        drawEstadoBadge(doc, estadoNombre, RIGHT - 95, 62, 95);

        let y = HEADER_H + 24;

        // ══════════════════════════════════════════════
        // ▌ INFORMACIÓN DEL CLIENTE
        // ══════════════════════════════════════════════
        y = sectionHeader(doc, 'INFORMACIÓN DEL CLIENTE', y, pageW);
        y += 14;

        const u    = cotizacion.usuario || {};
        const colW = pageW / 2 - 10;

        // Fila 1
        labelValue(doc, 'Nombre',    u.Nombre                  || 'N/A', LEFT,          y, colW);
        labelValue(doc, 'Documento', String(u.DocumentoID || 'N/A'),     LEFT + colW + 20, y, colW);
        y += 30;

        // Fila 2
        labelValue(doc, 'Correo',    u.Correo   || 'N/A', LEFT,              y, colW);
        labelValue(doc, 'Teléfono',  u.Telefono || 'N/A', LEFT + colW + 20,  y, colW);
        y += 30;

        divider(doc, LEFT, RIGHT, y);
        y += 20;

        // ══════════════════════════════════════════════
        // ▌ DETALLE DE PRODUCTOS
        // ══════════════════════════════════════════════
        y = sectionHeader(doc, 'DETALLE DE PRODUCTOS', y, pageW);
        y += 16;

        for (let idx = 0; idx < cotizacion.detalles.length; idx++) {
            const detalle = cotizacion.detalles[idx];

            // Altura estimada del bloque completo
            const blockH = estimarAltura(detalle, imagenesDisenos);

            if (y + blockH > doc.page.height - 60) {
                doc.addPage();
                y = 50;
            }

            // ── Tarjeta del producto ──
            // Borde izquierdo accent
            doc.rect(LEFT, y, 4, blockH - 10).fill(idx % 2 === 0 ? P.accent : P.purple);

            // Fondo de la tarjeta
            doc.rect(LEFT + 4, y, pageW - 4, blockH - 10).fill(idx % 2 === 0 ? P.accentSoft : P.purpleSoft);

            const cardX = LEFT + 14;
            const cardW = pageW - 24;

            // Nombre del producto
            const nombreProducto = detalle.TraePrenda
                ? 'Prenda llevada por el cliente'
                : (detalle.producto?.Nombre || 'Producto sin especificar');

            doc.fillColor(idx % 2 === 0 ? P.accent : P.purple)
                .font('Helvetica-Bold').fontSize(12)
                .text(`${idx + 1}.  ${nombreProducto}`, cardX, y + 8, { width: cardW - 100 });

            // Chip cantidad (top-right de la tarjeta)
            doc.roundedRect(RIGHT - 90, y + 6, 85, 18, 9).fill(idx % 2 === 0 ? P.accent : P.purple);
            doc.fillColor(P.white).font('Helvetica-Bold').fontSize(8)
                .text(`${detalle.Cantidad} unidades`, RIGHT - 90, y + 11, { width: 85, align: 'center' });

            let cy = y + 26;

            // Descripción de prenda propia
            if (detalle.TraePrenda && detalle.PrendaDescripcion) {
                doc.fillColor(P.muted).font('Helvetica').fontSize(8).text('Descripción:', cardX, cy);
                cy += 11;
                doc.fillColor(P.text).font('Helvetica').fontSize(9).text(detalle.PrendaDescripcion, cardX + 10, cy, { width: cardW - 20 });
                cy += 14;
            }

            // Tallas
            if (!detalle.TraePrenda && detalle.tallas?.length > 0) {
                doc.fillColor(P.muted).font('Helvetica-Bold').fontSize(8).text('TALLAS', cardX, cy);
                cy += 12;
                let cx2 = cardX;
                for (const t of detalle.tallas) {
                    const txt = `${t.talla?.Nombre || '?'} · ${t.Cantidad} uds · $${Number(t.talla?.Precio || 0).toLocaleString('es-CO')}`;
                    const w2  = drawChip(doc, txt, cx2, cy, P.navy, '#e8edf5');
                    cx2 += w2;
                    if (cx2 > RIGHT - 60) { cx2 = cardX; cy += 18; }
                }
                cy += 18;
            }

            // Colores
            if (!detalle.TraePrenda && detalle.colores?.length > 0) {
                doc.fillColor(P.muted).font('Helvetica-Bold').fontSize(8).text('COLORES', cardX, cy);
                cy += 12;
                let cx2 = cardX;
                for (const c of detalle.colores) {
                    const txt = `${c.color?.Nombre || '?'} · ${c.Cantidad} uds`;
                    const w2  = drawChip(doc, txt, cx2, cy, P.success, P.successSoft);
                    cx2 += w2;
                    if (cx2 > RIGHT - 60) { cx2 = cardX; cy += 18; }
                }
                cy += 18;
            }

            // Telas / Insumos
            if (!detalle.TraePrenda && detalle.insumos?.length > 0) {
                doc.fillColor(P.muted).font('Helvetica-Bold').fontSize(8).text('TELAS / INSUMOS', cardX, cy);
                cy += 12;
                let cx2 = cardX;
                for (const ins of detalle.insumos) {
                    const txt = `${ins.insumo?.Nombre || 'Tela'} · +$${Number(ins.insumo?.PrecioTela || 0).toLocaleString('es-CO')}`;
                    const w2  = drawChip(doc, txt, cx2, cy, P.warning, P.warningSoft);
                    cx2 += w2;
                    if (cx2 > RIGHT - 60) { cx2 = cardX; cy += 18; }
                }
                cy += 18;
            }

            // ── Diseños (técnicas) ──
            if (detalle.tecnicas?.length > 0) {
                cy += 4;

                // Header de diseños
                fillRect(doc, cardX, cy, cardW, 18, P.purple);
                doc.fillColor(P.white).font('Helvetica-Bold').fontSize(9)
                    .text(`DISEÑOS APLICADOS  (${detalle.tecnicas.length})`, cardX + 8, cy + 5, { width: cardW - 16 });
                cy += 20;

                for (const tec of detalle.tecnicas) {
                    if (cy > doc.page.height - 120) {
                        doc.addPage();
                        cy = 50;
                    }

                    // Imagen del diseño (si existe)
                    const imgUrl    = tec.ImagenDiseno || tec.tecnica?.ImagenURL || tec.ImagenURL || null;
                    const imgBuffer = imgUrl ? imagenesDisenos[imgUrl] : null;

                    const IMG_W  = 72;
                    const IMG_H  = 72;
                    const hasImg = !!imgBuffer;
                    const rowH   = hasImg ? IMG_H + 12 : 56;

                    // Fondo fila diseño
                    doc.rect(cardX, cy, cardW, rowH).fill('#f0ebff');

                    // Imagen (izquierda)
                    if (hasImg) {
                        try {
                            doc.image(imgBuffer, cardX + 6, cy + 6, { width: IMG_W, height: IMG_H, fit: [IMG_W, IMG_H] });
                        } catch (_) {
                            // Si falla el render, dibujar placeholder
                            doc.rect(cardX + 6, cy + 6, IMG_W, IMG_H).fill(P.border);
                            doc.fillColor(P.muted).font('Helvetica').fontSize(7)
                                .text('sin imagen', cardX + 6, cy + IMG_H / 2 - 4, { width: IMG_W, align: 'center' });
                        }
                    }

                    const textX = hasImg ? cardX + IMG_W + 14 : cardX + 10;
                    const textW = hasImg ? cardW - IMG_W - 20 : cardW - 20;

                    // Nombre de la técnica
                    doc.fillColor(P.purple).font('Helvetica-Bold').fontSize(10)
                        .text(tec.tecnica?.Nombre || 'Técnica', textX, cy + 8, { width: textW });

                    // Parte
                    const parteNombre    = tec.parte?.Nombre    || null;
                    const subParteNombre = tec.subparte?.Nombre || tec.SubParteNombre || tec.NombreSubParte || null;

                    const parteLabel    = parteNombre    ? parteNombre    : 'Sin parte';
                    const subParteLabel = subParteNombre ? subParteNombre : 'Sin subparte';

                    doc.fillColor(P.muted).font('Helvetica').fontSize(8)
                        .text('Parte:', textX, cy + 22, { continued: true })
                        .fillColor(P.text).font('Helvetica-Bold')
                        .text(`  ${parteLabel}`);

                    doc.fillColor(P.muted).font('Helvetica').fontSize(8)
                        .text('Subparte:', textX, cy + 34, { continued: true })
                        .fillColor(P.text).font('Helvetica-Bold')
                        .text(`  ${subParteLabel}`);

                    // Observaciones
                    if (tec.Observaciones) {
                        doc.fillColor(P.muted).font('Helvetica').fontSize(8)
                            .text('Obs:', textX, cy + 46, { continued: true })
                            .fillColor(P.text).font('Helvetica')
                            .text(`  ${tec.Observaciones}`, { width: textW - 20 });
                    }

                    // Costo (badge verde)
                    const costoTxt = `$${Number(tec.CostoTecnica || 0).toLocaleString('es-CO')}`;
                    const costoW   = 80;
                    doc.roundedRect(RIGHT - costoW - 10, cy + 6, costoW, 18, 9).fill(P.successSoft);
                    doc.fillColor(P.success).font('Helvetica-Bold').fontSize(9)
                        .text(costoTxt, RIGHT - costoW - 10, cy + 11, { width: costoW, align: 'center' });

                    cy += rowH + 6;
                }
            }

            y = cy + 16;
        }

        // ══════════════════════════════════════════════
        // ▌ RESUMEN DE PRECIOS
        // ══════════════════════════════════════════════
        if (y > doc.page.height - 200) {
            doc.addPage();
            y = 50;
        }

        y = sectionHeader(doc, 'RESUMEN DE PRECIOS', y, pageW);
        y += 14;

        let granTotal = 0;

        for (let idx = 0; idx < cotizacion.detalles.length; idx++) {
            const detalle = cotizacion.detalles[idx];

            const precioBase    = parseFloat(detalle.producto?.PrecioBase || 0);
            const precioTalla   = parseFloat(detalle.tallas?.[0]?.talla?.Precio || 0);
            const precioTela    = parseFloat(detalle.insumos?.[0]?.insumo?.PrecioTela || 0);
            const costoTecnicas = (detalle.tecnicas || []).reduce((s, t) => s + parseFloat(t.CostoTecnica || 0), 0);
            const precioUnit    = precioBase + precioTalla + precioTela + costoTecnicas;
            const subtotal      = precioUnit * detalle.Cantidad;
            granTotal          += subtotal;

            const bg = idx % 2 === 0 ? P.bg : P.white;
            fillRect(doc, LEFT, y - 4, pageW, 30, bg);

            const nombreProd = detalle.TraePrenda
                ? 'Prenda propia'
                : (detalle.producto?.Nombre || 'Producto');

            doc.fillColor(P.navy).font('Helvetica-Bold').fontSize(9)
                .text(`${idx + 1}. ${nombreProd}`, LEFT + 8, y, { width: pageW / 2 });

            doc.fillColor(P.muted).font('Helvetica').fontSize(9)
                .text(`${detalle.Cantidad} × $${precioUnit.toLocaleString('es-CO')}`, LEFT + pageW / 2, y, { width: 120, align: 'right' });

            doc.fillColor(P.text).font('Helvetica-Bold').fontSize(10)
                .text(`$${subtotal.toLocaleString('es-CO')}`, RIGHT - 70, y, { width: 70, align: 'right' });

            y += 16;

            // Sub-ítems
            const subItems = [
                precioBase    > 0 ? ['Precio base',        precioBase]    : null,
                precioTalla   > 0 ? ['Talla',              precioTalla]   : null,
                precioTela    > 0 ? ['Tela',               precioTela]    : null,
                costoTecnicas > 0 ? ['Diseños/técnicas',   costoTecnicas] : null,
            ].filter(Boolean);

            for (const [subLabel, subVal] of subItems) {
                doc.fillColor(P.muted).font('Helvetica').fontSize(7.5)
                    .text(`+ ${subLabel}`, LEFT + 22, y, { width: 160 });
                doc.fillColor(P.muted).font('Helvetica').fontSize(7.5)
                    .text(`$${subVal.toLocaleString('es-CO')}`, RIGHT - 70, y, { width: 70, align: 'right' });
                y += 12;
            }
            y += 4;
        }

        // Línea + TOTAL
        divider(doc, LEFT + pageW / 2, RIGHT, y, P.navy, 1.5);
        y += 10;

        fillRect(doc, LEFT + pageW / 2 - 10, y, pageW - pageW / 2 + 10, 36, P.navy);
        doc.fillColor(P.white).font('Helvetica-Bold').fontSize(11)
            .text('TOTAL', LEFT + pageW / 2 + 4, y + 11);
        doc.fillColor(P.white).font('Helvetica-Bold').fontSize(14)
            .text(
                `$${Number(cotizacion.ValorTotal || granTotal).toLocaleString('es-CO')}`,
                RIGHT - 80, y + 8,
                { width: 80, align: 'right' }
            );
        y += 50;

        // ══════════════════════════════════════════════
        // ▌ NOTAS
        // ══════════════════════════════════════════════
        if (y > doc.page.height - 120) {
            doc.addPage();
            y = 50;
        }

        fillRect(doc, LEFT, y, pageW, 70, P.successSoft);
        doc.roundedRect(LEFT, y, pageW, 70, 8).strokeColor(P.successBorder || '#bbf7d0').lineWidth(1).stroke();

        doc.fillColor(P.success).font('Helvetica-Bold').fontSize(9)
            .text('Notas importantes', LEFT + 12, y + 10);

        doc.fillColor(P.success).font('Helvetica').fontSize(8)
            .text(
                '•  Esta cotización es válida por 15 días calendario a partir de la fecha de emisión.\n' +
                '•  Los precios están expresados en pesos colombianos (COP).\n' +
                '•  El stock se descuenta únicamente al convertir la cotización en venta.',
                LEFT + 12, y + 24,
                { width: pageW - 24 }
            );

        y += 80;

        // ══════════════════════════════════════════════
        // ▌ PIE DE PÁGINA
        // ══════════════════════════════════════════════
        const footerY = doc.page.height - 38;
        divider(doc, LEFT, RIGHT, footerY - 10, P.border, 0.5);
        doc.fillColor(P.muted).font('Helvetica').fontSize(8)
            .text(
                `StampLab  ·  Cotización #${cotizacion.CotizacionID}  ·  Generado el ${new Date().toLocaleDateString('es-CO')}`,
                LEFT, footerY,
                { align: 'center', width: pageW }
            );

        doc.end();

        console.log(`✅ PDF generado correctamente para cotización #${cotizacionID}`);

    } catch (error) {
        console.error('\nERROR AL GENERAR PDF:', error.message);
        if (!res.headersSent) {
            res.status(500).json({
                message: 'Error al generar el PDF',
                error: error.message,
                stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
            });
        }
    }
};

// ─────────────────────────────────────────────────────────
// Helper: estima la altura de un bloque producto
// ─────────────────────────────────────────────────────────
function estimarAltura(detalle, imagenesDisenos = {}) {
    let h = 54;  // cabecera + cantidad
    if (detalle.TraePrenda && detalle.PrendaDescripcion) h += 30;
    if (detalle.tallas?.length)   h += 34;
    if (detalle.colores?.length)  h += 34;
    if (detalle.insumos?.length)  h += 34;

    if (detalle.tecnicas?.length) {
        h += 24; // header diseños
        for (const tec of detalle.tecnicas) {
            const imgUrl = tec.ImagenDiseno || tec.tecnica?.ImagenURL || tec.ImagenURL || null;
            const hasImg = imgUrl && !!imagenesDisenos[imgUrl];
            h += (hasImg ? 84 : 62) + 6;
        }
    }
    return h + 16;
}