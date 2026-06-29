// generatePDF.js — Genera y descarga el PDF del evento usando jsPDF puro
// Sin dependencias externas adicionales (no requiere jspdf-autotable)

import jsPDF from 'jspdf'

export const loadImageAsBase64 = (url) =>
  new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'Anonymous'
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.width
      canvas.height = img.height
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0)
      resolve(canvas.toDataURL('image/png'))
    }
    img.onerror = reject
    img.src = url
  })

// ─── Dibuja una tabla manualmente sin autoTable ───────────────────────────
export function drawTable(doc, { startY, headers, rows, colWidths, marginL, pageW, marginR }) {
  const BLACK = [11, 12, 16]
  const ACCENT = [102, 252, 241]
  const DARK_BG = [31, 40, 51]
  const WHITE = [255, 255, 255]
  const GRAY_LT = [220, 222, 225]
  const ALT_ROW = [25, 32, 42]

  const ROW_H = 8
  const HEAD_H = 9
  const CELL_PAD = 3
  const LINE_H = 3.6 // alto de línea cuando una celda envuelve a más de 1 línea
  const contentW = pageW - marginL - marginR
  const pageH = doc.internal.pageSize.getHeight()

  let y = startY

  // Cabecera
  doc.setFillColor(...BLACK)
  doc.rect(marginL, y, contentW, HEAD_H, 'F')
  doc.setDrawColor(...ACCENT)
  doc.setLineWidth(0.4)
  doc.line(marginL, y + HEAD_H, marginL + contentW, y + HEAD_H)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(...ACCENT)

  let x = marginL
  for (let i = 0; i < headers.length; i++) {
    doc.text(headers[i], x + CELL_PAD, y + HEAD_H - 2.5)
    x += colWidths[i]
  }
  y += HEAD_H

  // Filas
  for (let ri = 0; ri < rows.length; ri++) {
    const row = rows[ri]

    // Para filas normales, se calculan las líneas envueltas de cada celda
    // ANTES de dibujar, así una celda con texto largo (ej. "F1 · Despacho
    // bodega") no se corta a la primera línea — el alto de la fila crece
    // según la celda con más líneas.
    let wrappedCells = null
    let rowH = ROW_H
    if (!row.__isGroupHeader) {
      wrappedCells = row.cells.map((cellVal, ci) => {
        const cellText = String(cellVal ?? '—')
        const maxW = colWidths[ci] - CELL_PAD * 2
        return doc.splitTextToSize(cellText, maxW)
      })
      const maxLines = Math.max(1, ...wrappedCells.map(l => l.length))
      rowH = Math.max(ROW_H, CELL_PAD * 2 + maxLines * LINE_H + 1.5)
    }

    // Nueva página si hace falta
    if (y + rowH > pageH - 20) {
      doc.addPage()
      y = 20
    }

    if (row.__isGroupHeader) {
      // Fila de categoría
      doc.setFillColor(...DARK_BG)
      doc.rect(marginL, y, contentW, ROW_H, 'F')
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8)
      doc.setTextColor(...ACCENT)
      doc.text(row.label, marginL + CELL_PAD, y + ROW_H - 2)
      doc.setDrawColor(40, 50, 62)
      doc.setLineWidth(0.2)
      doc.line(marginL, y + ROW_H, marginL + contentW, y + ROW_H)
      y += ROW_H
    } else {
      // Fila normal
      doc.setFillColor(...(ri % 2 === 0 ? [20, 26, 34] : ALT_ROW))
      doc.rect(marginL, y, contentW, rowH, 'F')
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      doc.setTextColor(...WHITE)

      x = marginL
      for (let ci = 0; ci < row.cells.length; ci++) {
        const lines = wrappedCells[ci]
        doc.text(lines, x + CELL_PAD, y + LINE_H + 1)
        x += colWidths[ci]
      }

      // Línea separadora suave
      doc.setDrawColor(40, 50, 62)
      doc.setLineWidth(0.2)
      doc.line(marginL, y + rowH, marginL + contentW, y + rowH)

      y += rowH
    }
  }

  return y
}

