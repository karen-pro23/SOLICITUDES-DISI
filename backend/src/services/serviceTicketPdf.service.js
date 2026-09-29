const PDFDocument = require('pdfkit');

/**
 * Default static data matching the official ticket attention summary voucher
 */
const DEFAULT_STATIC_DATA = {
  ticketNumber: '40145',
  transferred: 'NO',
  requestDate: '20/7/2026',
  requestTime: '11:05:49 a. m.',
  department: 'SERVICIOS GENERALES',
  extension: '2842',
  requesterName: 'luzmary grisales',
  requesterIdNumber: 'V-15.482.913',
  requesterPosition: 'SECRETARIO EJECUTIVO I',
  requestReason: 'n: consecutivo 0271 cpu impresora l220 0079 carpeta compartida mantenimiento de impresora',
  assignedArea: 'SOPORTE',
  requestObservations: 'se compartio carpeta y se realizo mantenimiento quedando operativo los equipos',
  assignedTechnician: 'OCTAVIANO ARAQUE - 13793172',
  startTime: '11:21:21 a. m.',
  closeTime: '11:23:05 a. m.',
  closeDate: '20/7/2026',
  responseTime: '0,001203704',
  attentionObservations: 'se compartio carpeta y se realizo mantenimiento quedando operativo los equipos',
  operator: 'SONIA CACERES',
};

const HEADER_BG = '#E9EEF4';
const BORDER_COLOR = '#000000';
const TEXT_COLOR = '#000000';
const WATERMARK_COLOR = '#CBD5E1';

/**
 * Maps database ticket to PDF format data with fallback to static defaults
 */
