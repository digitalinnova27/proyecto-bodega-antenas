import React from 'react'
import { useInventory } from '../context/InventoryContext'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts'

const CAT_COLORS = {
  Audio: '#1D9E75',
  Iluminacion: '#378ADD',
  Estructuras: '#7F77DD',
  Efectos: '#EF9F27',
  Energía: '#D85A30',
  Tecnologia: '#534AB7',
  Pantalla: '#D4537E',
  Otros: '#888780',
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

export default function Dashboard() {
  const { products, events, getAvailableQty } = useInventory()

  const todayStr = new Date().toISOString().slice(0, 10)

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
    .map(([cat, { total, disp }]) => ({
      cat,
      pct: total ? Math.round((disp / total) * 100) : 100,
      color: CAT_COLORS[cat] || '#888',
    }))
    .sort((a, b) => a.pct - b.pct)

  return (
    <div style={s.wrap}>
      <div style={s.title}>Dashboard — iNoise Control Bodega</div>
      <div style={s.sub}>
        Equipos en stock: {dispUnits} • Fuera: {totalUnits - dispUnits} • {pct}% disponible
      </div>

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

        {/* Barras por categoría */}
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

        {/* Alertas + Antenas */}
        <div style={s.card}>
          <div style={s.cardTitle}>Alertas del sistema</div>
          {alerts.slice(0, 4).map(({ cat, pct: p }) => {
            const isWarn = p < 60
            const isOk = p >= 80
            const pillSt = isWarn
              ? { background: '#2e2400', color: '#EF9F27' }
              : isOk
                ? { background: '#0a1f18', color: '#1D9E75' }
                : { background: '#2e1010', color: '#E24B4A' }
            const icon = isWarn ? '⚠' : isOk ? '✓' : '!'
            return (
              <div key={cat} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', borderBottom: '0.5px solid rgba(102,252,241,0.1)' }}>
                <span style={{ ...s.pill, ...pillSt }}>{icon}</span>
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

        {/* Próximos eventos */}
        <div style={s.card}>
          <div style={s.cardTitle}>Próximos eventos</div>
          {upcomingEvents.length === 0 && (
            <p style={{ fontSize: 12, color: '#666' }}>Sin eventos próximos</p>
          )}
          {upcomingEvents.map(ev => {
            const eqCount = (ev.assignments || []).reduce((s, a) => s + (a.qty || 0), 0)
            const pillSt = PILL_STYLES[ev.status] || { background: '#2a2a2a', color: '#888' }
            return (
              <div key={ev.id} style={{ padding: '5px 0', borderBottom: '0.5px solid rgba(102,252,241,0.1)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, fontWeight: 500, color: '#C5C6C7' }}>{ev.name}</span>
                  <span style={{ ...s.pill, ...pillSt }}>{ev.status}</span>
                </div>
                <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>
                  {ev.date} · {eqCount} equipos
                </div>
              </div>
            )
          })}
          <hr style={s.sep} />
          <div style={{ fontSize: 11, color: '#888' }}>
            Último escaneo RFID: <strong style={{ color: '#C5C6C7' }}>hace 2 min</strong>
          </div>
        </div>
      </div>

      {/* Fila 3 — gráficos */}
      <div style={s.grid2}>
        <div style={s.card}>
          <div style={s.cardTitle}>Entradas y salidas — demo</div>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={[
              { name: 'Mar', entradas: 38, salidas: 25 },
              { name: 'Abr', entradas: 31, salidas: 18 },
              { name: 'May', entradas: 45, salidas: 35 },
            ]}>
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#C5C6C7' }} />
              <YAxis tick={{ fontSize: 11, fill: '#C5C6C7' }} />
              <Tooltip contentStyle={{ background: '#1F2833', border: '0.5px solid rgba(102,252,241,0.2)', color: '#C5C6C7' }} />
              <Legend wrapperStyle={{ fontSize: 11, color: '#C5C6C7' }} />
              <Bar dataKey="entradas" fill="#378ADD" radius={[3, 3, 0, 0]} />
              <Bar dataKey="salidas" fill="#D85A30" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div style={s.card}>
          <div style={s.cardTitle}>Equipos asignados por evento</div>
          {barData.length === 0
            ? <p style={{ fontSize: 12, color: '#666', paddingTop: 16 }}>Sin eventos creados aún</p>
            : (
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={barData}>
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#C5C6C7' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#C5C6C7' }} />
                  <Tooltip contentStyle={{ background: '#1F2833', border: '0.5px solid rgba(102,252,241,0.2)', color: '#C5C6C7' }} />
                  <Bar dataKey="equipos" fill="#66FCF1" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )
          }
        </div>
      </div>
    </div>
  )
}
