import { jsPDF } from 'jspdf'

export default function UpdateModal({ open, info, onClose }) {
  if (!open || !info) return null

  const { version, changes = [], type } = info
  const isChangelog = type === 'changelog'

  function handleSavePDF() {
    const doc = new jsPDF()

    // ── Header oscuro ────────────────────────────────────────────────────
    doc.setFillColor(11, 12, 16)
    doc.rect(0, 0, 210, 45, 'F')

    doc.setTextColor(102, 252, 241)
    doc.setFontSize(22)
    doc.setFont('helvetica', 'bold')
    doc.text('iNOISE', 15, 20)

    doc.setTextColor(197, 198, 199)
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.text('Control de Bodega RFID', 15, 29)

    // Badge versión
    doc.setFillColor(102, 252, 241)
    doc.roundedRect(138, 11, 58, 18, 3, 3, 'F')
    doc.setTextColor(11, 12, 16)
    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.text(`Versión ${version}`, 167, 22, { align: 'center' })

    // Fecha
    doc.setTextColor(130, 130, 150)
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.text(
      `Generado: ${new Date().toLocaleDateString('es-CL', { year: 'numeric', month: 'long', day: 'numeric' })}`,
      195, 40, { align: 'right' }
    )

    // ── Título sección ───────────────────────────────────────────────────
    doc.setTextColor(31, 40, 51)
    doc.setFontSize(15)
    doc.setFont('helvetica', 'bold')
    doc.text('Novedades de esta actualización', 15, 62)

    // Línea cyan
    doc.setDrawColor(102, 252, 241)
    doc.setLineWidth(0.8)
    doc.line(15, 66, 195, 66)

    // ── Lista de cambios ─────────────────────────────────────────────────
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(11)
    doc.setTextColor(40, 40, 40)
    let y = 78

    if (changes.length === 0) {
      doc.text('No hay detalles disponibles para esta versión.', 15, y)
    } else {
      changes.forEach(item => {
        doc.setFillColor(102, 252, 241)
        doc.circle(19, y - 1.5, 1.8, 'F')
        const lines = doc.splitTextToSize(item, 163)
        doc.setTextColor(40, 40, 40)
        doc.text(lines, 25, y)
        y += lines.length * 7 + 5
      })
    }

    // ── Footer ───────────────────────────────────────────────────────────
    doc.setFillColor(31, 40, 51)
    doc.rect(0, 277, 210, 20, 'F')
    doc.setTextColor(197, 198, 199)
    doc.setFontSize(8)
    doc.text('iNOISE Control Bodega — Documento generado automáticamente', 105, 287, { align: 'center' })

    doc.save(`iNOISE-actualizacion-v${version}.pdf`)
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 9999
    }}>
      <div style={{
        background: '#1F2833', borderRadius: 16, padding: 32, width: 480,
        maxWidth: '90vw', boxShadow: '0 25px 60px rgba(0,0,0,0.6)',
        border: '1px solid rgba(102,252,241,0.2)'
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
          <div style={{
            width: 48, height: 48, borderRadius: '50%',
            background: 'rgba(102,252,241,0.12)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 22, flexShrink: 0
          }}>🆕</div>
          <div>
            <div style={{ color: '#66FCF1', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 2 }}>
              {isChangelog ? 'Novedades de la versión' : 'Actualización disponible'}
            </div>
            <div style={{ color: '#f1f5f9', fontSize: 20, fontWeight: 700 }}>
              Versión {version}
            </div>
          </div>
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: 'rgba(102,252,241,0.15)', marginBottom: 18 }} />

        {/* Lista de cambios */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ color: '#64748b', fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 12 }}>
            Novedades
          </div>
          {changes.length === 0 ? (
            <p style={{ color: '#64748b', fontSize: 13, margin: 0 }}>
              No hay detalles disponibles para esta versión.
            </p>
          ) : (
            <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
              {changes.map((item, i) => (
                <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
                  <span style={{ color: '#66FCF1', fontSize: 16, marginTop: 1, flexShrink: 0 }}>•</span>
                  <span style={{ color: '#cbd5e1', fontSize: 14, lineHeight: 1.55 }}>{item}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Botones */}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{
            padding: '10px 20px', borderRadius: 8, border: '1px solid #334155',
            background: 'transparent', color: '#94a3b8', cursor: 'pointer',
            fontSize: 14, fontWeight: 500
          }}>
            Cerrar
          </button>
          <button onClick={handleSavePDF} style={{
            padding: '10px 22px', borderRadius: 8, border: 'none',
            background: '#66FCF1', color: '#0B0C10', cursor: 'pointer',
            fontSize: 14, fontWeight: 700
          }}>
            Guardar PDF
          </button>
        </div>
      </div>
    </div>
  )
}