export async function generateEventPDF(event, products) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const marginL = 18
  const marginR = 18
  const contentW = pageW - marginL - marginR

  const BLACK = [11, 12, 16]
  const ACCENT = [102, 252, 241]
  const DARK_BG = [31, 40, 51]
  const WHITE = [255, 255, 255]
  const GRAY_MID = [150, 155, 160]
  const GRAY_LT = [220, 222, 225]

  // ─── HEADER ─────────────────────────────────────────────────────────────
  doc.setFillColor(...BLACK)
  doc.rect(0, 0, pageW, 48, 'F')
  doc.setFillColor(...ACCENT)
  doc.rect(0, 48, pageW, 1.2, 'F')

  // Logo
  try {
    const logoUrl = new URL('../assets/logo-inoise.png', import.meta.url).href
    const logoB64 = await loadImageAsBase64(logoUrl)
    doc.addImage(logoB64, 'PNG', marginL, 8, 28, 28)
  } catch {
    doc.setFillColor(...ACCENT)
    doc.circle(marginL + 14, 22, 12, 'F')
    doc.setFontSize(10)
    doc.setTextColor(...BLACK)
    doc.setFont('helvetica', 'bold')
    doc.text('iN', marginL + 10, 25)
  }

  doc.setTextColor(...WHITE)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.text('iNOISE', marginL + 34, 20)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...ACCENT)
  doc.text('EVENT DESIGNERS', marginL + 34, 27)

  // Caja número de orden
  doc.setFillColor(...ACCENT)
  const orderBoxW = 52
  doc.roundedRect(pageW - marginR - orderBoxW, 10, orderBoxW, 16, 2, 2, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7)
  doc.setTextColor(...BLACK)
  doc.text('ORDEN DE EVENTO', pageW - marginR - orderBoxW + 3, 16.5)
  doc.setFontSize(13)
  doc.text(event.orderNumber, pageW - marginR - orderBoxW + 3, 23.5)

  // ─── INFO DEL EVENTO ────────────────────────────────────────────────────
  let y = 56

  doc.setFillColor(...DARK_BG)
  doc.roundedRect(marginL, y, contentW, 36, 3, 3, 'F')

  const col1X = marginL + 6
  const col2X = marginL + contentW / 2 + 4

  doc.setFontSize(7); doc.setFont('helvetica', 'normal'); doc.setTextColor(...GRAY_MID)
  doc.text('NOMBRE DEL EVENTO', col1X, y + 9)
  doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.setTextColor(...WHITE)
  doc.text(event.name, col1X, y + 16)

  doc.setFontSize(7); doc.setFont('helvetica', 'normal'); doc.setTextColor(...GRAY_MID)
  doc.text('LUGAR', col1X, y + 25)
  doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(...WHITE)
  doc.text(event.location || 'No especificado', col1X, y + 31)

  doc.setFontSize(7); doc.setFont('helvetica', 'normal'); doc.setTextColor(...GRAY_MID)
  doc.text('FECHA DEL EVENTO', col2X, y + 9)
  doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.setTextColor(...ACCENT)
  doc.text(formatDate(event.date), col2X, y + 16)

  doc.setFontSize(7); doc.setFont('helvetica', 'normal'); doc.setTextColor(...GRAY_MID)
  doc.text('ESTADO', col2X, y + 25)
  doc.setFontSize(9); doc.setFont('helvetica', 'bold')
  doc.setTextColor(...(event.status === 'Programado' ? ACCENT : GRAY_LT))
  doc.text(event.status, col2X, y + 31)

  y += 44

  // Notas
  if (event.notes && event.notes.trim()) {
    doc.setFillColor(25, 32, 41)
    doc.roundedRect(marginL, y, contentW, 14, 2, 2, 'F')
    doc.setFontSize(7); doc.setFont('helvetica', 'normal'); doc.setTextColor(...GRAY_MID)
    doc.text('NOTAS', marginL + 6, y + 6)
    doc.setFontSize(8); doc.setTextColor(...GRAY_LT)
    const notesLines = doc.splitTextToSize(event.notes, contentW - 12)
    doc.text(notesLines, marginL + 6, y + 11)
    y += 20
  }

  y += 6

  // ─── TÍTULO TABLA ───────────────────────────────────────────────────────
  doc.setFillColor(...ACCENT)
  doc.rect(marginL, y, 3, 8, 'F')
  doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(...WHITE)
  doc.text('Artículos asignados al evento', marginL + 7, y + 6.5)
  y += 14

  // ─── CONSTRUIR FILAS ────────────────────────────────────────────────────
  const grouped = {}
  for (const assignment of (event.assignments || [])) {
    if (assignment.qty === 0) continue
    const product = products.find(p => p.id === assignment.productId)
    if (!product) continue
    const cat = product.category
    if (!grouped[cat]) grouped[cat] = []
    grouped[cat].push({ product, qty: assignment.qty })
  }

  const tableRows = []
  const categories = Object.keys(grouped).sort()

  for (const cat of categories) {
    tableRows.push({ __isGroupHeader: true, label: cat.toUpperCase() })
    for (const { product, qty } of grouped[cat]) {
      tableRows.push({
        cells: [product.name, product.sku, product.rfidBase || product.sku, product.description || '—', cat, qty]
      })
    }
  }

  const colWidths = [42, 22, 28, contentW - 42 - 22 - 28 - 24 - 14, 24, 14]
  const headers = ['Producto', 'SKU', 'SKU RFID', 'Descripción', 'Categoría', 'Cant.']

  const finalY = drawTable(doc, { startY: y, headers, rows: tableRows, colWidths, marginL, pageW, marginR })

  // ─── RESUMEN TOTALES ────────────────────────────────────────────────────
  const totalItems = (event.assignments || []).reduce((s, a) => s + a.qty, 0)
  const summaryY = finalY + 6

  if (summaryY < pageH - 24) {
    doc.setFillColor(...DARK_BG)
    doc.roundedRect(marginL, summaryY, contentW, 12, 2, 2, 'F')
    doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(...ACCENT)
    doc.text(`Total artículos asignados: ${totalItems}`, marginL + 6, summaryY + 7.5)
    doc.setTextColor(...GRAY_MID); doc.setFont('helvetica', 'normal')
    doc.text(`Categorías: ${categories.length}`, pageW - marginR - 6, summaryY + 7.5, { align: 'right' })
  }

  // ─── FOOTER ─────────────────────────────────────────────────────────────
  const footerY = pageH - 16
  doc.setFillColor(...BLACK)
  doc.rect(0, footerY - 2, pageW, 20, 'F')
  doc.setFillColor(...ACCENT)
  doc.rect(0, footerY - 2, pageW, 0.6, 'F')
  doc.setFontSize(7); doc.setFont('helvetica', 'normal'); doc.setTextColor(...GRAY_MID)
  doc.text('iNOISE Event Designers  •  Sistema de gestión RFID', marginL, footerY + 4)

  const fechaGen = new Date().toLocaleDateString('es-CL', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  })
  doc.text(`Generado: ${fechaGen}`, pageW - marginR, footerY + 4, { align: 'right' })

  // ─── GUARDAR ─────────────────────────────────────────────────────────────
  const filename = `iNOISE_${event.orderNumber}_${event.name.replace(/\s+/g, '_')}.pdf`
  doc.save(filename)
}

