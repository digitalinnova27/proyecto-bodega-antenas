import React from 'react'
import {
    Box, Typography, Paper, TextField, MenuItem, Button,
    Chip, Alert, Divider, CircularProgress, InputAdornment,
    Table, TableHead, TableRow, TableCell, TableBody, Fade, List,
    ListItem, ListItemText
} from '@mui/material'
import WifiIcon from '@mui/icons-material/Wifi'
import LinkIcon from '@mui/icons-material/Link'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import SearchIcon from '@mui/icons-material/Search'
import QrCodeScannerIcon from '@mui/icons-material/QrCodeScanner'
import AddCircleIcon from '@mui/icons-material/AddCircle'
import CancelIcon from '@mui/icons-material/Cancel'
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked'
import { useInventory } from '../context/InventoryContext'
import { useRfidSocket } from '../hooks/useRfidSocket'

const CATEGORIES = ['Audio', 'Iluminacion', 'Pantalla', 'Efectos', 'Estructuras', 'Energía', 'Tecnologia', 'Otros']

// Convierte "3-5" → "Unidad 5", "12-2" → "Unidad 2"
const unitLabel = (id) => {
    const parts = String(id).split('-')
    return `Unidad ${parts[parts.length - 1]}`
}

export default function RfidRegistrar() {
    const { products, addProduct, linkEpc, epcMap } = useInventory()
    const { isConnected, lastScan, clearLastScan } = useRfidSocket()

    const [step, setStep] = React.useState('waiting')
    const [currentEpc, setCurrentEpc] = React.useState('')
    const [selectedUnit, setSelectedUnit] = React.useState('')
    const [registered, setRegistered] = React.useState([])
    const [saving, setSaving] = React.useState(false)
    const [manualEpc, setManualEpc] = React.useState('')

    const emptyForm = { name: '', sku: '', category: '', qty: '1', description: '' }
    const [newForm, setNewForm] = React.useState(emptyForm)

    const [search, setSearch] = React.useState('')
    const [selectedProd, setSelectedProd] = React.useState('')

    // Mapa inverso unitId → epc (para saber cuáles ya están vinculadas)
    const unitToEpc = React.useMemo(() => {
        const map = {}
        Object.entries(epcMap || {}).forEach(([epc, uid]) => { map[uid] = epc })
        return map
    }, [epcMap])

    const [alreadyLinked, setAlreadyLinked] = React.useState(null) // { epc, productName, unitLabel }

    // Captura de scan RFID
    React.useEffect(() => {
        if (!lastScan) return
        const epc = lastScan.epc
        clearLastScan()

        // Verificar si ya está vinculado
        const existingUnitId = epcMap[epc]
        if (existingUnitId) {
            // Buscar a qué producto pertenece
            let productName = 'Producto desconocido'
            let uLabel = existingUnitId
            for (const p of products) {
                const u = p.units.find(u => u.id === existingUnitId)
                if (u) {
                    productName = p.name
                    const parts = String(u.id).split('-')
                    uLabel = 'Unidad ' + parts[parts.length - 1]
                    break
                }
            }
            setAlreadyLinked({ epc, productName, unitLabel: uLabel })
            setStep('waiting')
            return
        }

        setAlreadyLinked(null)
        setCurrentEpc(epc)
        setStep('detected')
        setSelectedProd('')
        setSelectedUnit('')
        setSearch('')
        setNewForm(emptyForm)
    }, [lastScan])

    React.useEffect(() => { setSelectedUnit('') }, [selectedProd])

    const selProduct = products.find(p => p.id === Number(selectedProd))

    // Unidades del producto: todas, marcando cuáles ya tienen EPC
    const allUnits = selProduct ? selProduct.units : []

    // Unidades disponibles (sin EPC asignado aún, excluyendo las de esta sesión)
    const sessionUnitIds = registered.map(r => r.unitId)
    const availableUnits = allUnits.filter(u =>
        !unitToEpc[u.id] && !sessionUnitIds.includes(u.id)
    )

    // Filtrado de productos — busca por nombre O sku simultáneamente
    const filteredProducts = React.useMemo(() => {
        if (!search.trim()) return products
        const q = search.toLowerCase()
        return products.filter(p =>
            p.name.toLowerCase().includes(q) ||
            p.sku.toLowerCase().includes(q) ||
            p.category.toLowerCase().includes(q)
        )
    }, [products, search])

    const handleVincular = async () => {
        if (!currentEpc || !selectedProd || !selectedUnit) return
        setSaving(true)
        const prod = products.find(p => p.id === Number(selectedProd))
        const entry = {
            epc: currentEpc, unitId: selectedUnit,
            productName: prod?.name || '', sku: prod?.sku || '',
            timestamp: new Date().toISOString()
        }
        try {
            await fetch('http://localhost:3002/api/epcmap', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ epc: currentEpc, unitId: selectedUnit })
            })
        } catch (e) { }
        linkEpc(currentEpc, selectedUnit)
        setRegistered(prev => [entry, ...prev])
        setSaving(false)
        setStep('done')
    }

    const handleCrearYVincular = async () => {
        if (!newForm.name || !newForm.sku || !newForm.category || !newForm.qty) return
        setSaving(true)
        const created = addProduct({ name: newForm.name, sku: newForm.sku, category: newForm.category, qty: newForm.qty, rfid: newForm.sku, description: newForm.description })
        const unitId = created?.units?.[0]?.id || `${created?.id}-1`
        const entry = { epc: currentEpc, unitId, productName: newForm.name, sku: newForm.sku, timestamp: new Date().toISOString(), isNew: true }
        try {
            await fetch('http://localhost:3002/api/epcmap', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ epc: currentEpc, unitId })
            })
        } catch (e) { }
        linkEpc(currentEpc, unitId)
        setRegistered(prev => [entry, ...prev])
        setSaving(false)
        setStep('done')
    }

    const handleNuevo = () => {
        setStep('waiting'); setCurrentEpc(''); setSelectedProd('')
        setSelectedUnit(''); setSearch(''); setNewForm(emptyForm); setManualEpc('')
    }

    return (
        <Box>
            <Typography variant="h5" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                <QrCodeScannerIcon /> Registrar Stickers RFID
            </Typography>

            <Alert severity={isConnected ? 'success' : 'warning'} icon={<WifiIcon />} sx={{ mb: 2 }}>
                {isConnected ? '🟢 Antena conectada — pasa un sticker por la antena' : '⚫ Antena desconectada — ejecuta: node server/rfid-bridge.js'}
            </Alert>

            {/* PASO 1: Esperando */}
            {step === 'waiting' && (
                <Paper sx={{ p: 4, textAlign: 'center', mb: 2 }}>
                    <QrCodeScannerIcon sx={{ fontSize: 72, color: 'text.disabled', mb: 2 }} />
                    <Typography variant="h6" color="text.secondary">Esperando sticker...</Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                        Pasa un sticker RFID por la antena para comenzar
                    </Typography>
                    <Divider sx={{ my: 2 }}>o ingresa manualmente</Divider>
                    <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center' }}>
                        <TextField size="small" label="EPC manual" sx={{ width: 340 }} value={manualEpc}
                            onChange={e => setManualEpc(e.target.value)}
                            placeholder="ej: E2801160600002094EB9D944"
                            onKeyDown={e => { if (e.key === 'Enter' && manualEpc.trim()) { setCurrentEpc(manualEpc.trim()); setStep('detected') } }}
                        />
                        <Button variant="outlined" onClick={() => { if (manualEpc.trim()) { setCurrentEpc(manualEpc.trim()); setStep('detected') } }}>
                            Usar
                        </Button>
                    </Box>
                </Paper>
            )}

            {/* Alerta: sticker ya vinculado */}
            {alreadyLinked && (
                <Fade in>
                    <Alert severity="warning" sx={{ mb: 2 }}
                        onClose={() => setAlreadyLinked(null)}>
                        <Typography variant="body2" fontWeight={600}>
                            ⚠️ Este sticker ya está vinculado
                        </Typography>
                        <Typography variant="body2" sx={{ mt: 0.5 }}>
                            EPC: <code style={{ fontFamily: 'monospace', fontSize: 11 }}>{alreadyLinked.epc}</code>
                        </Typography>
                        <Typography variant="body2">
                            Producto: <strong>{alreadyLinked.productName}</strong> — {alreadyLinked.unitLabel}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                            Si necesitas desvincularlo, ve a "Productos Vinculados" → Revisar → Desvincular.
                        </Typography>
                    </Alert>
                </Fade>
            )}

            {/* PASO 2: Detectado */}
            {step === 'detected' && (
                <Fade in>
                    <Box>
                        <Alert severity="info" sx={{ mb: 2 }} icon={<QrCodeScannerIcon />}>
                            <Typography variant="body1" fontWeight={600}>✅ Sticker detectado</Typography>
                            <Typography variant="body2" fontFamily="monospace" sx={{ mt: 0.5 }}>
                                EPC: <strong>{currentEpc}</strong>
                            </Typography>
                        </Alert>

                        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>

                            {/* Opción A */}
                            <Paper sx={{ p: 2, border: '1px solid', borderColor: 'divider' }}>
                                <Typography variant="subtitle2" color="primary" sx={{ mb: 1.5 }}>
                                    Opción A — Vincular a producto existente
                                </Typography>

                                {/* Buscador funcional */}
                                <TextField fullWidth size="small" label="Buscar por nombre o SKU"
                                    value={search} onChange={e => setSearch(e.target.value)} sx={{ mb: 1.5 }}
                                    autoComplete="off"
                                    InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
                                />

                                <TextField select fullWidth size="small" label="Producto" value={selectedProd}
                                    onChange={e => setSelectedProd(e.target.value)} sx={{ mb: 1.5 }}>
                                    <MenuItem value="">— Selecciona —</MenuItem>
                                    {filteredProducts.map(p => (
                                        <MenuItem key={p.id} value={p.id}>
                                            <Box>
                                                <Typography variant="body2">{p.name}</Typography>
                                                <Typography variant="caption" color="text.secondary">{p.sku} · {p.category}</Typography>
                                            </Box>
                                        </MenuItem>
                                    ))}
                                </TextField>

                                {/* Lista de unidades con estado visual */}
                                {selProduct && (
                                    <Box sx={{ mb: 2 }}>
                                        <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
                                            Selecciona la unidad a vincular:
                                        </Typography>
                                        <Box sx={{ maxHeight: 200, overflowY: 'auto', border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                                            {allUnits.map((u, idx) => {
                                                const isLinked = Boolean(unitToEpc[u.id]) || sessionUnitIds.includes(u.id)
                                                const isSelected = selectedUnit === u.id
                                                return (
                                                    <Box key={u.id}
                                                        onClick={() => !isLinked && setSelectedUnit(u.id)}
                                                        sx={{
                                                            display: 'flex', alignItems: 'center', gap: 1.5,
                                                            px: 1.5, py: 0.8,
                                                            borderBottom: idx < allUnits.length - 1 ? '0.5px solid' : 'none',
                                                            borderColor: 'divider',
                                                            cursor: isLinked ? 'default' : 'pointer',
                                                            bgcolor: isLinked
                                                                ? 'rgba(29,158,117,0.08)'
                                                                : isSelected
                                                                    ? 'rgba(102,252,241,0.12)'
                                                                    : 'transparent',
                                                            '&:hover': !isLinked ? { bgcolor: 'rgba(102,252,241,0.06)' } : {},
                                                            transition: 'background .12s'
                                                        }}>
                                                        {isLinked
                                                            ? <CheckCircleIcon sx={{ fontSize: 16, color: '#1D9E75', flexShrink: 0 }} />
                                                            : isSelected
                                                                ? <CheckCircleIcon sx={{ fontSize: 16, color: '#66FCF1', flexShrink: 0 }} />
                                                                : <RadioButtonUncheckedIcon sx={{ fontSize: 16, color: 'text.disabled', flexShrink: 0 }} />
                                                        }
                                                        <Typography variant="body2" sx={{ color: isLinked ? '#1D9E75' : isSelected ? '#66FCF1' : 'text.primary' }}>
                                                            {unitLabel(u.id)}
                                                        </Typography>
                                                        {isLinked && (
                                                            <Chip label="Vinculada" size="small" color="success" sx={{ ml: 'auto', fontSize: 10, height: 20 }} />
                                                        )}
                                                    </Box>
                                                )
                                            })}
                                        </Box>
                                        {availableUnits.length === 0 && (
                                            <Typography variant="caption" color="success.main" sx={{ mt: 0.5, display: 'block' }}>
                                                ✅ Todas las unidades ya están vinculadas
                                            </Typography>
                                        )}
                                    </Box>
                                )}

                                <Box sx={{ display: 'flex', gap: 1 }}>
                                    <Button fullWidth variant="contained"
                                        startIcon={saving ? <CircularProgress size={16} /> : <LinkIcon />}
                                        disabled={!selectedProd || !selectedUnit || saving}
                                        onClick={handleVincular}
                                        sx={{ bgcolor: '#66FCF1', color: '#0B0C10', '&:hover': { bgcolor: '#45e8d5' } }}>
                                        Vincular
                                    </Button>
                                    <Button variant="outlined" color="error" startIcon={<CancelIcon />} onClick={handleNuevo}>
                                        Cancelar
                                    </Button>
                                </Box>
                            </Paper>

                            {/* Opción B */}
                            <Paper sx={{ p: 2, border: '1px solid', borderColor: 'divider' }}>
                                <Typography variant="subtitle2" color="warning.main" sx={{ mb: 1.5 }}>
                                    Opción B — Crear nuevo producto y vincular
                                </Typography>
                                <TextField fullWidth size="small" label="Nombre del producto *" value={newForm.name}
                                    onChange={e => setNewForm({ ...newForm, name: e.target.value })} sx={{ mb: 1 }} />
                                <TextField fullWidth size="small" label="SKU *" value={newForm.sku}
                                    onChange={e => setNewForm({ ...newForm, sku: e.target.value })} sx={{ mb: 1 }} placeholder="ej: AUD-015" />
                                <TextField select fullWidth size="small" label="Categoría *" value={newForm.category}
                                    onChange={e => setNewForm({ ...newForm, category: e.target.value })} sx={{ mb: 1 }}>
                                    {CATEGORIES.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
                                </TextField>
                                <TextField fullWidth size="small" label="Cantidad de unidades" type="number"
                                    value={newForm.qty} onChange={e => setNewForm({ ...newForm, qty: e.target.value })}
                                    sx={{ mb: 1 }} inputProps={{ min: 1 }} />
                                <TextField fullWidth size="small" label="Descripción (opcional)" value={newForm.description}
                                    onChange={e => setNewForm({ ...newForm, description: e.target.value })} sx={{ mb: 2 }} />
                                <Box sx={{ display: 'flex', gap: 1 }}>
                                    <Button fullWidth variant="contained" color="warning"
                                        startIcon={saving ? <CircularProgress size={16} /> : <AddCircleIcon />}
                                        disabled={!newForm.name || !newForm.sku || !newForm.category || saving}
                                        onClick={handleCrearYVincular}>
                                        Crear y vincular
                                    </Button>
                                    <Button variant="outlined" color="error" startIcon={<CancelIcon />} onClick={handleNuevo}>
                                        Cancelar
                                    </Button>
                                </Box>
                            </Paper>
                        </Box>
                    </Box>
                </Fade>
            )}

            {/* PASO 3: Vinculado */}
            {step === 'done' && registered.length > 0 && (
                <Fade in>
                    <Paper sx={{ p: 3, mb: 2, border: '2px solid #1D9E75', bgcolor: '#0a1f18', textAlign: 'center' }}>
                        <CheckCircleIcon sx={{ fontSize: 56, color: '#1D9E75', mb: 1 }} />
                        <Typography variant="h6" sx={{ color: '#66FCF1', mb: 2 }}>¡Vinculado correctamente!</Typography>
                        <Box sx={{ textAlign: 'left', bgcolor: '#1F2833', border: '1px solid rgba(102,252,241,0.2)', borderRadius: 2, p: 2, mb: 2 }}>
                            <Typography variant="body2" sx={{ color: '#C5C6C7', mb: 0.5 }}>
                                <strong style={{ color: '#66FCF1' }}>Sticker:</strong> <code style={{ fontFamily: 'monospace', fontSize: 12 }}>{registered[0].epc}</code>
                            </Typography>
                            <Typography variant="body2" sx={{ color: '#C5C6C7', mb: 0.5 }}>
                                <strong style={{ color: '#66FCF1' }}>Producto:</strong> {registered[0].productName}
                            </Typography>
                            <Typography variant="body2" sx={{ color: '#C5C6C7', mb: 0.5 }}>
                                <strong style={{ color: '#66FCF1' }}>Unidad:</strong> {unitLabel(registered[0].unitId)}
                            </Typography>
                            <Typography variant="body2" sx={{ color: '#C5C6C7' }}>
                                <strong style={{ color: '#66FCF1' }}>SKU:</strong> {registered[0].sku}
                            </Typography>
                            {registered[0].isNew && <Chip label="Producto nuevo creado" color="warning" size="small" sx={{ mt: 1 }} />}
                        </Box>
                        <Typography variant="body2" sx={{ color: '#C5C6C7', mb: 2 }}>
                            📌 Pega el sticker en el elemento físico: <strong style={{ color: '#66FCF1' }}>{registered[0].productName} — {unitLabel(registered[0].unitId)}</strong>
                        </Typography>
                        <Button variant="contained" size="large" onClick={handleNuevo}
                            sx={{ bgcolor: '#66FCF1', color: '#0B0C10', '&:hover': { bgcolor: '#45e8d5' } }}>
                            Registrar siguiente sticker
                        </Button>
                    </Paper>
                </Fade>
            )}

            {/* Historial sesión — sin el bloque JSON */}
            {registered.length > 0 && (
                <Paper sx={{ p: 2, mt: 2 }}>
                    <Typography variant="subtitle2" color="primary" sx={{ mb: 1.5 }}>
                        Registrados en esta sesión ({registered.length})
                    </Typography>
                    <Table size="small">
                        <TableHead>
                            <TableRow>
                                <TableCell>Sticker (EPC)</TableCell>
                                <TableCell>Unidad</TableCell>
                                <TableCell>Producto</TableCell>
                                <TableCell>SKU</TableCell>
                                <TableCell>Hora</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {registered.map((r, i) => (
                                <TableRow key={i}>
                                    <TableCell><Typography variant="caption" fontFamily="monospace">{r.epc}</Typography></TableCell>
                                    <TableCell>
                                        <Chip label={unitLabel(r.unitId)} size="small" color="success" />
                                    </TableCell>
                                    <TableCell>
                                        <Typography variant="caption">{r.productName}</Typography>
                                        {r.isNew && <Chip label="Nuevo" size="small" color="warning" sx={{ ml: 0.5, fontSize: 9 }} />}
                                    </TableCell>
                                    <TableCell><Typography variant="caption" fontFamily="monospace">{r.sku}</Typography></TableCell>
                                    <TableCell><Typography variant="caption">{new Date(r.timestamp).toLocaleTimeString('es-CL')}</Typography></TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </Paper>
            )}
        </Box>
    )
}
