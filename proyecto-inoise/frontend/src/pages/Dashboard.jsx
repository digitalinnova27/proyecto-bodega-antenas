import React from 'react'
import { useInventory } from '../context/InventoryContext'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, Cell } from 'recharts'

const CAT_COLORS = {
  Audio: '#1D9E75', Iluminacion: '#378ADD', Estructuras: '#7F77DD',
  Efectos: '#EF9F27', Energía: '#D85A30', Tecnologia: '#534AB7',
  Pantalla: '#D4537E', Otros: '#888780',
}

const s = {
  wrap: { padding: '20px', fontFamily: 'inherit' },
  title: { fontSize: 20, fontWeight: 500, color: '#66FCF1', marginBottom: 2 },
  sub: { fontSize: 12, color: '#C5C6C7', marginBottom: 16 },
  grid4: { display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 8, marginBottom: 12 },
  grid3: { display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 10, marginBottom: 12 },
  grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 },
  kpi: { background: '#1F2833', borderRadius: 8, padding: '10px 14px' },
  kpiLabel: { fontSize: 11, color: '#C5C6C7', marginBottom: 3 },
  kpiVal: { fontSize: 24, fontWeight: 500 },
  kpiSub: { fontSize: 11, color: '#C5C6C7', marginTop: 2 },
  card: { background: '#1F2833', border: '0.5px solid rgba(102,252,241,0.15)', borderRadius: 12, padding: '12px 14px' },
  cardTitle: { fontSize: 12, fontWeight: 500, color: '#C5C6C7', marginBottom: 10 },
  pill: { display: 'inline-block', fontSize: 11, padding: '2px 8px', borderRadius: 20, fontWeight: 500 },
  sep: { border: 'none', borderTop: '0.5px solid rgba(102,252,241,0.15)', margin: '8px 0' },
  progBg: { background: 'rgba(102,252,241,0.1)', borderRadius: 4, height: 7, flex: 1 },
  antDot: { width: 8, height: 8, borderRadius: '50%', flexShrink: 0 },
}

const PILL_STYLES = {
  Activo: { background: '#e1f5ee', color: '#0F6E56' },
  Pendiente: { background: '#faeeda', color: '#854F0B' },
  Cerrado: { background: '#2a2a2a', color: '#888' },
  Activa: { background: '#e1f5ee', color: '#0F6E56' },
  Offline: { background: '#fcebeb', color: '#A32D2D' },
}

const MONTH_NAMES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
const DAY_NAMES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

// ── Genera datos reales según la fecha de hoy ──────────────────────────────
function buildChartData() {
  const today = new Date()
  const dayOfWeek = today.getDay() // 0=Dom
  const monday = new Date(today)
  monday.setDate(today.getDate() - ((dayOfWeek + 6) % 7))

  const dayNames = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
  const dailyVals = [5, 3, 7, 4, 8, 2, 1]
  const dailySals = [3, 2, 5, 4, 6, 1, 0]
  const dataDiario = dayNames.map((dn, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return { name: `${dn} ${d.getDate()}/${d.getMonth() + 1}`, entradas: dailyVals[i], salidas: dailySals[i] }
  })

  const weeklyEnt = [12, 9, 15, 9]
  const weeklySal = [8, 6, 11, 10]
  const dataSemanal = Array.from({ length: 4 }, (_, i) => {
    const wStart = new Date(monday)
    wStart.setDate(monday.getDate() - (3 - i) * 7)
    const wEnd = new Date(wStart)
    wEnd.setDate(wStart.getDate() + 6)
    return {
      name: `${wStart.getDate()}/${wStart.getMonth() + 1}-${wEnd.getDate()}/${wEnd.getMonth() + 1}`,
      entradas: weeklyEnt[i], salidas: weeklySal[i]
    }
  })

  const monthlyEnt = [22, 31, 38, 41, 45]
  const monthlySal = [15, 20, 25, 28, 35]
  const dataMensual = Array.from({ length: 5 }, (_, i) => {
    const d = new Date(today.getFullYear(), today.getMonth() - (4 - i), 1)
    return {
      name: `${MONTH_NAMES[d.getMonth()].slice(0, 3)} ${d.getFullYear()}`,
      month: d.getMonth(), year: d.getFullYear(),
      entradas: monthlyEnt[i], salidas: monthlySal[i]
    }
  })

  return { dataDiario, dataSemanal, dataMensual }
}