function mapTicketToPdfData(ticket = {}) {
  if (!ticket || Object.keys(ticket).length === 0) {
    return { ...DEFAULT_STATIC_DATA };
  }

  let requestDate = DEFAULT_STATIC_DATA.requestDate;
  let requestTime = DEFAULT_STATIC_DATA.requestTime;
  if (ticket.created_at) {
    const d = new Date(ticket.created_at);
    requestDate = `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
    requestTime = d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  let startTime = DEFAULT_STATIC_DATA.startTime;
  if (ticket.service_start_time) {
    const d = new Date(ticket.service_start_time);
    startTime = d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  let closeTime = DEFAULT_STATIC_DATA.closeTime;
  let closeDate = DEFAULT_STATIC_DATA.closeDate;
  if (ticket.service_close_time) {
    const d = new Date(ticket.service_close_time);
    closeDate = `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
    closeTime = d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  // Cálculo del tiempo de respuesta (duración de la atención):
  // Fracción de día (ms / 86400000) formateada con 9 decimales y coma,
  // idéntico a la fórmula y formato del reporte físico oficial (e.g. 0,001203704).
  let responseTime = DEFAULT_STATIC_DATA.responseTime;
  const startTs = ticket.service_start_time 
    ? new Date(ticket.service_start_time).getTime() 
    : (ticket.created_at ? new Date(ticket.created_at).getTime() : null);
  const closeTs = ticket.service_close_time 
    ? new Date(ticket.service_close_time).getTime() 
    : (ticket.completed_at ? new Date(ticket.completed_at).getTime() : null);

  if (startTs && closeTs && closeTs >= startTs) {
    const diffDays = (closeTs - startTs) / 86400000;
    responseTime = diffDays.toFixed(9).replace('.', ',');
  } else if (ticket.response_time) {
    responseTime = ticket.response_time;
  }

  // Cargo del solicitante desde la BD (persona.cargo_id -> cargos.name)
  const cargoFromDb = ticket.cargo_name || ticket.requester_position || ticket.position;
  const requesterPosition = cargoFromDb || DEFAULT_STATIC_DATA.requesterPosition;

  return {
    ticketNumber: ticket.ticket_code || DEFAULT_STATIC_DATA.ticketNumber,
    transferred: ticket.transferred ? 'SI' : DEFAULT_STATIC_DATA.transferred,
    requestDate: ticket.request_date || requestDate,
    requestTime: ticket.request_time || requestTime,
    department: ticket.department_name || DEFAULT_STATIC_DATA.department,
    extension: ticket.extension || DEFAULT_STATIC_DATA.extension,
    requesterName: ticket.requester_name || ticket.created_by_name || DEFAULT_STATIC_DATA.requesterName,
    requesterIdNumber: ticket.requester_cedula || ticket.identification_number || ticket.cedula
      ? (String(ticket.requester_cedula || ticket.identification_number || ticket.cedula).trim().startsWith('V') || String(ticket.requester_cedula || ticket.identification_number || ticket.cedula).trim().startsWith('E')
          ? String(ticket.requester_cedula || ticket.identification_number || ticket.cedula).trim()
          : `V-${String(ticket.requester_cedula || ticket.identification_number || ticket.cedula).trim()}`)
      : DEFAULT_STATIC_DATA.requesterIdNumber,
    requesterPosition: requesterPosition,
    requestReason: ticket.process_description || ticket.subject || DEFAULT_STATIC_DATA.requestReason,
    assignedArea: ticket.area_name || DEFAULT_STATIC_DATA.assignedArea,
    requestObservations: ticket.observations || DEFAULT_STATIC_DATA.requestObservations,
    assignedTechnician: ticket.technician_name || DEFAULT_STATIC_DATA.assignedTechnician,
    startTime: startTime,
    closeTime: closeTime,
    closeDate: closeDate,
    responseTime: responseTime,
    attentionObservations: ticket.close_observations || ticket.observations || DEFAULT_STATIC_DATA.attentionObservations,
    operator: ticket.operator || DEFAULT_STATIC_DATA.operator,
  };
}

/**
 * Draws a single bordered cell with optional background fill and text
 */
function drawCell(doc, x, y, width, height, options = {}) {
  const {
    text = '',
    subtext = null,
    fill = null,
    font = 'Helvetica',
    fontSize = 7,
    textColor = TEXT_COLOR,
    align = 'center',
    boldTitle = null,
    borderWidth = 0.75,
    borderColor = BORDER_COLOR,
    paddingTop = null,
    paddingLeft = 4,
    paddingRight = 4,
  } = options;

  doc.save();

  // Background fill
  if (fill) {
    doc.rect(x, y, width, height).fill(fill);
  }

  // Border
  doc.rect(x, y, width, height)
    .lineWidth(borderWidth)
    .strokeColor(borderColor)
    .stroke();

  // Content
  if (boldTitle && subtext !== null) {
    const padTop = paddingTop !== null ? paddingTop : 2.5;
    const textY = y + padTop;
    const textWidth = width - (paddingLeft + paddingRight);

    doc.fillColor(textColor);
    doc.font('Helvetica-Bold').fontSize(fontSize);
    const titleHeight = doc.heightOfString(boldTitle, { width: textWidth });
    doc.text(boldTitle, x + paddingLeft, textY, { width: textWidth, align: 'left' });

    doc.font('Helvetica').fontSize(fontSize - 0.5);
    doc.text(subtext || '', x + paddingLeft, textY + titleHeight + 1, {
      width: textWidth,
      align: 'left',
      lineGap: 1,
    });
  } else if (text !== '' && text !== null && text !== undefined) {
    doc.fillColor(textColor);
    doc.font(font).fontSize(fontSize);

    const textWidth = width - (paddingLeft + paddingRight);
    const strText = String(text);
    const textHeight = doc.heightOfString(strText, { width: textWidth });

    const calculatedTop = paddingTop !== null ? paddingTop : Math.max(1, (height - textHeight) / 2);

    doc.text(strText, x + paddingLeft, y + calculatedTop, {
      width: textWidth,
      align,
      ellipsis: true,
    });
  }

  doc.restore();
}

/**
 * Renders one voucher block at the specified (startX, startY)
 */
function renderVoucher(doc, startX, startY, data) {
  const totalW = 564;
  let currY = startY;

  // 1. SOLICITUD & DEPENDENCIA SOLICITANTE
  const halfW = totalW / 2; // 282
  drawCell(doc, startX, currY, halfW, 13, {
    text: 'SOLICITUD',
    font: 'Helvetica-Bold',
    fontSize: 7.5,
    fill: HEADER_BG,
    align: 'center',
  });
  drawCell(doc, startX + halfW, currY, halfW, 13, {
    text: 'DEPENDENCIA SOLICITANTE',
    font: 'Helvetica-Bold',
    fontSize: 7.5,
    fill: HEADER_BG,
    align: 'center',
  });
  currY += 13;

  // 2. Sub-headers row 1
  const wNum = 70;
  const wTrans = 72;
  const wFec = 70;
  const wHora = 70;
  const wDep = 202;
  const wExt = 80;

  drawCell(doc, startX, currY, wNum, 12, { text: 'NÚMERO', font: 'Helvetica-Bold', fontSize: 6.5, fill: HEADER_BG });
  drawCell(doc, startX + wNum, currY, wTrans, 12, { text: 'TRANSFERIDA', font: 'Helvetica-Bold', fontSize: 6.5, fill: HEADER_BG });
  drawCell(doc, startX + wNum + wTrans, currY, wFec, 12, { text: 'FECHA', font: 'Helvetica-Bold', fontSize: 6.5, fill: HEADER_BG });
  drawCell(doc, startX + wNum + wTrans + wFec, currY, wHora, 12, { text: 'HORA', font: 'Helvetica-Bold', fontSize: 6.5, fill: HEADER_BG });

  drawCell(doc, startX + halfW, currY, wDep, 12, { text: 'DEPENDENCIA', font: 'Helvetica-Bold', fontSize: 6.5, fill: HEADER_BG });
  drawCell(doc, startX + halfW + wDep, currY, wExt, 12, { text: 'EXTENSIÓN', font: 'Helvetica-Bold', fontSize: 6.5, fill: HEADER_BG });
  currY += 12;

  // 3. Values row 1
  drawCell(doc, startX, currY, wNum, 14, { text: data.ticketNumber, font: 'Helvetica-Bold', fontSize: 7.5 });
  drawCell(doc, startX + wNum, currY, wTrans, 14, { text: data.transferred, font: 'Helvetica-Bold', fontSize: 7.5 });
  drawCell(doc, startX + wNum + wTrans, currY, wFec, 14, { text: data.requestDate, font: 'Helvetica', fontSize: 7 });
  drawCell(doc, startX + wNum + wTrans + wFec, currY, wHora, 14, { text: data.requestTime, font: 'Helvetica', fontSize: 7 });

  drawCell(doc, startX + halfW, currY, wDep, 14, { text: data.department, font: 'Helvetica-Bold', fontSize: 7.5 });
  drawCell(doc, startX + halfW + wDep, currY, wExt, 14, { text: data.extension, font: 'Helvetica-Bold', fontSize: 7.5 });
  currY += 14;

  // 4. DATOS DEL FUNCIONARIO SOLICITANTE header
  drawCell(doc, startX, currY, totalW, 13, {
    text: 'DATOS DEL FUNCIONARIO SOLICITANTE',
    font: 'Helvetica-Bold',
    fontSize: 7.5,
    fill: HEADER_BG,
  });
  currY += 13;

  // 5. Sub-headers: APELLIDOS Y NOMBRES (260), NRO. DE CÉDULA (120), CARGO (184)
  const wNom = 260;
  const wCed = 120;
  const wCargo = 184;

  drawCell(doc, startX, currY, wNom, 12, { text: 'APELLIDOS Y NOMBRES', font: 'Helvetica-Bold', fontSize: 6.5 });
  drawCell(doc, startX + wNom, currY, wCed, 12, { text: 'NRO. DE CÉDULA', font: 'Helvetica-Bold', fontSize: 6.5 });
  drawCell(doc, startX + wNom + wCed, currY, wCargo, 12, { text: 'CARGO', font: 'Helvetica-Bold', fontSize: 6.5 });
  currY += 12;

  // 6. Values row: Requester
  drawCell(doc, startX, currY, wNom, 13, { text: data.requesterName, font: 'Helvetica', fontSize: 7.5 });
  drawCell(doc, startX + wNom, currY, wCed, 13, { text: data.requesterIdNumber || '', font: 'Helvetica', fontSize: 7.5 });
  drawCell(doc, startX + wNom + wCed, currY, wCargo, 13, { text: data.requesterPosition, font: 'Helvetica-Bold', fontSize: 7 });
  currY += 13;

  // 7. MOTIVO DE LA SOLICITUD
  drawCell(doc, startX, currY, totalW, 20, {
    boldTitle: 'MOTIVO DE LA SOLICITUD:',
    subtext: data.requestReason,
    fontSize: 6.5,
    paddingTop: 2,
  });
  currY += 20;

  // 8. AREA ASIGNADA
  drawCell(doc, startX, currY, totalW, 18, {
    boldTitle: 'AREA ASIGNADA:',
    subtext: data.assignedArea,
    fontSize: 6.5,
    paddingTop: 2,
  });
  currY += 18;

  // 9. OBSERVACIONES (Solicitud)
  drawCell(doc, startX, currY, totalW, 18, {
    boldTitle: 'OBSERVACIONES:',
    subtext: data.requestObservations,
    fontSize: 6.5,
    paddingTop: 2,
  });
  currY += 18;

  // 10. TÉCNICO ASIGNADO | INFORMACIÓN SOBRE LA ATENCIÓN
  const wTec = 230;
  const wInfo = 334;
  drawCell(doc, startX, currY, wTec, 13, {
    text: 'TÉCNICO ASIGNADO',
    font: 'Helvetica-Bold',
    fontSize: 7.5,
    fill: HEADER_BG,
  });
  drawCell(doc, startX + wTec, currY, wInfo, 13, {
    text: 'INFORMACIÓN SOBRE LA ATENCIÓN',
    font: 'Helvetica-Bold',
    fontSize: 7.5,
    fill: HEADER_BG,
  });
  currY += 13;

  // 11. Sub-headers Técnico & Atención
  const wIni = 78;
  const wCie = 78;
  const wFecCie = 82;
  const wTiem = 96;

  drawCell(doc, startX, currY, wTec, 12, { text: 'APELLIDOS Y NOMBRES', font: 'Helvetica-Bold', fontSize: 6.5 });
  drawCell(doc, startX + wTec, currY, wIni, 12, { text: 'HORA DE INICIO', font: 'Helvetica-Bold', fontSize: 6.5 });
  drawCell(doc, startX + wTec + wIni, currY, wCie, 12, { text: 'HORA DE CIERRE', font: 'Helvetica-Bold', fontSize: 6.5 });
  drawCell(doc, startX + wTec + wIni + wCie, currY, wFecCie, 12, { text: 'FECHA DE CIERRE', font: 'Helvetica-Bold', fontSize: 6.5 });
  drawCell(doc, startX + wTec + wIni + wCie + wFecCie, currY, wTiem, 12, { text: 'TIEMPO DE RESPUESTA', font: 'Helvetica-Bold', fontSize: 6 });
  currY += 12;

  // 12. Values Técnico & Atención
  drawCell(doc, startX, currY, wTec, 14, { text: data.assignedTechnician, font: 'Helvetica-Bold', fontSize: 7 });
  drawCell(doc, startX + wTec, currY, wIni, 14, { text: data.startTime, font: 'Helvetica', fontSize: 7 });
  drawCell(doc, startX + wTec + wIni, currY, wCie, 14, { text: data.closeTime, font: 'Helvetica', fontSize: 7 });
  drawCell(doc, startX + wTec + wIni + wCie, currY, wFecCie, 14, { text: data.closeDate, font: 'Helvetica', fontSize: 7 });
  drawCell(doc, startX + wTec + wIni + wCie + wFecCie, currY, wTiem, 14, { text: data.responseTime, font: 'Helvetica', fontSize: 7 });
  currY += 14;

  // 13. OBSERVACIONES (Atención)
  drawCell(doc, startX, currY, totalW, 18, {
    boldTitle: 'OBSERVACIONES:',
    subtext: data.attentionObservations,
    fontSize: 6.5,
    paddingTop: 2,
  });
  currY += 18;

  // 14. TIPO DE SERVICIO PRESTADO header
  drawCell(doc, startX, currY, totalW, 13, {
    text: 'TIPO DE SERVICIO PRESTADO',
    font: 'Helvetica-Bold',
    fontSize: 7.5,
    fill: HEADER_BG,
  });
  currY += 13;

  // 15-17. 3x3 Grid of Service Types
  const colW = totalW / 3; // 188 each
  const serviceRowH = 11;

  // Row 1
  drawCell(doc, startX, currY, colW, serviceRowH, { text: 'INST/ACTUAL DE PROGRAMA(S)', font: 'Helvetica-Bold', fontSize: 6.5 });
  drawCell(doc, startX + colW, currY, colW, serviceRowH, { text: 'ADMON/SOPORTE CENTRAL TELEFÓNICA', font: 'Helvetica-Bold', fontSize: 6.5 });
  drawCell(doc, startX + colW * 2, currY, colW, serviceRowH, { text: 'INST/REV/REP HARDWARE', font: 'Helvetica-Bold', fontSize: 6.5 });
  currY += serviceRowH;

  // Row 2
  drawCell(doc, startX, currY, colW, serviceRowH, { text: 'CHEQUEO/MTTO/REP DE PC', font: 'Helvetica-Bold', fontSize: 6.5 });
  drawCell(doc, startX + colW, currY, colW, serviceRowH, { text: 'INST/REP/MTTO DE TELEFONÍA', font: 'Helvetica-Bold', fontSize: 6.5 });
  drawCell(doc, startX + colW * 2, currY, colW, serviceRowH, { text: 'OTROS', font: 'Helvetica-Bold', fontSize: 6.5 });
  currY += serviceRowH;

  // Row 3
  drawCell(doc, startX, currY, colW, serviceRowH, { text: 'VERIF. DE CONEXIÓN A RED', font: 'Helvetica-Bold', fontSize: 6.5 });
  drawCell(doc, startX + colW, currY, colW, serviceRowH, { text: 'INST/REP/MTTO DE PUNTO DE RED', font: 'Helvetica-Bold', fontSize: 6.5 });
  // Row 3 Col 3: OPERADOR: | SONIA CACERES with vertical divider
  const opLabelW = 54;
  const opValueW = colW - opLabelW;
  drawCell(doc, startX + colW * 2, currY, opLabelW, serviceRowH, { text: 'OPERADOR:', font: 'Helvetica-Bold', fontSize: 6.5, align: 'left', paddingLeft: 4 });
  drawCell(doc, startX + colW * 2 + opLabelW, currY, opValueW, serviceRowH, { text: data.operator, font: 'Helvetica-Bold', fontSize: 6.5, align: 'center' });
  currY += serviceRowH;

  // 18. CONFORMACIÓN DEL SERVICIO PRESTADO header
  drawCell(doc, startX, currY, totalW, 13, {
    text: 'CONFORMACIÓN DEL SERVICIO PRESTADO',
    font: 'Helvetica-Bold',
    fontSize: 7.5,
    fill: HEADER_BG,
  });
  currY += 13;

  // 19. Nivel de Satisfacción
  const satH = 26;
  drawCell(doc, startX, currY, totalW, satH, { fill: null });
  doc.save();
  doc.font('Helvetica-Bold').fontSize(7).fillColor(TEXT_COLOR);
  doc.text('Nivel de Satisfacción:', startX, currY + 3, { width: totalW, align: 'center' });
  doc.font('Helvetica').fontSize(6.5);
  doc.text('Satisfecho: [   ]', startX, currY + 11, { width: totalW, align: 'center' });
  doc.text('No Satisfecho: [   ]', startX, currY + 18, { width: totalW, align: 'center' });
  doc.restore();
  currY += satH;

  // 20. Footer section headers: SOLICITANTE (200), OBSERVACIONES (224), SELLO (140)
  const wSol = 200;
  const wObs = 224;
  const wSel = 140;

  drawCell(doc, startX, currY, wSol, 12, { text: 'SOLICITANTE', font: 'Helvetica-Bold', fontSize: 6.5 });
  drawCell(doc, startX + wSol, currY, wObs, 12, { text: 'OBSERVACIONES', font: 'Helvetica-Bold', fontSize: 6.5 });
  drawCell(doc, startX + wSol + wObs, currY, wSel, 12, { text: 'SELLO', font: 'Helvetica-Bold', fontSize: 6.5 });
  currY += 12;

  // 21. Signature & stamp boxes
  const sigH = 40;
  drawCell(doc, startX, currY, wSol / 2, sigH, {
    text: 'FIRMA',
    font: 'Helvetica-Bold',
    fontSize: 6,
    align: 'left',
    paddingLeft: 4,
    paddingTop: sigH - 10,
  });
  drawCell(doc, startX + wSol / 2, currY, wSol / 2, sigH, {
    text: 'CEDULA',
    font: 'Helvetica-Bold',
    fontSize: 6,
    align: 'left',
    paddingLeft: 4,
    paddingTop: sigH - 10,
  });

  // Observations box
  drawCell(doc, startX + wSol, currY, wObs, sigH, {});

  // Stamp box with SELLO watermark
  drawCell(doc, startX + wSol + wObs, currY, wSel, sigH, {
    text: 'SELLO',
    font: 'Helvetica-Bold',
    fontSize: 10,
    textColor: WATERMARK_COLOR,
    align: 'center',
    paddingTop: (sigH - 10) / 2,
  });
  currY += sigH;

  return currY;
}

/**
 * Generates the PDF document stream containing two identical vouchers on a single page
 * @param {Object} customData Optional overrides for static data
 * @returns {PDFDocument}
 */
function createServiceTicketPdf(customData = {}) {
  const data = { ...DEFAULT_STATIC_DATA, ...customData };

  const doc = new PDFDocument({
    size: 'LETTER', // 612 x 792 pt
    margins: { top: 20, bottom: 20, left: 24, right: 24 },
    autoFirstPage: true,
  });

  const startX = 24;
  const startYTop = 20;

  // Render Top Voucher
  const endYTop = renderVoucher(doc, startX, startYTop, data);

  // Render Cut Divider in the middle
  const dividerY = endYTop + 14;
  doc.save();
  doc.strokeColor('#94A3B8')
    .lineWidth(0.6)
    .dash(4, { space: 3 })
    .moveTo(startX, dividerY)
    .lineTo(startX + 564, dividerY)
    .stroke();

  doc.font('Helvetica').fontSize(6).fillColor('#94A3B8');
  doc.text('✂ - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -', startX, dividerY - 3, {
    width: 564,
    align: 'center',
  });
  doc.restore();

  // Render Bottom Voucher
  const startYBottom = dividerY + 14;
  renderVoucher(doc, startX, startYBottom, data);

  return doc;
}

module.exports = {
  createServiceTicketPdf,
  mapTicketToPdfData,
  DEFAULT_STATIC_DATA,
};
