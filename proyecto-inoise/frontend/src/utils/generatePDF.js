// generatePDF.js — Genera y descarga el PDF del evento usando jsPDF puro
// Sin dependencias externas adicionales (no requiere jspdf-autotable)

import jsPDF from 'jspdf'

const loadImageAsBase64 = (url) =>
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
function drawTable(doc, { startY, headers, rows, colWidths, marginL, pageW, marginR }) {
  const BLACK = [11, 12, 16]
  const ACCENT = [102, 252, 241]
  const DARK_BG = [31, 40, 51]
  const WHITE = [255, 255, 255]
  const GRAY_LT = [220, 222, 225]
  const ALT_ROW = [25, 32, 42]

  const ROW_H = 8
  const HEAD_H = 9
  const CELL_PAD = 3
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

    // Nueva página si hace falta
    if (y + ROW_H > pageH - 20) {
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
    } else {
      // Fila normal
      doc.setFillColor(...(ri % 2 === 0 ? [20, 26, 34] : ALT_ROW))
      doc.rect(marginL, y, contentW, ROW_H, 'F')
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      doc.setTextColor(...WHITE)

      x = marginL
      for (let ci = 0; ci < row.cells.length; ci++) {
        const cellText = String(row.cells[ci] ?? '—')
        const maxW = colWidths[ci] - CELL_PAD * 2
        const lines = doc.splitTextToSize(cellText, maxW)
        doc.text(lines[0], x + CELL_PAD, y + ROW_H - 2.5)
        x += colWidths[ci]
      }
    }

    // Línea separadora suave
    doc.setDrawColor(40, 50, 62)
    doc.setLineWidth(0.2)
    doc.line(marginL, y + ROW_H, marginL + contentW, y + ROW_H)

    y += ROW_H
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

function formatDate(dateStr) {
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