// ── Calendario modal ────────────────────────────────────────────────────────
function CalendarModal({ year, month, events, onClose }) {
  const [selectedDay, setSelectedDay] = React.useState(null)

  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const dayEvents = {}
  events.forEach(ev => {
    if (!ev.date) return
    const d = new Date(ev.date + 'T00:00:00')
    if (d.getFullYear() === year && d.getMonth() === month) {
      const day = d.getDate()
      if (!dayEvents[day]) dayEvents[day] = []
      dayEvents[day].push(ev)
    }
  })

  const cells = []
  for (let i = 0; i < firstDay; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  const selectedEvs = selectedDay ? (dayEvents[selectedDay] || []) : []

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1400
    }} onClick={onClose}>
      <div style={{
        background: '#0D1B2A', border: '1px solid rgba(102,252,241,0.25)',
        borderRadius: 16, padding: 24, width: 480, maxHeight: '90vh', overflowY: 'auto'
      }} onClick={e => e.stopPropagation()}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <span style={{ fontSize: 16, fontWeight: 600, color: '#66FCF1' }}>
            {MONTH_NAMES[month]} {year}
          </span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#C5C6C7', fontSize: 22, cursor: 'pointer', lineHeight: 1 }}>×</button>
        </div>

        {/* Day headers */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 2, marginBottom: 4 }}>
          {DAY_NAMES.map(d => (
            <div key={d} style={{ textAlign: 'center', fontSize: 11, color: '#666', padding: '3px 0' }}>{d}</div>
          ))}
        </div>

        {/* Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 3 }}>
          {cells.map((day, i) => {
            const hasEv = day && dayEvents[day]
            const isSel = day === selectedDay
            return (
              <div key={i} onClick={() => day && setSelectedDay(isSel ? null : day)}
                style={{
                  height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  borderRadius: '50%', fontSize: 13, cursor: day ? 'pointer' : 'default',
                  fontWeight: hasEv ? 700 : 400,
                  background: isSel ? '#66FCF1' : hasEv ? 'rgba(102,252,241,0.12)' : 'transparent',
                  color: isSel ? '#0D0D0D' : hasEv ? '#66FCF1' : day ? '#C5C6C7' : 'transparent',
                  border: hasEv && !isSel ? '1.5px solid rgba(102,252,241,0.6)' : '1.5px solid transparent',
                  transition: 'all .12s'
                }}>
                {day || ''}
              </div>
            )
          })}
        </div>

        {/* Event detail */}
        {selectedDay && (
          <div style={{ marginTop: 16, borderTop: '0.5px solid rgba(102,252,241,0.15)', paddingTop: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#66FCF1', marginBottom: 10 }}>
              {selectedDay} de {MONTH_NAMES[month]} — {selectedEvs.length === 0 ? 'Sin eventos' : `${selectedEvs.length} evento${selectedEvs.length > 1 ? 's' : ''}`}
            </div>
            {selectedEvs.length === 0 && (
              <p style={{ fontSize: 12, color: '#555' }}>No hay eventos registrados para este día.</p>
            )}
            {selectedEvs.map(ev => {
              const items = (ev.assignments || []).filter(a => a.qty > 0)
              return (
                <div key={ev.id} style={{
                  background: 'rgba(102,252,241,0.04)', border: '0.5px solid rgba(102,252,241,0.15)',
                  borderRadius: 10, padding: '10px 14px', marginBottom: 8
                }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#C5C6C7', marginBottom: 6 }}>
                    {ev.name}
                    {ev.location && <span style={{ fontSize: 11, color: '#888', marginLeft: 8 }}>📍 {ev.location}</span>}
                  </div>
                  {items.length === 0
                    ? <div style={{ fontSize: 12, color: '#555' }}>Sin equipos asignados</div>
                    : (
                      <div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '2px 12px', fontSize: 12 }}>
                          <span style={{ color: '#888', fontWeight: 600 }}>Equipo</span>
                          <span style={{ color: '#888', fontWeight: 600, textAlign: 'right' }}>Cant.</span>
                          {items.map(a => {
                            const prod = ev.productDetails?.find(p => p.id === a.productId)
                            const name = prod?.name || `Producto #${a.productId}`
                            const sku = prod?.sku || ''
                            return (
                              <React.Fragment key={a.productId}>
                                <span style={{ color: '#C5C6C7' }}>{name} <span style={{ color: '#555', fontSize: 11 }}>({sku})</span></span>
                                <span style={{ color: '#66FCF1', fontWeight: 600, textAlign: 'right' }}>×{a.qty}</span>
                              </React.Fragment>
                            )
                          })}
                        </div>
                        <div style={{ fontSize: 11, color: '#888', marginTop: 6, borderTop: '0.5px solid rgba(255,255,255,0.05)', paddingTop: 4 }}>
                          Total equipos: <strong style={{ color: '#66FCF1' }}>{items.reduce((s, a) => s + a.qty, 0)}</strong>
                        </div>
                      </div>
                    )
                  }
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Dashboard principal ─────────────────────────────────────────────────────
export default function Dashboard() {
  const { products, events, getAvailableQty } = useInventory()

  const todayStr = new Date().toISOString().slice(0, 10)

  const [chartView, setChartView] = React.useState('Mensual')
  const [calModal, setCalModal] = React.useState(null)

  const { dataDiario, dataSemanal, dataMensual } = React.useMemo(buildChartData, [])
  const chartData = chartView === 'Diario' ? dataDiario : chartView === 'Semanal' ? dataSemanal : dataMensual

  const totalUnits = products.reduce((s, p) => s + (p.total || 0), 0)
  const dispUnits = products.reduce((s, p) => s + getAvailableQty(p.id, todayStr), 0)
  const resUnits = products.reduce((s, p) => {
    const avail = getAvailableQty(p.id, todayStr)
    const ocu = p.units.filter(u => ['Ocupado', 'En Mantenimiento', 'Perdido'].includes(u.state)).length
    return s + Math.max((p.total || 0) - avail - ocu, 0)
  }, 0)
  const ocuUnits = products.reduce((s, p) =>
    s + p.units.filter(u => ['Ocupado', 'En Mantenimiento', 'Perdido'].includes(u.state)).length, 0)
  const pct = totalUnits ? Math.round((dispUnits / totalUnits) * 100) : 100

  const catStats = products.reduce((acc, p) => {
    const cat = p.category || 'Otros'
    if (!acc[cat]) acc[cat] = { total: 0, disp: 0 }
    acc[cat].total += p.total || 0
    acc[cat].disp += getAvailableQty(p.id, todayStr)
    return acc
  }, {})

  const sortedEvents = [...events].sort((a, b) => a.date > b.date ? 1 : -1)
  const upcomingEvents = sortedEvents.filter(e => e.date >= todayStr && e.status !== 'Cerrado').slice(0, 3)
  const recentEvents = sortedEvents.slice(-4).reverse()

  const barData = recentEvents.map(ev => ({
    name: ev.name.length > 10 ? ev.name.slice(0, 10) + '…' : ev.name,
    equipos: (ev.assignments || []).reduce((s, a) => s + (a.qty || 0), 0)
  }))

  const antennas = [
    { name: 'Antena 1', status: 'Activa' },
    { name: 'Antena 2', status: 'Offline' },
    { name: 'Antena 3', status: 'Activa' },
  ]

  const alerts = Object.entries(catStats)
    .map(([cat, { total, disp }]) => ({ cat, pct: total ? Math.round((disp / total) * 100) : 100 }))
    .sort((a, b) => a.pct - b.pct)

  const tooltipStyle = { background: '#1F2833', border: '0.5px solid rgba(102,252,241,0.2)', color: '#C5C6C7' }
  const tickStyle = { fontSize: 10, fill: '#C5C6C7' }

  return (
    <div style={s.wrap}>
      <div style={s.title}>Dashboard — iNoise Control Bodega</div>
      <div style={s.sub}>Equipos en stock: {dispUnits} • Fuera: {totalUnits - dispUnits} • {pct}% disponible</div>

      {/* KPIs */}
      <div style={s.grid4}>
        <div style={s.kpi}>
          <div style={s.kpiLabel}>Total unidades</div>
          <div style={s.kpiVal}>{totalUnits}</div>
          <div style={s.kpiSub}>{products.length} productos · {Object.keys(catStats).length} categorías</div>
        </div>
        <div style={s.kpi}>
          <div style={s.kpiLabel}>Disponibles</div>
          <div style={{ ...s.kpiVal, color: '#1D9E75' }}>{dispUnits}</div>
          <div style={s.kpiSub}>{pct}% en stock</div>
        </div>
        <div style={s.kpi}>
          <div style={s.kpiLabel}>Reservados</div>
          <div style={{ ...s.kpiVal, color: '#BA7517' }}>{resUnits}</div>
          <div style={s.kpiSub}>para próximos eventos</div>
        </div>
        <div style={s.kpi}>
          <div style={s.kpiLabel}>Ocupados / Mant.</div>
          <div style={{ ...s.kpiVal, color: ocuUnits > 0 ? '#E24B4A' : '#C5C6C7' }}>{ocuUnits}</div>
          <div style={s.kpiSub}>fuera de bodega</div>
        </div>
      </div>

      {/* Fila 2 */}
      <div style={s.grid3}>
        <div style={s.card}>
          <div style={s.cardTitle}>Disponibilidad por categoría</div>
          {Object.entries(catStats).map(([cat, { total, disp }]) => {
            const p = total ? Math.round((disp / total) * 100) : 100
            return (
              <div key={cat} style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '6px 0' }}>
                <span style={{ fontSize: 12, color: '#C5C6C7', width: 80, flexShrink: 0 }}>{cat}</span>
                <div style={s.progBg}>
                  <div style={{ height: 7, borderRadius: 4, width: p + '%', background: CAT_COLORS[cat] || '#888' }} />
                </div>
                <span style={{ fontSize: 12, fontWeight: 500, color: '#C5C6C7', minWidth: 36, textAlign: 'right' }}>{p}%</span>
              </div>
            )
          })}
        </div>

        <div style={s.card}>
          <div style={s.cardTitle}>Alertas del sistema</div>
          {alerts.slice(0, 4).map(({ cat, pct: p }) => {
            const isWarn = p < 60; const isOk = p >= 80
            const pillSt = isWarn ? { background: '#2e2400', color: '#EF9F27' }
              : isOk ? { background: '#0a1f18', color: '#1D9E75' }
                : { background: '#2e1010', color: '#E24B4A' }
            return (
              <div key={cat} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', borderBottom: '0.5px solid rgba(102,252,241,0.1)' }}>
                <span style={{ ...s.pill, ...pillSt }}>{isWarn ? '⚠' : isOk ? '✓' : '!'}</span>
                <span style={{ fontSize: 12, color: '#C5C6C7' }}>{cat} — {p}%</span>
              </div>
            )
          })}
          <hr style={s.sep} />
          <div style={{ ...s.cardTitle, marginBottom: 6 }}>Antenas RFID</div>
          {antennas.map(a => (
            <div key={a.name} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}>
              <div style={{ ...s.antDot, background: a.status === 'Activa' ? '#1D9E75' : '#E24B4A' }} />
              <span style={{ fontSize: 12, color: '#C5C6C7' }}>{a.name}</span>
              <span style={{ ...s.pill, marginLeft: 'auto', ...(PILL_STYLES[a.status] || {}) }}>{a.status}</span>
            </div>
          ))}
        </div>

        <div style={s.card}>
          <div style={s.cardTitle}>Próximos eventos</div>
          {upcomingEvents.length === 0 && <p style={{ fontSize: 12, color: '#666' }}>Sin eventos próximos</p>}
          {upcomingEvents.map(ev => {
            const eqCount = (ev.assignments || []).reduce((s, a) => s + (a.qty || 0), 0)
            const pillSt = PILL_STYLES[ev.status] || { background: '#2a2a2a', color: '#888' }
            return (
              <div key={ev.id} style={{ padding: '5px 0', borderBottom: '0.5px solid rgba(102,252,241,0.1)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, fontWeight: 500, color: '#C5C6C7' }}>{ev.name}</span>
                  <span style={{ ...s.pill, ...pillSt }}>{ev.status}</span>
                </div>
                <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>{ev.date} · {eqCount} equipos</div>
              </div>
            )
          })}
          <hr style={s.sep} />
          <div style={{ fontSize: 11, color: '#888' }}>Último escaneo RFID: <strong style={{ color: '#C5C6C7' }}>hace 2 min</strong></div>
        </div>
      </div>

      {/* Fila 3 — gráficos */}
      <div style={s.grid2}>

        {/* Entradas/salidas con selector + calendario en mensual */}
        <div style={s.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div style={s.cardTitle}>Entradas y salidas</div>
            <div style={{ display: 'flex', gap: 4 }}>
              {['Diario', 'Semanal', 'Mensual'].map(opt => (
                <button key={opt} onClick={() => setChartView(opt)} style={{
                  fontSize: 11, padding: '3px 10px', borderRadius: 20, cursor: 'pointer', border: 'none',
                  background: chartView === opt ? '#66FCF1' : 'rgba(102,252,241,0.1)',
                  color: chartView === opt ? '#0D0D0D' : '#C5C6C7',
                  fontWeight: chartView === opt ? 600 : 400
                }}>{opt}</button>
              ))}
            </div>
          </div>

          <ResponsiveContainer width="100%" height={140}>
            <BarChart data={chartData}>
              <XAxis dataKey="name" tick={tickStyle} interval={0} />
              <YAxis tick={tickStyle} />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 11, color: '#C5C6C7' }} />
              <Bar dataKey="entradas" fill="#378ADD" radius={[3, 3, 0, 0]} />
              <Bar dataKey="salidas" fill="#D85A30" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>

          {/* Botones calendario solo en vista Mensual */}
          {chartView === 'Mensual' && (
            <div style={{ marginTop: 10, borderTop: '0.5px solid rgba(102,252,241,0.1)', paddingTop: 8 }}>
              <div style={{ fontSize: 11, color: '#888', marginBottom: 6 }}>📅 Ver calendario del mes:</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {dataMensual.map(item => (
                  <button key={item.name} onClick={() => setCalModal({ year: item.year, month: item.month })} style={{
                    fontSize: 11, padding: '3px 12px', borderRadius: 20, cursor: 'pointer',
                    border: '1px solid rgba(102,252,241,0.3)', background: 'rgba(102,252,241,0.05)',
                    color: '#66FCF1', transition: 'background .15s'
                  }}>
                    {item.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Equipos por evento */}
        <div style={s.card}>
          <div style={s.cardTitle}>Equipos asignados por evento</div>
          {barData.length === 0
            ? <p style={{ fontSize: 12, color: '#666', paddingTop: 16 }}>Sin eventos creados aún</p>
            : (
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={barData}>
                  <XAxis dataKey="name" tick={tickStyle} />
                  <YAxis tick={tickStyle} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="equipos" fill="#66FCF1" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )
          }
        </div>
      </div>

      {/* Modal calendario */}
      {calModal && (
        <CalendarModal
          year={calModal.year}
          month={calModal.month}
          events={events}
          onClose={() => setCalModal(null)}
        />
      )}
    </div>
  )
}
