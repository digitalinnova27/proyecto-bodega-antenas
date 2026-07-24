import React from 'react'
import {
    Box, Typography, Paper, TextField, MenuItem, Button,
    Chip, Alert, Divider, CircularProgress, InputAdornment,
    Table, TableHead, TableRow, TableCell, TableBody, Fade, List,
    ListItem, ListItemText, Dialog, DialogTitle, DialogContent, DialogActions, IconButton,
    Autocomplete, Snackbar, LinearProgress
} from '@mui/material'
import WifiIcon from '@mui/icons-material/Wifi'
import LinkIcon from '@mui/icons-material/Link'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import SearchIcon from '@mui/icons-material/Search'
import QrCodeScannerIcon from '@mui/icons-material/QrCodeScanner'
import AddCircleIcon from '@mui/icons-material/AddCircle'
import CancelIcon from '@mui/icons-material/Cancel'
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked'
import CloseIcon from '@mui/icons-material/Close'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import LibraryAddIcon from '@mui/icons-material/LibraryAdd'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import UndoIcon from '@mui/icons-material/Undo'
import RestartAltIcon from '@mui/icons-material/RestartAlt'
import SortIcon from '@mui/icons-material/Sort'
import { useInventory } from '../context/InventoryContext'
import { useRfidSocket } from '../hooks/useRfidSocket'
import { useAuth } from '../context/AuthContext'

const CATEGORIES = ['Audio', 'Iluminacion', 'Pantalla', 'Efectos', 'Estructuras', 'Energía', 'Tecnologia', 'Otros']

// Mismos colores que Dashboard.jsx (CAT_COLORS) — se duplica acá para no
// crear una dependencia cruzada entre páginas por un solo objeto chico.
const CAT_COLORS = {
    Audio: '#1D9E75', Iluminacion: '#378ADD', Estructuras: '#7F77DD',
    Efectos: '#EF9F27', Energía: '#D85A30', Tecnologia: '#534AB7',
    Pantalla: '#D4537E', Otros: '#888780',
}

// Convierte "3-5" → "Unidad 5", "12-2" → "Unidad 2"
const unitLabel = (id) => {
    const parts = String(id).split('-')
    return `Unidad ${parts[parts.length - 1]}`
}

