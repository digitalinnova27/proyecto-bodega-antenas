import jsPDF from 'jspdf'

/**
 * Genera y descarga un PDF con el detalle de un evento.
 * @param {object} ev       - Objeto evento (name, orderNumber, date, location, status, assignments, notes)
 * @param {Array}  products - Array completo de productos del inventario
 */
export async function generateEventPDF(ev, products) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })

  const pageW = doc.internal.pageSize.getWidth()
  const margin = 14
  let y = 20

  /* ── Encabezado ── */
  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.text('iNOISE Control Bodega', margin, y)
  y += 8

  doc.setFontSize(11)
  doc.setFont('helvetica', 'normal')
  doc.text('Detalle de Evento', margin, y)
  y += 10

  /* ── Línea separadora ── */
  doc.setDrawColor(100, 100, 100)
  doc.line(margin, y, pageW - margin, y)
  y += 8

  /* ── Datos del evento ── */
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.text('Información general', margin, y)
  y += 6

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)

  const info = [
    ['Nombre',   ev.name       || '—'],
    ['N° Orden', ev.orderNumber || '—'],
    ['Fecha',    ev.date        || '—'],
    ['Lugar',    ev.location    || '—'],
    ['Estado',   ev.status      || '—'],
  ]
  info.forEach(([label, value]) => {
    doc.setFont('helvetica', 'bold')
    doc.text(`${label}:`, margin, y)
    doc.setFont('helvetica', 'normal')
    doc.text(value, margin + 32, y)
    y += 6
  })

  if (ev.notes) {
    y += 2
    doc.setFont('helvetica', 'bold')
    doc.text('Notas:', margin, y)
    y += 5
    doc.setFont('helvetica', 'normal')
    const lines = doc.splitTextToSize(ev.notes, pageW - margin * 2)
    doc.text(lines, margin, y)
    y += lines.length * 5
  }

  y += 6
  doc.setDrawColor(180, 180, 180)
  doc.line(margin, y, pageW - margin, y)
  y += 8

  /* ── Equipos asignados ── */
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.text('Equipos asignados', margin, y)
  y += 7

  const assignments = (ev.assignments || []).filter(a => a.qty > 0)

  if (!assignments.length) {
    doc.setFont('helvetica', 'italic')
    doc.setFontSize(10)
    doc.text('Sin equipos asignados.', margin, y)
    y += 6
  } else {
    /* Cabecera tabla */
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.setFillColor(230, 230, 230)
    doc.rect(margin, y - 4, pageW - margin * 2, 7, 'F')
    doc.text('SKU',      margin + 2,       y)
    doc.text('Nombre',   margin + 22,      y)
    doc.text('Categoría',margin + 100,     y)
    doc.text('Cantidad', pageW - margin - 16, y, { align: 'right' })
    y += 7

    doc.setFont('helvetica', 'normal')
    assignments.forEach((a, i) => {
      const p = products.find(pr => pr.id === a.productId)
      const sku      = p?.sku      || '—'
      const name     = p?.name     || 'Producto desconocido'
      const category = p?.category || '—'

      if (i % 2 === 0) {
        doc.setFillColor(248, 248, 248)
        doc.rect(margin, y - 4, pageW - margin * 2, 6, 'F')
      }

      const nameLines = doc.splitTextToSize(name, 75)
      doc.text(sku,         margin + 2,       y)
      doc.text(nameLines[0], margin + 22,      y)
      doc.text(category,    margin + 100,     y)
      doc.text(String(a.qty), pageW - margin - 2, y, { align: 'right' })
      y += 6

      /* nueva página si hace falta */
      if (y > 270) { doc.addPage(); y = 20 }
    })
  }

  /* ── Pie de página ── */
  const now = new Date()
  const stamp = now.toLocaleDateString('es-CL') + ' ' + now.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })
  doc.setFontSize(8)
  doc.setFont('helvetica', 'italic')
  doc.setTextColor(150)
  doc.text(`Generado el ${stamp}`, pageW - margin, 287, { align: 'right' })

  /* ── Guardar ── */
  const filename = `evento_${(ev.orderNumber || ev.name || 'sin_orden').replace(/\s+/g, '_')}.pdf`
  doc.save(filename)
}