export function formatDate(dateStr) {
  if (!dateStr) return '—'
  const [y, m, d] = dateStr.split('-')
  const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
  return `${d} ${months[parseInt(m, 10) - 1]} ${y}`
}

// ─── PDF para arriendos ────────────────────────────────────────────────────
export async function generateRentalPDF(rental, products) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const marginL = 18
  const marginR = 18
  const contentW = pageW - marginL - marginR

  const BLACK = [11, 12, 16]
  const ACCENT = [102, 252, 241]
  const RENTAL_COLOR = [239, 159, 39]   // naranja/amarillo para rental
  const DARK_BG = [31, 40, 51]
  const WHITE = [255, 255, 255]
  const GRAY_MID = [150, 155, 160]
  const GRAY_LT = [220, 222, 225]

  // HEADER
  doc.setFillColor(...BLACK)
  doc.rect(0, 0, pageW, 48, 'F')
  doc.setFillColor(...RENTAL_COLOR)
  doc.rect(0, 48, pageW, 1.2, 'F')

  // Logo
  try {
    const logoUrl = new URL('../assets/logo-inoise.png', import.meta.url).href
    const logoB64 = await loadImageAsBase64(logoUrl)
    doc.addImage(logoB64, 'PNG', marginL, 8, 28, 28)
  } catch {
    doc.setFillColor(...RENTAL_COLOR)
    doc.circle(marginL + 14, 22, 12, 'F')
    doc.setFontSize(10)
    doc.setTextColor(...BLACK)
    doc.setFont('helvetica', 'bold')
    doc.text('iN', marginL + 10, 25)
  }

  doc.setTextColor(...WHITE)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.text('iNOISE', marginL + 34, 20)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...RENTAL_COLOR)
  doc.text('RENTAL', marginL + 34, 27)

  // Caja número de guía
  doc.setFillColor(...RENTAL_COLOR)
  const orderBoxW = 52
  doc.roundedRect(pageW - marginR - orderBoxW, 10, orderBoxW, 16, 2, 2, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7)
  doc.setTextColor(...BLACK)
  doc.text('GUÍA DE ARRIENDO', pageW - marginR - orderBoxW + 3, 16.5)
  doc.setFontSize(13)
  doc.text(rental.orderNumber, pageW - marginR - orderBoxW + 3, 23.5)

  // INFO DEL ARRIENDO
  let y = 56
  doc.setFillColor(...DARK_BG)
  doc.roundedRect(marginL, y, contentW, 44, 3, 3, 'F')

  const col1X = marginL + 6
  const col2X = marginL + contentW / 2 + 4

  doc.setFontSize(7); doc.setFont('helvetica', 'normal'); doc.setTextColor(...GRAY_MID)
  doc.text('NOMBRE DEL ARRIENDO', col1X, y + 9)
  doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.setTextColor(...WHITE)
  doc.text(rental.name, col1X, y + 16)

  doc.setFontSize(7); doc.setFont('helvetica', 'normal'); doc.setTextColor(...GRAY_MID)
  doc.text('CLIENTE', col1X, y + 25)
  doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(...WHITE)
  doc.text(rental.clientName || 'No especificado', col1X, y + 31)

  doc.setFontSize(7); doc.setFont('helvetica', 'normal'); doc.setTextColor(...GRAY_MID)
  doc.text('PERSONAL INSTALACIÓN', col1X, y + 39)
  doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(...WHITE)
  doc.text(rental.staffName || '—', col1X, y + 45)

  doc.setFontSize(7); doc.setFont('helvetica', 'normal'); doc.setTextColor(...GRAY_MID)
  doc.text('FECHA INICIO', col2X, y + 9)
  doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.setTextColor(...RENTAL_COLOR)
  doc.text(formatDate(rental.date), col2X, y + 16)

  doc.setFontSize(7); doc.setFont('helvetica', 'normal'); doc.setTextColor(...GRAY_MID)
  doc.text('FECHA FIN', col2X, y + 25)
  doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(...WHITE)
  doc.text(rental.endDate ? formatDate(rental.endDate) : '—', col2X, y + 31)

  doc.setFontSize(7); doc.setFont('helvetica', 'normal'); doc.setTextColor(...GRAY_MID)
  doc.text('ESTADO', col2X, y + 39)
  doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(...RENTAL_COLOR)
  doc.text(rental.status || 'Programado', col2X, y + 45)

  y += 52

  if (rental.notes && rental.notes.trim()) {
    doc.setFillColor(25, 32, 41)
    doc.roundedRect(marginL, y, contentW, 14, 2, 2, 'F')
    doc.setFontSize(7); doc.setFont('helvetica', 'normal'); doc.setTextColor(...GRAY_MID)
    doc.text('NOTAS', marginL + 6, y + 6)
    doc.setFontSize(8); doc.setTextColor(...GRAY_LT)
    const notesLines = doc.splitTextToSize(rental.notes, contentW - 12)
    doc.text(notesLines, marginL + 6, y + 11)
    y += 20
  }

  y += 6

  // TÍTULO TABLA
  doc.setFillColor(...RENTAL_COLOR)
  doc.rect(marginL, y, 3, 8, 'F')
  doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(...WHITE)
  doc.text('Artículos del arriendo', marginL + 7, y + 6.5)
  y += 14

  // CONSTRUIR FILAS
  const grouped = {}
  for (const assignment of (rental.assignments || [])) {
    if (assignment.qty === 0) continue
    const product = products.find(p => p.id === assignment.productId)
    if (!product) continue
    const cat = product.category
    if (!grouped[cat]) grouped[cat] = []
    grouped[cat].push({ product, qty: assignment.qty })
  }

  const tableRows = []
  const categories = Object.keys(grouped).sort()
  for (const cat of categories) {
    tableRows.push({ __isGroupHeader: true, label: cat.toUpperCase() })
    for (const { product, qty } of grouped[cat]) {
      tableRows.push({
        cells: [product.name, product.sku, product.rfidBase || product.sku, product.description || '—', cat, qty]
      })
    }
  }

  const colWidths = [42, 22, 28, contentW - 42 - 22 - 28 - 24 - 14, 24, 14]
  const headers = ['Producto', 'SKU', 'SKU RFID', 'Descripción', 'Categoría', 'Cant.']
  const finalY = drawTable(doc, { startY: y, headers, rows: tableRows, colWidths, marginL, pageW, marginR })

  // TOTALES
  const totalItems = (rental.assignments || []).reduce((s, a) => s + a.qty, 0)
  const summaryY = finalY + 6
  if (summaryY < pageH - 24) {
    doc.setFillColor(...DARK_BG)
    doc.roundedRect(marginL, summaryY, contentW, 12, 2, 2, 'F')
    doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(...RENTAL_COLOR)
    doc.text(`Total artículos arrendados: ${totalItems}`, marginL + 6, summaryY + 7.5)
    doc.setTextColor(...GRAY_MID); doc.setFont('helvetica', 'normal')
    doc.text(`Categorías: ${categories.length}`, pageW - marginR - 6, summaryY + 7.5, { align: 'right' })
  }

  // FOOTER
  const footerY = pageH - 16
  doc.setFillColor(...BLACK)
  doc.rect(0, footerY - 2, pageW, 20, 'F')
  doc.setFillColor(...RENTAL_COLOR)
  doc.rect(0, footerY - 2, pageW, 0.6, 'F')
  doc.setFontSize(7); doc.setFont('helvetica', 'normal'); doc.setTextColor(...GRAY_MID)
  doc.text('iNOISE Event Designers  •  Guía de Arriendo', marginL, footerY + 4)
  const fechaGen = new Date().toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  doc.text(`Generado: ${fechaGen}`, pageW - marginR, footerY + 4, { align: 'right' })

  const filename = `iNOISE_${rental.orderNumber}_${rental.name.replace(/\s+/g, '_')}.pdf`
  doc.save(filename)
}