export default function RfidRegistrar() {
    const { products, addProduct, linkEpc, unlinkEpc, epcMap, nextSkuForFamily } = useInventory()
    const { role, currentUser: authUser } = useAuth()
    const currentUser = authUser ? `${authUser.nombre} ${authUser.apellido}` : (role === 'admin' ? 'Administrador' : 'Operador')
    const { isConnected, lastScan, unknownTags, clearLastScan } = useRfidSocket()
    // BUG FIX: useRfidSocket ahora comparte UNA sola conexión para toda la
    // app (ver RfidSocketContext), así que al entrar a esta pantalla
    // `lastScan`/`unknownTags` pueden traer arrastrado un scan de ANTES de
    // abrir esta página (de Operaciones, de una vinculación anterior en la
    // misma sesión, etc.). Sin esto, el primer render procesaba ese scan
    // viejo como si el operador recién hubiera pasado un sticker. Por eso
    // se inicializan estos refs con el valor YA presente al montar, así
    // solo se reacciona a lo que llegue de ahora en adelante.
    const lastUnknownRef = React.useRef(unknownTags && unknownTags.length > 0 ? unknownTags[unknownTags.length - 1] : null)
    const lastSeenScanRef = React.useRef(lastScan ? `${lastScan.epc}-${lastScan.timestamp}` : null)

    const [step, setStep] = React.useState('waiting')
    const [currentEpc, setCurrentEpc] = React.useState('')
    const [selectedUnit, setSelectedUnit] = React.useState('')
    const [registered, setRegistered] = React.useState([])
    const [saving, setSaving] = React.useState(false)
    const [manualEpc, setManualEpc] = React.useState('')

    const emptyForm = { name: '', skuFamily: '', sku: '', category: '', qty: '1', description: '' }
    const [newForm, setNewForm] = React.useState(emptyForm)

    const [search, setSearch] = React.useState('')
    const [selectedProd, setSelectedProd] = React.useState('')

    /* ────────────────────────────────────────────────────────────────────
     * MODO POR LOTE — vincular varios stickers al MISMO producto sin tener
     * que volver a elegirlo cada vez. El operador elige el producto una
     * sola vez y luego cada sticker escaneado se vincula automáticamente
     * a la siguiente unidad disponible de ese producto.
     * ──────────────────────────────────────────────────────────────────── */
    const [mode, setMode] = React.useState('individual') // 'individual' | 'bulk'
    const [bulkSearch, setBulkSearch] = React.useState('')
    const [bulkProductId, setBulkProductId] = React.useState('')
    const [bulkNotice, setBulkNotice] = React.useState({ open: false, severity: 'success', msg: '' })

    /* ── Vinculación de tags: categoría → producto → sesión acotada ──
     * bulkStep gobierna en qué paso de esta pantalla está el operador.
     * bulkSessionLinks guarda SOLO lo vinculado en la sesión activa actual
     * (se reinicia cada vez que se elige un producto nuevo), separado del
     * historial general `registered` — así el botón de reset puede deshacer
     * exactamente lo de esta sesión sin tocar vínculos de sesiones previas
     * del mismo producto. */
    const [bulkStep, setBulkStep] = React.useState('category') // 'category' | 'product' | 'session'
    const [bulkCategory, setBulkCategory] = React.useState('')
    const [bulkSort, setBulkSort] = React.useState('name-asc') // 'name-asc' | 'qty-desc' | 'qty-asc'
    const [bulkSessionLinks, setBulkSessionLinks] = React.useState([]) // [{epc, unitId, at}]
    const [resetConfirmOpen, setResetConfirmOpen] = React.useState(false)
    // Resalta por unos segundos la unidad que se acaba de vincular en la
    // grilla del lote, y deja un registro visible (no solo el snackbar
    // que desaparece) de cuál fue la última unidad vinculada.
    const [justLinkedUnitId, setJustLinkedUnitId] = React.useState(null)
    const justLinkedTimerRef = React.useRef(null)
    const [lastBulkLinked, setLastBulkLinked] = React.useState(null) // { unitId, epc, at }

    // Familias de SKU existentes (ej. "ILU", "AUD") para sugerir mientras se escribe
    const skuFamilies = React.useMemo(() => {
        return [...new Set(products.map(p => p.sku?.split('-')[0]).filter(Boolean))]
    }, [products])

    // Mapa inverso unitId → epc (para saber cuáles ya están vinculadas)
    const unitToEpc = React.useMemo(() => {
        const map = {}
        Object.entries(epcMap || {}).forEach(([epc, uid]) => { map[uid] = epc })
        return map
    }, [epcMap])

    const [alreadyLinked, setAlreadyLinked] = React.useState(null) // { epc, productName, unitLabel }

    // Vincula automáticamente un EPC a la siguiente unidad disponible del
    // producto fijado en modo lote, sin pedirle al operador que vuelva a
    // elegir el producto en cada sticker.
    const handleBulkAutoLink = (epc) => {
        const prod = products.find(p => p.id === Number(bulkProductId))
        if (!prod) {
            setBulkNotice({ open: true, severity: 'warning', msg: 'Selecciona un producto para activar el modo lote.' })
            return
        }
        const avail = prod.units.filter(u => !unitToEpc[u.id] && !registered.some(r => r.unitId === u.id))
        if (avail.length === 0) {
            setBulkNotice({ open: true, severity: 'warning', msg: `No quedan unidades disponibles en ${prod.name}.` })
            return
        }
        const unit = avail[0]
        const entry = {
            epc, unitId: unit.id,
            productName: prod.name, sku: prod.sku,
            timestamp: new Date().toISOString()
        }
        linkEpc(epc, unit.id)
        setRegistered(prev => [entry, ...prev])
        setBulkSessionLinks(prev => [...prev, { epc, unitId: unit.id, at: entry.timestamp }])
        setBulkNotice({ open: true, severity: 'success', msg: `Vinculado: ${unitLabel(unit.id)} — ${prod.name}` })

        // Feedback visual persistente (no depende del snackbar, que se
        // cierra solo): guarda cuál fue la última unidad vinculada y la
        // resalta brevemente en la grilla de unidades del lote.
        setLastBulkLinked({ unitId: unit.id, epc, at: new Date().toISOString() })
        setJustLinkedUnitId(unit.id)
        clearTimeout(justLinkedTimerRef.current)
        justLinkedTimerRef.current = setTimeout(() => setJustLinkedUnitId(null), 2200)
    }

    // Deshace SOLO la última lectura de la sesión activa (por si se pasó
    // el sticker equivocado). No toca vínculos de sesiones anteriores.
    const handleUndoLastBulk = () => {
        if (bulkSessionLinks.length === 0) return
        const last = bulkSessionLinks[bulkSessionLinks.length - 1]
        unlinkEpc(last.epc)
        setBulkSessionLinks(prev => prev.slice(0, -1))
        setRegistered(prev => prev.filter(r => !(r.epc === last.epc && r.unitId === last.unitId)))
        if (lastBulkLinked?.epc === last.epc) setLastBulkLinked(null)
        setBulkNotice({ open: true, severity: 'info', msg: `Deshecho: ${unitLabel(last.unitId)}` })
    }

    // Botón de emergencia: si por cualquier motivo la antena reconoció más
    // stickers de los solicitados (o alguno equivocado), esto libera TODOS
    // los tags vinculados durante la sesión activa (no los de sesiones
    // anteriores del mismo producto) y vuelve al inicio de la sección.
    const handleResetBulkSession = () => {
        bulkSessionLinks.forEach(({ epc }) => unlinkEpc(epc))
        const linkedEpcs = new Set(bulkSessionLinks.map(l => l.epc))
        setRegistered(prev => prev.filter(r => !linkedEpcs.has(r.epc)))
        setBulkSessionLinks([])
        setJustLinkedUnitId(null)
        setLastBulkLinked(null)
        setBulkProductId('')
        setBulkCategory('')
        setBulkStep('category')
        setResetConfirmOpen(false)
        setBulkNotice({ open: true, severity: 'info', msg: 'Vinculación detenida — los tags de esta sesión quedaron liberados.' })
    }

    // Punto único de entrada para cualquier EPC detectado (por antena o
    // manual). El comportamiento frente a un EPC YA vinculado depende del
    // modo:
    //  - Individual: es el flujo "escanea primero" — mostrar el aviso
    //    completo de "ya vinculado" es la forma principal en que el
    //    operador se entera del estado del sticker, así que se mantiene
    //    la pantalla bloqueante de siempre.
    //  - Vinculación de tags (bulk), sesión activa: un sticker ajeno ya
    //    vinculado (rollo de repuesto, otro producto sobre la mesa, una
    //    unidad de ESTE producto ya hecha en una sesión anterior) puede
    //    pasar cerca de la antena sin que eso sea relevante para lo que se
    //    está haciendo — interrumpir con un modal cada vez que eso ocurre
    //    frena la sesión sin necesidad. Se avisa de forma suave (snackbar)
    //    y se ignora, sin tocar el progreso ni la lista de la sesión.
    const processEpc = (epc) => {
        const existingUnitId = epcMap[epc]

        if (mode === 'bulk') {
            // Fuera del paso de escaneo (eligiendo categoría o producto)
            // no hay nada que vincular todavía — se ignora cualquier
            // lectura ambiental de la antena.
            if (bulkStep !== 'session') return

            if (existingUnitId) {
                const belongsToCurrent = bulkProduct?.units.some(u => u.id === existingUnitId)
                setBulkNotice({
                    open: true,
                    severity: belongsToCurrent ? 'info' : 'warning',
                    msg: belongsToCurrent
                        ? 'Esta unidad ya estaba vinculada — ignorado.'
                        : 'Sticker ya vinculado a otro producto — ignorado.'
                })
                return
            }

            handleBulkAutoLink(epc)
            return
        }

        // ── Modo individual: comportamiento sin cambios ──
        if (existingUnitId) {
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
    }

    // Captura de scan RFID
    React.useEffect(() => {
        if (!lastScan) return
        const scanKey = `${lastScan.epc}-${lastScan.timestamp}`
        if (lastSeenScanRef.current === scanKey) return // ya estaba ahí al entrar a esta página
        lastSeenScanRef.current = scanKey
        const epc = lastScan.epc
        clearLastScan()
        processEpc(epc)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [lastScan])

    // Captura de stickers NUEVOS / no registrados (el bridge los manda como
    // 'rfid_unknown' porque no existen en epcMap todavía). Antes esta página
    // solo escuchaba lastScan, que únicamente se dispara para EPCs YA
    // conocidos por el bridge — por eso un sticker nunca antes escaneado no
    // hacía nada en esta pantalla. Mismo patrón que usa Operations.jsx.
    React.useEffect(() => {
        if (!unknownTags || unknownTags.length === 0) return
        const epc = unknownTags[unknownTags.length - 1]
        if (lastUnknownRef.current === epc) return
        lastUnknownRef.current = epc
        processEpc(epc)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [unknownTags])

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

    // Filtrado de productos para el selector del modo lote (independiente
    // del buscador de Opción A, para no mezclar ambos flujos).
    const bulkFilteredProducts = React.useMemo(() => {
        if (!bulkSearch.trim()) return products
        const q = bulkSearch.toLowerCase()
        return products.filter(p =>
            p.name.toLowerCase().includes(q) ||
            p.sku.toLowerCase().includes(q) ||
            p.category.toLowerCase().includes(q)
        )
    }, [products, bulkSearch])

    const bulkProduct = products.find(p => p.id === Number(bulkProductId))
    const bulkLinkedCount = bulkProduct
        ? bulkProduct.units.filter(u => Boolean(unitToEpc[u.id]) || registered.some(r => r.unitId === u.id)).length
        : 0
    const bulkTotalCount = bulkProduct ? bulkProduct.units.length : 0
    const bulkAvailableCount = Math.max(bulkTotalCount - bulkLinkedCount, 0)
    const bulkProgressPct = bulkTotalCount > 0 ? Math.round((bulkLinkedCount / bulkTotalCount) * 100) : 0

    // Al cambiar de producto en el lote (o salir de él) se limpia el
    // resaltado y el "último vinculado", para no confundir con datos del
    // producto anterior.
    React.useEffect(() => {
        setJustLinkedUnitId(null)
        setLastBulkLinked(null)
        setBulkSessionLinks([])
    }, [bulkProductId])

    // Productos de la categoría elegida, ordenados según el criterio activo.
    const bulkCategoryProducts = React.useMemo(() => {
        const list = products.filter(p => p.category === bulkCategory)
        const sorted = [...list]
        if (bulkSort === 'name-asc') sorted.sort((a, b) => a.name.localeCompare(b.name))
        else if (bulkSort === 'qty-desc') sorted.sort((a, b) => b.total - a.total)
        else if (bulkSort === 'qty-asc') sorted.sort((a, b) => a.total - b.total)
        return sorted
    }, [products, bulkCategory, bulkSort])

    const handleVincular = async () => {
        if (!currentEpc || !selectedProd || !selectedUnit) return
        setSaving(true)
        const prod = products.find(p => p.id === Number(selectedProd))
        const entry = {
            epc: currentEpc, unitId: selectedUnit,
            productName: prod?.name || '', sku: prod?.sku || '',
            timestamp: new Date().toISOString()
        }
        // linkEpc ya sincroniza con el bridge (POST /api/epcmap) internamente
        linkEpc(currentEpc, selectedUnit)
        setRegistered(prev => [entry, ...prev])
        setSaving(false)
        setStep('done')
    }

    const handleCrearYVincular = async () => {
        if (!newForm.name || !newForm.sku || !newForm.category || !newForm.qty) return
        setSaving(true)
        const created = addProduct({ name: newForm.name, sku: newForm.sku, category: newForm.category, qty: newForm.qty, rfid: newForm.sku, description: newForm.description }, currentUser)
        const unitId = created?.units?.[0]?.id || `${created?.id}-1`
        const entry = { epc: currentEpc, unitId, productName: newForm.name, sku: newForm.sku, timestamp: new Date().toISOString(), isNew: true }
        // linkEpc ya sincroniza con el bridge (POST /api/epcmap) internamente
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

            {/* SELECTOR DE MODO — vinculación individual (un sticker a la vez,
                eligiendo producto y unidad cada vez) vs. por lote (se fija el
                producto una sola vez y cada sticker se vincula solo a la
                siguiente unidad disponible). */}
            <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                <Button
                    variant={mode === 'individual' ? 'contained' : 'outlined'}
                    startIcon={<LinkIcon />}
                    onClick={() => setMode('individual')}
                    sx={mode === 'individual' ? { bgcolor: '#66FCF1', color: '#0B0C10', '&:hover': { bgcolor: '#45e8d5' } } : {}}>
                    Vincular individual
                </Button>
                <Button
                    variant={mode === 'bulk' ? 'contained' : 'outlined'}
                    startIcon={<LibraryAddIcon />}
                    onClick={() => setMode('bulk')}
                    sx={mode === 'bulk' ? { bgcolor: '#66FCF1', color: '#0B0C10', '&:hover': { bgcolor: '#45e8d5' } } : {}}>
                    Vinculación de tags
                </Button>
            </Box>

            {/* ═══ MODO VINCULACIÓN DE TAGS (por categoría → producto → sesión) ═══ */}
            {mode === 'bulk' && (
                <Box sx={{ mb: 2 }}>

                    {/* PASO A: elegir categoría */}
                    {bulkStep === 'category' && (
                        <Paper sx={{ p: 2 }}>
                            <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1.5 }}>
                                Elige una categoría para ver sus productos
                            </Typography>
                            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 1.5 }}>
                                {CATEGORIES.map(cat => {
                                    const color = CAT_COLORS[cat] || '#888780'
                                    const count = products.filter(p => p.category === cat).length
                                    return (
                                        <Box key={cat}
                                            onClick={() => { setBulkCategory(cat); setBulkStep('product') }}
                                            sx={{
                                                cursor: 'pointer', borderRadius: 2, p: 2,
                                                border: '1px solid', borderColor: 'divider',
                                                borderLeft: `6px solid ${color}`,
                                                bgcolor: 'rgba(255,255,255,0.02)',
                                                transition: 'all .15s ease',
                                                '&:hover': { bgcolor: 'rgba(255,255,255,0.06)', transform: 'translateY(-2px)' }
                                            }}>
                                            <Typography variant="subtitle1" fontWeight={700}>{cat}</Typography>
                                            <Typography variant="caption" color="text.secondary">
                                                {count} producto{count !== 1 ? 's' : ''}
                                            </Typography>
                                        </Box>
                                    )
                                })}
                            </Box>
                        </Paper>
                    )}

                    {/* PASO B: elegir producto dentro de la categoría, con orden */}
                    {bulkStep === 'product' && (
                        <Paper sx={{ p: 2 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5, flexWrap: 'wrap', gap: 1 }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <Button size="small" startIcon={<ArrowBackIcon />}
                                        onClick={() => { setBulkStep('category'); setBulkCategory('') }}>
                                        Categorías
                                    </Button>
                                    <Typography variant="subtitle1" fontWeight={700}
                                        sx={{ color: CAT_COLORS[bulkCategory] || 'text.primary' }}>
                                        {bulkCategory}
                                    </Typography>
                                </Box>
                                <TextField select size="small" label="Ordenar por" value={bulkSort}
                                    onChange={e => setBulkSort(e.target.value)}
                                    sx={{ minWidth: 200 }}
                                    InputProps={{ startAdornment: <InputAdornment position="start"><SortIcon fontSize="small" /></InputAdornment> }}>
                                    <MenuItem value="name-asc">Nombre (A-Z)</MenuItem>
                                    <MenuItem value="qty-desc">Cantidad (mayor a menor)</MenuItem>
                                    <MenuItem value="qty-asc">Cantidad (menor a mayor)</MenuItem>
                                </TextField>
                            </Box>

                            {bulkCategoryProducts.length === 0 ? (
                                <Alert severity="info">Esta categoría no tiene productos.</Alert>
                            ) : (
                                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                    {bulkCategoryProducts.map(p => {
                                        const linkedCount = p.units.filter(u => Boolean(unitToEpc[u.id])).length
                                        return (
                                            <Box key={p.id}
                                                onClick={() => { setBulkProductId(p.id); setBulkStep('session') }}
                                                sx={{
                                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                                    cursor: 'pointer', p: 1.5, borderRadius: 2,
                                                    border: '1px solid', borderColor: 'divider',
                                                    '&:hover': { bgcolor: 'rgba(255,255,255,0.06)' }
                                                }}>
                                                <Box>
                                                    <Typography variant="body1">{p.name}</Typography>
                                                    <Typography variant="caption" color="text.secondary">{p.sku}</Typography>
                                                </Box>
                                                <Chip size="small"
                                                    label={`${linkedCount}/${p.total} vinculadas`}
                                                    color={linkedCount === p.total ? 'success' : 'default'}
                                                />
                                            </Box>
                                        )
                                    })}
                                </Box>
                            )}
                        </Paper>
                    )}

                    {/* PASO C: sesión de escaneo para el producto elegido */}
                    {bulkStep === 'session' && (bulkProduct ? (
                        <Box>
                            {/* Encabezado del lote: nombre + barra de progreso grande,
                                para que de un vistazo se sepa cuánto falta. */}
                            <Paper sx={{ p: 3, mb: 2, border: '2px solid #66FCF1', bgcolor: 'rgba(102,252,241,0.04)' }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5, flexWrap: 'wrap', gap: 1 }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                        <QrCodeScannerIcon sx={{ fontSize: 32, color: '#66FCF1' }} />
                                        <Box>
                                            <Typography variant="h6" sx={{ lineHeight: 1.2 }}>{bulkProduct.name}</Typography>
                                            <Typography variant="caption" color="text.secondary">{bulkProduct.sku} · Sesión activa</Typography>
                                        </Box>
                                    </Box>
                                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                                        <Button size="small" variant="outlined" startIcon={<UndoIcon />}
                                            disabled={bulkSessionLinks.length === 0}
                                            onClick={handleUndoLastBulk}>
                                            Deshacer última lectura
                                        </Button>
                                        <Button size="small" variant="outlined" color="warning" startIcon={<RestartAltIcon />}
                                            onClick={() => setResetConfirmOpen(true)}>
                                            Detener vinculación
                                        </Button>
                                        <Button size="small" variant="outlined" color="error" startIcon={<CancelIcon />}
                                            onClick={() => { setBulkProductId(''); setBulkStep('product') }}>
                                            Cambiar de producto
                                        </Button>
                                    </Box>
                                </Box>

                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.5 }}>
                                    <LinearProgress variant="determinate" value={bulkProgressPct}
                                        color={bulkProgressPct === 100 ? 'success' : 'primary'}
                                        sx={{ flex: 1, height: 12, borderRadius: 6 }} />
                                    <Typography variant="body2" fontWeight={700} sx={{ minWidth: 70, textAlign: 'right' }}>
                                        {bulkLinkedCount}/{bulkTotalCount}
                                    </Typography>
                                </Box>
                                <Typography variant="caption" color="text.secondary">
                                    {bulkAvailableCount === 0
                                        ? '✅ Todas las unidades ya están vinculadas — la lectura se detiene automáticamente'
                                        : `Pasa el siguiente sticker por la antena — quedan ${bulkAvailableCount} unidad${bulkAvailableCount !== 1 ? 'es' : ''} sin vincular`}
                                </Typography>
                            </Paper>

                            {/* Aviso persistente del último vinculado — a diferencia del
                                snackbar (que se cierra solo a los 3s), este se queda visible
                                hasta el próximo sticker, para que quede claro qué pasó. */}
                            {lastBulkLinked && (
                                <Alert severity="success" icon={<CheckCircleIcon />} sx={{ mb: 2 }}>
                                    Último vinculado: <strong>{unitLabel(lastBulkLinked.unitId)}</strong>
                                    {' '}— EPC <code style={{ fontFamily: 'monospace', fontSize: 12 }}>{lastBulkLinked.epc}</code>
                                </Alert>
                            )}

                            {/* Grilla visual de unidades: cada casilla representa una unidad
                                física del producto. Verde con check = ya vinculada; la última
                                vinculada parpadea/resalta un par de segundos para que se note
                                de inmediato cuál fue. Gris = todavía sin sticker. */}
                            <Paper sx={{ p: 2, mb: 2 }}>
                                <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1.5 }}>
                                    Unidades de {bulkProduct.name}
                                </Typography>
                                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 1 }}>
                                    {bulkProduct.units.map(u => {
                                        const isLinked = Boolean(unitToEpc[u.id]) || registered.some(r => r.unitId === u.id)
                                        const isJustLinked = justLinkedUnitId === u.id
                                        return (
                                            <Box key={u.id}
                                                sx={{
                                                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5,
                                                    p: 1.2, borderRadius: 2,
                                                    border: isJustLinked ? '2px solid #66FCF1' : '1px solid',
                                                    borderColor: isJustLinked ? '#66FCF1' : isLinked ? 'success.main' : 'divider',
                                                    bgcolor: isJustLinked
                                                        ? 'rgba(102,252,241,0.18)'
                                                        : isLinked ? 'rgba(29,158,117,0.10)' : 'transparent',
                                                    boxShadow: isJustLinked ? '0 0 12px rgba(102,252,241,0.7)' : 'none',
                                                    transition: 'all .25s ease'
                                                }}>
                                                {isLinked
                                                    ? <CheckCircleIcon sx={{ color: isJustLinked ? '#66FCF1' : '#1D9E75', fontSize: 22 }} />
                                                    : <RadioButtonUncheckedIcon sx={{ color: 'text.disabled', fontSize: 22 }} />
                                                }
                                                <Typography variant="caption" fontWeight={isLinked ? 700 : 400}
                                                    sx={{ color: isLinked ? 'text.primary' : 'text.disabled' }}>
                                                    {unitLabel(u.id)}
                                                </Typography>
                                            </Box>
                                        )
                                    })}
                                </Box>
                            </Paper>

                            <Paper sx={{ p: 2, textAlign: 'center' }}>
                                <Divider sx={{ mb: 2 }}>o ingresa manualmente</Divider>
                                <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center' }}>
                                    <TextField size="small" label="EPC manual" sx={{ width: 340 }} value={manualEpc}
                                        onChange={e => setManualEpc(e.target.value)}
                                        placeholder="ej: E2801160600002094EB9D944"
                                        onKeyDown={e => { if (e.key === 'Enter' && manualEpc.trim()) { processEpc(manualEpc.trim()); setManualEpc('') } }}
                                    />
                                    <Button variant="outlined" onClick={() => { if (manualEpc.trim()) { processEpc(manualEpc.trim()); setManualEpc('') } }}>
                                        Usar
                                    </Button>
                                </Box>
                            </Paper>
                        </Box>
                    ) : (
                        <Alert severity="info">Selecciona un producto para iniciar la sesión de vinculación.</Alert>
                    ))}

                    {/* Modal de confirmación para el botón "Detener vinculación" —
                        es la red de seguridad a prueba de fallas: si la restricción de
                        lectura falla y se leen más stickers de los deseados, esto libera
                        SOLO los tags vinculados durante la sesión activa y vuelve al inicio. */}
                    <Dialog open={resetConfirmOpen} onClose={() => setResetConfirmOpen(false)}>
                        <DialogTitle>¿Desea detener la vinculación?</DialogTitle>
                        <DialogContent>
                            <Typography variant="body2" color="text.secondary">
                                Se liberarán los {bulkSessionLinks.length} tag{bulkSessionLinks.length !== 1 ? 's' : ''} vinculado{bulkSessionLinks.length !== 1 ? 's' : ''} en esta sesión
                                y volverás al inicio de la sección. Los tags vinculados en sesiones anteriores no se ven afectados.
                            </Typography>
                        </DialogContent>
                        <DialogActions>
                            <Button onClick={() => setResetConfirmOpen(false)}>Cancelar</Button>
                            <Button color="warning" variant="contained" onClick={handleResetBulkSession}>Aceptar</Button>
                        </DialogActions>
                    </Dialog>
                </Box>
            )}

            {/* PASO 1: Esperando (modo individual) */}
            {mode === 'individual' && step === 'waiting' && (
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

            {/* Modal grande: sticker ya vinculado */}
            <Dialog
                open={Boolean(alreadyLinked)}
                onClose={() => setAlreadyLinked(null)}
                fullWidth
                maxWidth="sm"
            >
                <DialogTitle sx={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    bgcolor: 'rgba(255,167,38,0.12)', color: 'warning.main'
                }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <WarningAmberIcon /> Sticker ya vinculado
                    </Box>
                    <IconButton size="small" onClick={() => setAlreadyLinked(null)}>
                        <CloseIcon />
                    </IconButton>
                </DialogTitle>
                <DialogContent dividers sx={{ pt: 3 }}>
                    {alreadyLinked && (
                        <>
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                                EPC escaneado
                            </Typography>
                            <Typography variant="h6" fontFamily="monospace" sx={{ mb: 2, wordBreak: 'break-all' }}>
                                {alreadyLinked.epc}
                            </Typography>
                            <Divider sx={{ mb: 2 }} />
                            <Typography variant="body2" color="text.secondary">Asignado a</Typography>
                            <Typography variant="h6" fontWeight={700} sx={{ mb: 0.5 }}>
                                {alreadyLinked.productName}
                            </Typography>
                            <Chip label={alreadyLinked.unitLabel} color="warning" sx={{ mb: 2 }} />
                            <Alert severity="warning" sx={{ mt: 1 }}>
                                {alreadyLinked.productName === 'Producto desconocido'
                                    ? 'Este sticker quedó vinculado a un producto que ya fue eliminado. Ve a "Productos Vinculados" → sección "Stickers sin producto válido" → Liberar, y luego vuelve a escanearlo aquí.'
                                    : `Si necesitas usar este sticker en otro producto, ve a "Productos Vinculados" → busca ${alreadyLinked.productName} → Revisar → Desvincular, y luego vuelve a escanearlo aquí.`}
                            </Alert>
                        </>
                    )}
                </DialogContent>
            </Dialog>

            {/* PASO 2: Detectado (modo individual) */}
            {mode === 'individual' && step === 'detected' && (
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
                                <Autocomplete
                                    freeSolo
                                    options={skuFamilies}
                                    inputValue={newForm.skuFamily}
                                    onInputChange={(_, value) => setNewForm(prev => ({
                                        ...prev, skuFamily: value, sku: nextSkuForFamily(value)
                                    }))}
                                    renderInput={(params) => (
                                        <TextField {...params} fullWidth size="small" label="Familia SKU *"
                                            placeholder="ej: AUD" />
                                    )}
                                    sx={{ mb: 1 }}
                                />
                                <TextField fullWidth size="small" label="SKU asignado" value={newForm.sku} disabled
                                    helperText={newForm.sku ? 'Correlativo automático' : 'Aparece al elegir la familia'}
                                    sx={{ mb: 1 }} />
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

            {/* PASO 3: Vinculado (modo individual) */}
            {mode === 'individual' && step === 'done' && registered.length > 0 && (
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

            {/* Feedback de cada vinculación automática en modo lote */}
            <Snackbar
                open={bulkNotice.open}
                autoHideDuration={3000}
                onClose={() => setBulkNotice(prev => ({ ...prev, open: false }))}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                <Alert
                    severity={bulkNotice.severity}
                    onClose={() => setBulkNotice(prev => ({ ...prev, open: false }))}
                    sx={{ width: '100%' }}
                >
                    {bulkNotice.msg}
                </Alert>
            </Snackbar>
        </Box>
    )
}