// ─── Reporte de Operaciones mensual ────────────────────────────────────────
// Junta eventos y arriendos cerrados (vienen de eventHistory/rentalHistory
// en InventoryContext, ya filtrados por mes) y arma un PDF con: detalle de
// artículos retirados por evento/arriendo, fases aprobadas, e incidencias
// (pérdida/mantenimiento) con su fase y ubicación.
const monthLabel = (monthStr) => {
  if (!monthStr) return ''
  const [y, m] = monthStr.split('-')
  const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
  return `${months[parseInt(m, 10) - 1]} ${y}`
}

export async function generateMonthlyReportPDF(month, eventEntries, rentalEntries) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const marginL = 18
  const marginR = 18
  const contentW = pageW - marginL - marginR

  const BLACK = [11, 12, 16]
  const ACCENT = [102, 252, 241]
  const DARK_BG = [31, 40, 51]
  const WHITE = [255, 255, 255]
  const GRAY_MID = [150, 155, 160]
  const WARN = [239, 159, 39]

  const drawFooter = () => {
    const footerY = pageH - 16
    doc.setFillColor(...BLACK)
    doc.rect(0, footerY - 2, pageW, 20, 'F')
    doc.setFillColor(...ACCENT)
    doc.rect(0, footerY - 2, pageW, 0.6, 'F')
    doc.setFontSize(7); doc.setFont('helvetica', 'normal'); doc.setTextColor(...GRAY_MID)
    doc.text('iNOISE Event Designers  •  Reporte de Operaciones', marginL, footerY + 4)
    const fechaGen = new Date().toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    doc.text(`Generado: ${fechaGen}`, pageW - marginR, footerY + 4, { align: 'right' })
  }

  // ─── HEADER ───────────────────────────────────────────────────────────
  doc.setFillColor(...BLACK)
  doc.rect(0, 0, pageW, 48, 'F')
  doc.setFillColor(...ACCENT)
  doc.rect(0, 48, pageW, 1.2, 'F')

  try {
    const logoUrl = new URL('../assets/logo-inoise.png', import.meta.url).href
    const logoB64 = await loadImageAsBase64(logoUrl)
    doc.addImage(logoB64, 'PNG', marginL, 8, 28, 28)
  } catch {
    doc.setFillColor(...ACCENT)
    doc.circle(marginL + 14, 22, 12, 'F')
    doc.setFontSize(10); doc.setTextColor(...BLACK); doc.setFont('helvetica', 'bold')
    doc.text('iN', marginL + 10, 25)
  }

  doc.setTextColor(...WHITE)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(18)
  doc.text('iNOISE', marginL + 34, 20)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...ACCENT)
  doc.text('REPORTE DE OPERACIONES', marginL + 34, 27)

  doc.setFillColor(...ACCENT)
  const boxW = 60
  doc.roundedRect(pageW - marginR - boxW, 10, boxW, 16, 2, 2, 'F')
  doc.setFont('helvetica', 'bold'); doc.setFontSize(7); doc.setTextColor(...BLACK)
  doc.text('PERÍODO', pageW - marginR - boxW + 3, 16.5)
  doc.setFontSize(12)
  doc.text(monthLabel(month), pageW - marginR - boxW + 3, 23.5)

  let y = 56

  // ─── RESUMEN ──────────────────────────────────────────────────────────
  const totalEventItems = eventEntries.reduce((s, e) => s + (e.totalItems || 0), 0)
  const totalRentalItems = rentalEntries.reduce((s, r) => s + (r.totalItems || 0), 0)
  const totalLosses = eventEntries.reduce((s, e) => s + ((e.lossDetails || []).length), 0)

  doc.setFillColor(...DARK_BG)
  doc.roundedRect(marginL, y, contentW, 26, 3, 3, 'F')
  const colW = contentW / 4
  const summaryItems = [
    ['EVENTOS CERRADOS', String(eventEntries.length)],
    ['ARRIENDOS CERRADOS', String(rentalEntries.length)],
    ['ARTÍCULOS MOVIDOS', String(totalEventItems + totalRentalItems)],
    ['INCIDENCIAS/PÉRDIDAS', String(totalLosses)]
  ]
  summaryItems.forEach(([label, value], i) => {
    const x = marginL + 6 + colW * i
    doc.setFontSize(7); doc.setFont('helvetica', 'normal'); doc.setTextColor(...GRAY_MID)
    doc.text(label, x, y + 10)
    doc.setFontSize(15); doc.setFont('helvetica', 'bold')
    doc.setTextColor(...(label === 'INCIDENCIAS/PÉRDIDAS' && totalLosses > 0 ? WARN : ACCENT))
    doc.text(value, x, y + 20)
  })
  y += 34

  // ─── TABLA: ARTÍCULOS POR EVENTO ─────────────────────────────────────
  if (eventEntries.length > 0) {
    doc.setFillColor(...ACCENT)
    doc.rect(marginL, y, 3, 8, 'F')
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(...WHITE)
    doc.text('Eventos — artículos retirados y fases aprobadas', marginL + 7, y + 6.5)
    y += 14

    const rows = []
    for (const ev of eventEntries) {
      const phasesStr = (ev.phasesApproved || [])
        .map(p => p.done ? (p.forced ? `${p.key.toUpperCase()}*` : p.key.toUpperCase()) : null)
        .filter(Boolean).join(' ') || '—'
      rows.push({ __isGroupHeader: true, label: `${ev.orderNumber || ''} ${ev.name} · ${ev.location || 'Sin ubicación'} · Fases aprobadas: ${phasesStr}` })
      for (const it of (ev.items || [])) {
        rows.push({ cells: [it.name, it.sku, it.qty, ev.totalItems, ev.closedBy] })
      }
    }
    const headers = ['Producto', 'SKU', 'Cant.', 'Total evento', 'Cerrado por']
    const colWidths = [contentW - 22 - 16 - 30 - 38, 22, 16, 30, 38]
    y = drawTable(doc, { startY: y, headers, rows, colWidths, marginL, pageW, marginR })
    y += 6
  }

  // ─── TABLA: ARTÍCULOS POR ARRIENDO ───────────────────────────────────
  if (rentalEntries.length > 0) {
    if (y + 30 > pageH - 24) { doc.addPage(); y = 20 }
    doc.setFillColor(...WARN)
    doc.rect(marginL, y, 3, 8, 'F')
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(...WHITE)
    doc.text('Arriendos — artículos retirados', marginL + 7, y + 6.5)
    y += 14

    const rows = []
    for (const r of rentalEntries) {
      rows.push({ __isGroupHeader: true, label: `${r.orderNumber || ''} ${r.name} · Cliente: ${r.clientName || '—'}` })
      for (const it of (r.items || [])) {
        rows.push({ cells: [it.name, it.sku, it.qty, r.totalItems, r.closedBy] })
      }
    }
    const headers = ['Producto', 'SKU', 'Cant.', 'Total arriendo', 'Cerrado por']
    const colWidths = [contentW - 22 - 16 - 32 - 38, 22, 16, 32, 38]
    y = drawTable(doc, { startY: y, headers, rows, colWidths, marginL, pageW, marginR })
    y += 6
  }

  // ─── TABLA: INCIDENCIAS / PÉRDIDAS ───────────────────────────────────
  const allLosses = eventEntries.flatMap(ev => (ev.lossDetails || []).map(l => ({ ...l, eventName: ev.name })))
  if (allLosses.length > 0) {
    if (y + 30 > pageH - 24) { doc.addPage(); y = 20 }
    doc.setFillColor(...WARN)
    doc.rect(marginL, y, 3, 8, 'F')
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(...WHITE)
    doc.text('Incidencias y pérdidas', marginL + 7, y + 6.5)
    y += 14

    // l.phase ya viene combinado como "F1 · Despacho bodega" (ver
    // closeEventToHistory en InventoryContext.jsx) para que quede claro a
    // qué etapa exacta corresponde (antes solo se guardaba "Despacho bodega"
    // / "Despacho evento", que con la columna angosta se truncaba a
    // "Despacho" y no se podía distinguir cuál de las dos fases era).
    const rows = allLosses.map(l => ({
      cells: [l.eventName, l.item, l.phase || '—', l.state, l.location || '—', l.reason || '—']
    }))
    const headers = ['Evento', 'Artículo', 'Fase', 'Estado', 'Ubicación', 'Motivo']
    const w = contentW
    const colWidths = [w * 0.14, w * 0.17, w * 0.22, w * 0.11, w * 0.13, w * 0.23]
    drawTable(doc, { startY: y, headers, rows, colWidths, marginL, pageW, marginR })
  }

  if (eventEntries.length === 0 && rentalEntries.length === 0) {
    doc.setFontSize(10); doc.setTextColor(...GRAY_MID)
    doc.text('No hay eventos ni arriendos cerrados en este período.', marginL, y + 10)
  }

  drawFooter()

  const filename = `iNOISE_Reporte_Operaciones_${month}.pdf`
  doc.save(filename)
}
