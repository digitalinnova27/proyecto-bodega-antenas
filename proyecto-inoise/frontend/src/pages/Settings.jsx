import React from 'react'
import {
  Box, Typography, Paper, FormControlLabel, Switch, Divider,
  Button, TextField, Dialog, DialogTitle, DialogContent, DialogActions,
  Avatar, Chip, IconButton, Alert, CircularProgress, MenuItem,
  Table, TableHead, TableRow, TableCell, TableBody, InputAdornment,
  Tooltip
} from '@mui/material'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import PersonAddIcon from '@mui/icons-material/PersonAdd'
import LockIcon from '@mui/icons-material/Lock'
import LockOpenIcon from '@mui/icons-material/LockOpen'
import VisibilityIcon from '@mui/icons-material/Visibility'
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff'
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings'
import FingerprintIcon from '@mui/icons-material/Fingerprint'
import WifiIcon from '@mui/icons-material/Wifi'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import AutorenewIcon from '@mui/icons-material/Autorenew'
import EditNoteIcon from '@mui/icons-material/EditNote'
import EmailIcon from '@mui/icons-material/Email'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import { ToggleButtonGroup, ToggleButton } from '@mui/material'
import { useAuth } from '../context/AuthContext'
import { AVATARS, CARGO_OPTIONS, PinPad } from './Login'

/* ─── Helper: renderizar avatar preset ─────────────────────────────────── */
function UserAvatar({ avatarId, size = 40 }) {
  const av = AVATARS.find(a => a.id === avatarId) || AVATARS[0]
  return (
    <Avatar sx={{ width: size, height: size, bgcolor: av.color, fontSize: size * 0.45 }}>
      {av.emoji}
    </Avatar>
  )
}

/* ─── Picker de avatar para los modales ────────────────────────────────── */
function AvatarPicker({ value, onChange }) {
  return (
    <Box sx={{ mb: 2 }}>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
        Avatar *
      </Typography>
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
        {AVATARS.map(av => (
          <Box
            key={av.id}
            onClick={() => onChange(av.id)}
            sx={{
              width: 44, height: 44, borderRadius: '50%',
              bgcolor: av.color,
              border: value === av.id ? '3px solid #66FCF1' : '3px solid transparent',
              cursor: 'pointer', fontSize: 20,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transform: value === av.id ? 'scale(1.15)' : 'scale(1)',
              transition: 'transform 0.15s, border-color 0.15s',
              userSelect: 'none'
            }}
          >
            {av.emoji}
          </Box>
        ))}
      </Box>
    </Box>
  )
}

/* ─── Validaciones ──────────────────────────────────────────────────────── */
function validatePassword(pw) {
  if (!pw) return null                       // campo opcional en edición
  if (pw.length < 8) return 'Mínimo 8 caracteres'
  if (!/[A-Z]/.test(pw)) return 'Debe incluir al menos una mayúscula'
  if (!/[a-z]/.test(pw)) return 'Debe incluir al menos una minúscula'
  if (!/[0-9]/.test(pw)) return 'Debe incluir al menos un número'
  if (!/[^A-Za-z0-9]/.test(pw)) return 'Debe incluir al menos un signo especial (ej. ! @ # $ %)'
  return null
}

/* ─── Generador de contraseña aleatoria segura ─────────────────────────────
 * Usa Web Crypto (crypto.getRandomValues), disponible en el renderer sin
 * imports extra. Se evitan caracteres ambiguos (I, l, 1, O, 0) para que
 * copiarla a mano o leerla en voz alta no genere errores, y se garantiza
 * al menos un carácter de cada categoría exigida por validatePassword. */
function generatePassword(length = 14) {
  const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
  const LOWER = 'abcdefghijkmnpqrstuvwxyz'
  const NUMS = '23456789'
  const SPECIAL = '!@#$%&*-_=+?'
  const ALL = UPPER + LOWER + NUMS + SPECIAL

  const randInt = (max) => {
    const arr = new Uint32Array(1)
    window.crypto.getRandomValues(arr)
    return arr[0] % max
  }
  const pick = (set) => set[randInt(set.length)]

  const chars = [pick(UPPER), pick(LOWER), pick(NUMS), pick(SPECIAL)]
  while (chars.length < length) chars.push(pick(ALL))
  // Fisher-Yates para que las 4 categorías garantizadas no queden siempre al inicio
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randInt(i + 1)
    ;[chars[i], chars[j]] = [chars[j], chars[i]]
  }
  return chars.join('')
}

/* ─── Modal: Crear / Editar usuario ────────────────────────────────────── */
function UserFormModal({ open, onClose, onSave, initialData, isCreate, forceRole }) {
  const { sendCredentialsEmail } = useAuth()

  const [form, setForm] = React.useState({
    nombre: '', apellido: '', email: '', cargo: CARGO_OPTIONS[0],
    avatar: '', username: '', password: '', confirm: '', role: 'operador'
  })
  const [pwMode, setPwMode] = React.useState('auto') // 'auto' | 'manual'
  const [errors, setErrors] = React.useState({})
  const [showPw, setShowPw] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [saveError, setSaveError] = React.useState('')
  const [copyMsg, setCopyMsg] = React.useState('')

  // Tras guardar con éxito y haber fijado una contraseña, se muestra un
  // paso final para copiarla / mandársela al operador antes de cerrar.
  const [savedStep, setSavedStep] = React.useState(null)
  const [sendingEmail, setSendingEmail] = React.useState(false)
  const [sendMsg, setSendMsg] = React.useState('')

  React.useEffect(() => {
    if (open) {
      // BUG-05: si el cargo guardado ya no existe en la lista nueva,
      // caer al primer elemento para evitar que el select quede vacío.
      const savedCargo = initialData?.cargo || ''
      const cargoValue = CARGO_OPTIONS.includes(savedCargo) ? savedCargo : CARGO_OPTIONS[0]
      const initialPw = isCreate ? generatePassword() : ''
      setForm({
        nombre: initialData?.nombre || '',
        apellido: initialData?.apellido || '',
        email: initialData?.email || '',
        cargo: cargoValue,
        avatar: initialData?.avatar || '',
        username: initialData?.username || '',
        password: initialPw,
        confirm: initialPw,
        role: forceRole || initialData?.role || 'operador'
      })
      setPwMode(isCreate ? 'auto' : 'manual')
      setErrors({})
      setSaveError('')
      setSavedStep(null)
      setSendMsg('')
    }
  }, [open, initialData, forceRole, isCreate])

  const set = (k, v) => {
    setForm(f => ({ ...f, [k]: v }))
    setErrors(e => ({ ...e, [k]: '' }))
    setSaveError('')
  }

  const handleRegenerate = () => {
    const pw = generatePassword()
    setForm(f => ({ ...f, password: pw, confirm: pw }))
    setErrors(e => ({ ...e, password: '', confirm: '' }))
  }

  const handleModeChange = (_e, mode) => {
    if (!mode) return
    setPwMode(mode)
    if (mode === 'auto') {
      const pw = generatePassword()
      setForm(f => ({ ...f, password: pw, confirm: pw }))
    } else {
      setForm(f => ({ ...f, password: '', confirm: '' }))
    }
    setErrors(e => ({ ...e, password: '', confirm: '' }))
  }

  const validate = () => {
    const e = {}
    if (!form.nombre.trim()) e.nombre = 'Requerido'
    if (!form.apellido.trim()) e.apellido = 'Requerido'
    if (!form.avatar) e.avatar = 'Elige un avatar'
    if (!form.username || form.username.length < 3) e.username = 'Mínimo 3 caracteres'
    if (/\s/.test(form.username)) e.username = 'Sin espacios'
    if (isCreate) {
      const pErr = validatePassword(form.password || 'x')  // forzar requerido en crear
      if (!form.password) e.password = 'Requerido'
      else if (pErr) e.password = pErr
      if (form.password !== form.confirm) e.confirm = 'Las contraseñas no coinciden'
    } else {
      if (form.password) {
        const pErr = validatePassword(form.password)
        if (pErr) e.password = pErr
        else if (form.password !== form.confirm) e.confirm = 'Las contraseñas no coinciden'
      }
    }
    return e
  }

  const handleSave = async () => {
    const e = validate()
    if (Object.keys(e).length > 0) { setErrors(e); return }
    setSaving(true)
    const fields = {
      nombre: form.nombre.trim(), apellido: form.apellido.trim(),
      email: form.email.trim(), cargo: form.cargo,
      avatar: form.avatar, username: form.username.trim(),
      role: form.role
    }
    const result = await onSave(fields, form.password || null)
    setSaving(false)
    if (result?.error) { setSaveError(result.error); return }
    if (form.password) {
      setSavedStep({
        id: result?.id || initialData?.id,
        username: form.username.trim(),
        password: form.password,
        nombre: form.nombre.trim(),
        email: form.email.trim()
      })
    } else {
      onClose()
    }
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(savedStep.password)
      setCopyMsg('¡Copiada!')
      setTimeout(() => setCopyMsg(''), 2000)
    } catch {
      setCopyMsg('No se pudo copiar')
    }
  }

  const handleSendEmail = async () => {
    if (!savedStep.id) return
    setSendingEmail(true)
    setSendMsg('')
    const accessUrl = typeof window !== 'undefined' ? window.location.origin : ''
    const res = await sendCredentialsEmail(savedStep.id, savedStep.password, accessUrl)
    setSendingEmail(false)
    setSendMsg(res.ok ? '✅ Correo enviado' : `❌ ${res.error || 'No se pudo enviar el correo'}`)
  }

  // ── Paso final: credenciales listas para copiar/enviar ──────────────────
  if (savedStep) {
    return (
      <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <CheckCircleIcon color="success" />
          {isCreate ? 'Usuario creado' : 'Contraseña actualizada'}
        </DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 2 }}>
            Guardá o enviá estos datos ahora — la contraseña no se puede volver a ver más adelante.
          </Alert>
          <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
            <TextField label="Usuario" size="small" fullWidth value={savedStep.username}
              InputProps={{ readOnly: true }} />
            <TextField label="Contraseña" size="small" fullWidth value={savedStep.password}
              type={showPw ? 'text' : 'password'}
              InputProps={{
                readOnly: true,
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton size="small" onClick={() => setShowPw(v => !v)}>
                      {showPw ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
                    </IconButton>
                    <IconButton size="small" onClick={handleCopy}>
                      <ContentCopyIcon fontSize="small" />
                    </IconButton>
                  </InputAdornment>
                )
              }}
            />
          </Box>
          {copyMsg && <Typography variant="caption" color="success.main" sx={{ display: 'block', mb: 1 }}>{copyMsg}</Typography>}

          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 1 }}>
            <Button
              variant="outlined" startIcon={sendingEmail ? <CircularProgress size={16} /> : <EmailIcon />}
              disabled={!savedStep.email || sendingEmail}
              onClick={handleSendEmail}
            >
              Enviar por correo
            </Button>
          </Box>
          {!savedStep.email && <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>Para enviar por correo, cargá un email en el perfil del usuario.</Typography>}
          {sendMsg && <Alert severity={sendMsg.startsWith('✅') ? 'success' : 'error'} sx={{ mt: 2 }}>{sendMsg}</Alert>}
        </DialogContent>
        <DialogActions>
          <Button variant="contained" onClick={onClose}>Cerrar</Button>
        </DialogActions>
      </Dialog>
    )
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>
        {isCreate ? 'Agregar operador' : `Editar: ${initialData?.nombre || ''} ${initialData?.apellido || ''}`}
      </DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', gap: 2, mb: 2, mt: 1 }}>
          <TextField label="Nombre *" size="small" sx={{ flex: 1 }}
            value={form.nombre} onChange={e => set('nombre', e.target.value)}
            error={!!errors.nombre} helperText={errors.nombre} />
          <TextField label="Apellido *" size="small" sx={{ flex: 1 }}
            value={form.apellido} onChange={e => set('apellido', e.target.value)}
            error={!!errors.apellido} helperText={errors.apellido} />
        </Box>
        <TextField label="Correo electrónico" size="small" fullWidth sx={{ mb: 2 }}
          type="email" value={form.email} onChange={e => set('email', e.target.value)} />
        <TextField label="Cargo *" select size="small" fullWidth sx={{ mb: 2 }}
          value={form.cargo} onChange={e => set('cargo', e.target.value)}>
          {CARGO_OPTIONS.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
        </TextField>

        {/* BUG-04: selector de rol — solo visible al crear, no al editar */}
        {isCreate && !forceRole && (
          <TextField label="Rol del sistema" select size="small" fullWidth sx={{ mb: 2 }}
            value={form.role} onChange={e => set('role', e.target.value)}>
            <MenuItem value="operador">Operador</MenuItem>
            <MenuItem value="admin">Administrador</MenuItem>
          </TextField>
        )}

        <AvatarPicker value={form.avatar} onChange={v => set('avatar', v)} />
        {errors.avatar && <Typography variant="caption" color="error" sx={{ display: 'block', mb: 1, mt: -1 }}>{errors.avatar}</Typography>}

        {/* Señuelos ocultos: Chrome/Edge ignoran autoComplete="off" en campos
            usuario/contraseña reales cuando detectan un login guardado para
            este mismo origen (la propia pantalla de Login) y los autocompletan
            igual. Poniendo un par usuario/contraseña falso e invisible ANTES
            de los campos reales, el navegador rellena el señuelo y deja los
            campos de verdad vacíos. */}
        <input type="text" name="fakeusernameremembered" autoComplete="username"
          style={{ position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }} tabIndex={-1} />
        <input type="password" name="fakepasswordremembered" autoComplete="new-password"
          style={{ position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }} tabIndex={-1} />

        <TextField label="Usuario *" size="small" fullWidth sx={{ mb: 2 }}
          value={form.username} onChange={e => set('username', e.target.value.toLowerCase())}
          error={!!errors.username} helperText={errors.username}
          inputProps={{ autoComplete: 'off', name: 'inoise-operator-username' }} />

        <Box sx={{ mb: 1 }}>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
            {isCreate ? 'Contraseña *' : 'Nueva contraseña (opcional — dejá "Escribir manual" en blanco para no cambiarla)'}
          </Typography>
          <ToggleButtonGroup
            size="small" exclusive value={pwMode} onChange={handleModeChange} sx={{ mb: 1 }}
          >
            <ToggleButton value="auto">
              <AutorenewIcon fontSize="small" sx={{ mr: 0.5 }} /> Generar automática
            </ToggleButton>
            <ToggleButton value="manual">
              <EditNoteIcon fontSize="small" sx={{ mr: 0.5 }} /> Escribir manual
            </ToggleButton>
          </ToggleButtonGroup>
        </Box>

        {pwMode === 'auto' ? (
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start', mb: 1 }}>
            <TextField
              label={isCreate ? 'Contraseña generada *' : 'Nueva contraseña generada'}
              size="small" sx={{ flex: 1 }}
              type={showPw ? 'text' : 'password'}
              value={form.password}
              InputProps={{
                readOnly: true,
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton size="small" onClick={() => setShowPw(v => !v)}>
                      {showPw ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
                    </IconButton>
                  </InputAdornment>
                )
              }}
            />
            <Button variant="outlined" size="small" startIcon={<AutorenewIcon />} onClick={handleRegenerate} sx={{ mt: 0.3 }}>
              Generar otra
            </Button>
          </Box>
        ) : (
          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField
              label={isCreate ? 'Contraseña *' : 'Nueva contraseña (opcional)'}
              size="small" sx={{ flex: 1 }}
              type={showPw ? 'text' : 'password'}
              value={form.password} onChange={e => set('password', e.target.value)}
              error={!!errors.password} helperText={errors.password || 'Mín. 8 caracteres, mayúscula, minúscula, número y signo especial'}
              inputProps={{ autoComplete: 'new-password', name: 'inoise-operator-password' }}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton size="small" onClick={() => setShowPw(v => !v)}>
                      {showPw ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
                    </IconButton>
                  </InputAdornment>
                )
              }}
            />
            <TextField label="Confirmar" size="small" sx={{ flex: 1 }}
              type={showPw ? 'text' : 'password'}
              value={form.confirm} onChange={e => set('confirm', e.target.value)}
              error={!!errors.confirm} helperText={errors.confirm}
              inputProps={{ autoComplete: 'new-password', name: 'inoise-operator-password-confirm' }} />
          </Box>
        )}

        {saveError && <Alert severity="error" sx={{ mt: 2 }}>{saveError}</Alert>}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancelar</Button>
        <Button variant="contained" onClick={handleSave} disabled={saving}>
          {saving ? <CircularProgress size={20} /> : isCreate ? 'Crear' : 'Guardar'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

/* ─── Modal: Confirmar eliminación ─────────────────────────────────────── */
function DeleteConfirmModal({ open, user, onConfirm, onClose }) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Eliminar usuario</DialogTitle>
      <DialogContent>
        <Alert severity="warning" sx={{ mb: 1 }}>
          Se eliminará permanentemente la cuenta de{' '}
          <strong>{user?.nombre} {user?.apellido}</strong> ({user?.username}).
          Esta acción no se puede deshacer.
        </Alert>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancelar</Button>
        <Button variant="contained" color="error" onClick={onConfirm}>Eliminar</Button>
      </DialogActions>
    </Dialog>
  )
}

/* ─── Sección de gestión de usuarios (solo admin) ───────────────────────── */
function UserManagement() {
  const { currentUser, users, updateUser, deleteUser, createUser, verifyAdminPassword, setUserActive } = useAuth()

  const [unlocked, setUnlocked] = React.useState(false)
  const [lockPw, setLockPw] = React.useState('')
  const [lockError, setLockError] = React.useState('')
  const [lockLoading, setLockLoading] = React.useState(false)
  const [showLockPw, setShowLockPw] = React.useState(false)
  const [togglingId, setTogglingId] = React.useState(null)
  const [toggleError, setToggleError] = React.useState('')

  const [editUser, setEditUser] = React.useState(null)
  const [deleteTarget, setDeleteTarget] = React.useState(null)
  const [createOpen, setCreateOpen] = React.useState(false)

  const handleUnlock = async () => {
    // Guard: si ya hay una verificación en curso (ej. el usuario apretó
    // Enter varias veces seguidas), no disparar otra — antes esto podía
    // apilar varios pedidos al servidor y la respuesta tardaba mucho más
    // en llegar de lo esperado, sobre todo en conexiones remotas (Tailscale).
    if (lockLoading) return
    setLockLoading(true)
    const ok = await verifyAdminPassword(lockPw)
    setLockLoading(false)
    if (!ok) { setLockError('Contraseña incorrecta'); return }
    setUnlocked(true)
    setLockPw('')
    setLockError('')
  }

  // Traduce mensajes crudos de SQLite a algo entendible para el usuario final
  // (ej. "UNIQUE constraint failed: users.username" → nombre de usuario repetido).
  const friendlyUserError = (msg) => {
    if (!msg) return null
    if (msg.includes('UNIQUE constraint failed: users.username')) {
      return 'Ese nombre de usuario ya está en uso. Elige otro.'
    }
    if (msg.includes('UNIQUE constraint failed')) {
      return 'Ya existe un usuario con esos datos.'
    }
    return msg
  }

  const handleSaveUser = async (fields, newPassword) => {
    const res = await updateUser(editUser.id, fields, newPassword)
    if (!res.ok) return { error: friendlyUserError(res.error) || 'Error al guardar' }
    return { error: null, id: editUser.id }
  }

  const handleCreateUser = async (fields, password) => {
    // El rol viene del formulario (Operador o Administrador, elegido por el admin)
    const res = await createUser(fields, password)
    if (!res.ok) return { error: friendlyUserError(res.error) || 'Error al crear usuario' }
    return { error: null, id: res.data?.id }
  }

  const handleDeleteConfirm = async () => {
    await deleteUser(deleteTarget.id)
    setDeleteTarget(null)
  }

  const handleToggleActive = async (u) => {
    setTogglingId(u.id)
    setToggleError('')
    const res = await setUserActive(u.id, !u.active)
    setTogglingId(null)
    if (!res.ok) setToggleError(res.error || 'Error al cambiar estado')
  }

  // Un usuario no puede deshabilitarse a sí mismo.
  // Tampoco se puede deshabilitar al único admin activo.
  const activeAdmins = users.filter(u => u.role === 'admin' && u.active !== false)
  const canToggle = (u) => {
    if (u.id === currentUser?.id) return false
    if (u.role === 'admin' && u.active !== false && activeAdmins.length <= 1) return false
    return true
  }
  const toggleTooltip = (u) => {
    if (u.id === currentUser?.id) return 'No podés deshabilitarte a vos mismo'
    if (u.role === 'admin' && u.active !== false && activeAdmins.length <= 1) return 'No podés deshabilitar al único administrador activo'
    return u.active !== false ? 'Deshabilitar usuario' : 'Habilitar usuario'
  }

  const roleChipColor = (role) => role === 'admin' ? 'warning' : 'default'

  return (
    <Paper sx={{ p: 2.5 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <AdminPanelSettingsIcon color="primary" />
        <Typography variant="h6">Gestión de usuarios</Typography>
        {unlocked && (
          <Chip
            icon={<LockOpenIcon sx={{ fontSize: 14 }} />}
            label="Desbloqueado"
            size="small" color="success" variant="outlined"
            sx={{ ml: 'auto' }}
            onDelete={() => setUnlocked(false)}
            deleteIcon={<LockIcon sx={{ fontSize: 14 }} />}
          />
        )}
      </Box>

      {/* Bloqueo con contraseña admin */}
      {!unlocked ? (
        <Box sx={{ maxWidth: 380 }}>
          <Alert severity="info" sx={{ mb: 2 }}>
            Ingresa tu contraseña de administrador para gestionar los perfiles del sistema.
          </Alert>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <TextField
              size="small" sx={{ flex: 1 }}
              type={showLockPw ? 'text' : 'password'}
              label="Contraseña admin"
              value={lockPw}
              disabled={lockLoading}
              onChange={e => { setLockPw(e.target.value); setLockError('') }}
              onKeyDown={e => e.key === 'Enter' && handleUnlock()}
              error={!!lockError} helperText={lockError}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton size="small" onClick={() => setShowLockPw(v => !v)}>
                      {showLockPw ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
                    </IconButton>
                  </InputAdornment>
                )
              }}
            />
            <Button
              variant="contained" onClick={handleUnlock} disabled={lockLoading}
              startIcon={lockLoading ? <CircularProgress size={16} /> : <LockOpenIcon />}
            >
              Verificar
            </Button>
          </Box>
        </Box>
      ) : (
        <>
          {toggleError && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setToggleError('')}>
              {toggleError}
            </Alert>
          )}
          {/* Lista de usuarios */}
          <Table size="small" sx={{ mb: 2 }}>
            <TableHead>
              <TableRow>
                <TableCell>Usuario</TableCell>
                <TableCell>Nombre</TableCell>
                <TableCell>Cargo</TableCell>
                <TableCell>Correo</TableCell>
                <TableCell>Rol</TableCell>
                <TableCell align="center">Habilitado</TableCell>
                <TableCell align="right">Acciones</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {users.map(u => {
                const isActive = u.active !== false
                return (
                  <TableRow
                    key={u.id} hover
                    sx={{ opacity: isActive ? 1 : 0.5, transition: 'opacity 0.2s' }}
                  >
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <UserAvatar avatarId={u.avatar} size={32} />
                        <Typography variant="body2" fontFamily="monospace">{u.username}</Typography>
                      </Box>
                    </TableCell>
                    <TableCell>{u.nombre} {u.apellido}</TableCell>
                    <TableCell>{u.cargo || '—'}</TableCell>
                    <TableCell sx={{ color: 'text.secondary', fontSize: 13 }}>{u.email || '—'}</TableCell>
                    <TableCell>
                      <Chip
                        label={u.role === 'admin' ? 'Admin' : 'Operador'}
                        size="small"
                        color={roleChipColor(u.role)}
                        variant={u.role === 'admin' ? 'filled' : 'outlined'}
                      />
                    </TableCell>
                    <TableCell align="center">
                      <Tooltip title={toggleTooltip(u)}>
                        <span>
                          <Switch
                            size="small"
                            checked={isActive}
                            disabled={!canToggle(u) || togglingId === u.id}
                            onChange={() => handleToggleActive(u)}
                            color="success"
                          />
                        </span>
                      </Tooltip>
                    </TableCell>
                    <TableCell align="right">
                      <IconButton size="small" onClick={() => setEditUser(u)} title="Editar">
                        <EditIcon fontSize="small" />
                      </IconButton>
                      <IconButton
                        size="small" color="error"
                        disabled={u.id === currentUser?.id}
                        onClick={() => setDeleteTarget(u)}
                        title={u.id === currentUser?.id ? 'No puedes eliminar tu propia cuenta' : 'Eliminar'}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>

          <Button
            variant="outlined"
            startIcon={<PersonAddIcon />}
            onClick={() => setCreateOpen(true)}
          >
            Agregar operador
          </Button>
        </>
      )}

      {/* Modal editar */}
      <UserFormModal
        open={Boolean(editUser)}
        onClose={() => setEditUser(null)}
        onSave={handleSaveUser}
        initialData={editUser}
        isCreate={false}
      />

      {/* Modal crear */}
      <UserFormModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSave={handleCreateUser}
        initialData={null}
        isCreate={true}
      />

      {/* Modal eliminar */}
      <DeleteConfirmModal
        open={Boolean(deleteTarget)}
        user={deleteTarget}
        onConfirm={handleDeleteConfirm}
        onClose={() => setDeleteTarget(null)}
      />
    </Paper>
  )
}

/* ─── Configuración SMTP — correo emisor de credenciales (solo admin) ────── */
function SmtpSettings() {
  const { getSmtpConfig, setSmtpConfig } = useAuth()
  const [email, setEmail] = React.useState('')
  const [appPassword, setAppPassword] = React.useState('')
  const [host, setHost] = React.useState('smtp.gmail.com')
  const [port, setPort] = React.useState(465)
  const [hasPassword, setHasPassword] = React.useState(false)
  const [showPw, setShowPw] = React.useState(false)
  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState(false)
  const [msg, setMsg] = React.useState('')

  React.useEffect(() => {
    (async () => {
      const res = await getSmtpConfig()
      if (res.ok !== false) {
        setEmail(res.email || '')
        setHost(res.host || 'smtp.gmail.com')
        setPort(res.port || 465)
        setHasPassword(!!res.hasPassword)
      }
      setLoading(false)
    })()
  }, [getSmtpConfig])

  const handleSave = async () => {
    setSaving(true)
    setMsg('')
    const res = await setSmtpConfig({ email: email.trim(), appPassword: appPassword || undefined, host, port: Number(port) })
    setSaving(false)
    if (res.ok === false) { setMsg(`❌ ${res.error || 'No se pudo guardar'}`); return }
    setHasPassword(!!res.hasPassword)
    setAppPassword('')
    setMsg('✅ Configuración guardada')
    setTimeout(() => setMsg(''), 3000)
  }

  if (loading) return null

  return (
    <Paper sx={{ p: 2.5, mt: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <EmailIcon color="primary" />
        <Typography variant="h6">Correo emisor de credenciales</Typography>
      </Box>
      <Alert severity="info" sx={{ mb: 2 }}>
        Cuenta usada para enviar automáticamente el usuario y contraseña a los operadores nuevos.
        Con Gmail, usá una "contraseña de aplicación" (no tu contraseña normal de Google) —
        se genera en la configuración de seguridad de tu cuenta de Google.
      </Alert>
      <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap' }}>
        <TextField label="Correo emisor" size="small" sx={{ flex: 1, minWidth: 220 }}
          type="email" value={email} onChange={e => setEmail(e.target.value)} />
        <TextField
          label={hasPassword ? 'Contraseña de aplicación (guardada — dejar en blanco para no cambiar)' : 'Contraseña de aplicación'}
          size="small" sx={{ flex: 1, minWidth: 260 }}
          type={showPw ? 'text' : 'password'}
          value={appPassword} onChange={e => setAppPassword(e.target.value)}
          InputProps={{
            endAdornment: (
              <InputAdornment position="end">
                <IconButton size="small" onClick={() => setShowPw(v => !v)}>
                  {showPw ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
                </IconButton>
              </InputAdornment>
            )
          }}
        />
      </Box>
      <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
        <TextField label="Servidor SMTP" size="small" sx={{ flex: 1 }} value={host} onChange={e => setHost(e.target.value)} />
        <TextField label="Puerto" size="small" sx={{ width: 120 }} type="number" value={port} onChange={e => setPort(e.target.value)} />
      </Box>
      <Button variant="contained" onClick={handleSave} disabled={saving} startIcon={saving ? <CircularProgress size={16} /> : null}>
        Guardar configuración
      </Button>
      {msg && <Typography variant="body2" sx={{ mt: 1.5 }}>{msg}</Typography>}
    </Paper>
  )
}

/* ─── Panel de conexión en red ───────────────────────────────────────────── */
function NetworkPanel() {
  const [info, setInfo] = React.useState(null)
  const [copied, setCopied] = React.useState(false)

  React.useEffect(() => {
    if (window.api?.getServerInfo) {
      window.api.getServerInfo().then(setInfo).catch(() => { })
    } else {
      setInfo({ networkUrl: window.location.origin, webUrl: window.location.origin, ip: window.location.hostname })
    }
  }, [])

  // webUrl  → navegador (Vite :5173 en dev, Express :3005 en prod)
  // networkUrl → conexión Electron cliente (siempre :3005)
  const webUrl     = info?.webUrl     || info?.networkUrl || '—'
  const electronUrl = info?.networkUrl || '—'

  const copyUrl = (url) => {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const urlBox = (label, url) => (
    <Box sx={{ mb: 1.5 }}>
      <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
        {label}
      </Typography>
      <Box sx={{
        display: 'flex', alignItems: 'center', gap: 1,
        bgcolor: 'rgba(102,252,241,0.06)',
        border: '1px solid rgba(102,252,241,0.2)',
        borderRadius: 2, px: 2, py: 1.2
      }}>
        <Typography
          variant="body2"
          sx={{ flex: 1, fontFamily: 'monospace', color: '#66FCF1', fontWeight: 500 }}
        >
          {url}
        </Typography>
        <Tooltip title={copied ? '¡Copiado!' : 'Copiar'}>
          <IconButton size="small" onClick={() => copyUrl(url)} sx={{ color: copied ? '#66FCF1' : 'text.secondary' }}>
            <ContentCopyIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>
    </Box>
  )

  return (
    <Paper sx={{ p: 2, mb: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
        <WifiIcon sx={{ color: '#66FCF1' }} />
        <Typography variant="subtitle1" fontWeight={600}>Acceso desde otros dispositivos</Typography>
      </Box>

      {urlBox('🌐 Navegador web (misma red WiFi)', webUrl)}
      {urlBox('🖥️ Conexión app Electron (operadores)', electronUrl)}

      <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
        El lector RFID debe estar conectado al PC principal. Los operadores usan la
        URL de Electron para configurar su app la primera vez.
      </Typography>
    </Paper>
  )
}

/* ─── Gestión de PIN (todos los usuarios) ───────────────────────────────── */
function PinManagement() {
  const { currentUser, verifyAdminPassword, setUserPin, removeUserPin } = useAuth()

  // phase: 'status' | 'verifyForSet' | 'enterPin' | 'confirmPin' | 'verifyForRemove'
  const [phase, setPhase] = React.useState('status')
  const [pwValue, setPwValue] = React.useState('')
  const [pwError, setPwError] = React.useState('')
  const [showPw, setShowPw] = React.useState(false)
  const [pinFirst, setPinFirst] = React.useState('')
  const [pinSecond, setPinSecond] = React.useState('')
  const [pinError, setPinError] = React.useState('')
  const [loading, setLoading] = React.useState(false)
  const [successMsg, setSuccessMsg] = React.useState('')

  const hasPin = currentUser?.hasPin

  const showSuccess = (msg) => {
    setSuccessMsg(msg)
    setTimeout(() => setSuccessMsg(''), 3500)
  }

  const reset = () => {
    setPhase('status')
    setPwValue('')
    setPwError('')
    setPinFirst('')
    setPinSecond('')
    setPinError('')
    setLoading(false)
  }

  const handleVerifyPw = async () => {
    if (loading) return  // evita apilar pedidos si se presiona Enter varias veces
    if (!pwValue) { setPwError('Ingresa tu contraseña'); return }
    setLoading(true)
    const ok = await verifyAdminPassword(pwValue)
    setLoading(false)
    if (!ok) { setPwError('Contraseña incorrecta'); return }
    setPwValue('')
    setPwError('')
    if (phase === 'verifyForRemove') {
      setLoading(true)
      await removeUserPin(currentUser.id)
      setLoading(false)
      reset()
      showSuccess('PIN eliminado correctamente')
    } else {
      setPhase('enterPin')
    }
  }

  const handleFirstPin = (val) => {
    setPinFirst(val)
    setPinSecond('')
    setPhase('confirmPin')
  }

  const handleConfirmPin = async (val) => {
    if (val !== pinFirst) {
      setPinError('Los PINs no coinciden. Inténtalo de nuevo.')
      setLoading(true)
      setTimeout(() => {
        setPinFirst('')
        setPinSecond('')
        setPinError('')
        setLoading(false)
        setPhase('enterPin')
      }, 1400)
      return
    }
    setLoading(true)
    await setUserPin(currentUser.id, val)
    setLoading(false)
    reset()
    showSuccess('PIN configurado. Ya puedes usarlo en el inicio de sesión.')
  }

  return (
    <Paper sx={{ p: 2.5 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <FingerprintIcon color="primary" />
        <Typography variant="h6">Acceso rápido (PIN)</Typography>
      </Box>

      {successMsg && <Alert severity="success" sx={{ mb: 2 }}>{successMsg}</Alert>}

      {/* ── Estado actual ── */}
      {phase === 'status' && (
        <>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2, flexWrap: 'wrap' }}>
            <Chip
              label={hasPin ? '✅ PIN configurado' : '❌ Sin PIN'}
              color={hasPin ? 'success' : 'default'}
              variant="outlined"
              size="small"
            />
            <Typography variant="body2" color="text.secondary">
              {hasPin
                ? 'Puedes usar el PIN en la pantalla de inicio de sesión.'
                : 'Configura un PIN de 4 dígitos para acceso rápido.'}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              variant="contained"
              size="small"
              startIcon={<FingerprintIcon />}
              onClick={() => setPhase('verifyForSet')}
            >
              {hasPin ? 'Cambiar PIN' : 'Configurar PIN'}
            </Button>
            {hasPin && (
              <Button
                variant="outlined"
                size="small"
                color="error"
                onClick={() => setPhase('verifyForRemove')}
              >
                Eliminar PIN
              </Button>
            )}
          </Box>
        </>
      )}

      {/* ── Verificar contraseña ── */}
      {(phase === 'verifyForSet' || phase === 'verifyForRemove') && (
        <Box sx={{ maxWidth: 380 }}>
          <Alert severity="info" sx={{ mb: 2 }}>
            {phase === 'verifyForRemove'
              ? 'Ingresa tu contraseña para eliminar el PIN.'
              : 'Ingresa tu contraseña para continuar.'}
          </Alert>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <TextField
              size="small" sx={{ flex: 1 }}
              type={showPw ? 'text' : 'password'}
              label="Contraseña actual"
              value={pwValue}
              disabled={loading}
              onChange={e => { setPwValue(e.target.value); setPwError('') }}
              onKeyDown={e => e.key === 'Enter' && handleVerifyPw()}
              error={!!pwError} helperText={pwError}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton size="small" onClick={() => setShowPw(v => !v)}>
                      {showPw ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
                    </IconButton>
                  </InputAdornment>
                )
              }}
            />
            <Button variant="contained" onClick={handleVerifyPw} disabled={loading}>
              {loading ? <CircularProgress size={20} /> : 'Verificar'}
            </Button>
          </Box>
          <Button size="small" sx={{ mt: 1 }} onClick={reset}>Cancelar</Button>
        </Box>
      )}

      {/* ── Ingresar nuevo PIN ── */}
      {phase === 'enterPin' && (
        <Box sx={{ maxWidth: 260 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
            Ingresa tu nuevo PIN de 4 dígitos
          </Typography>
          <PinPad
            value={pinFirst}
            onChange={v => { setPinFirst(v); setPinError('') }}
            onSubmit={handleFirstPin}
            disabled={loading}
          />
          <Box sx={{ mt: 1 }}>
            <Button size="small" onClick={reset}>Cancelar</Button>
          </Box>
        </Box>
      )}

      {/* ── Confirmar PIN ── */}
      {phase === 'confirmPin' && (
        <Box sx={{ maxWidth: 260 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
            Confirmá el PIN
          </Typography>
          <PinPad
            value={pinSecond}
            onChange={v => { setPinSecond(v); if (pinError) setPinError('') }}
            onSubmit={handleConfirmPin}
            disabled={loading}
            error={pinError}
          />
          <Box sx={{ mt: 1 }}>
            <Button size="small" onClick={() => { setPhase('enterPin'); setPinFirst(''); setPinSecond('') }}>
              ← Reingresar PIN
            </Button>
          </Box>
        </Box>
      )}
    </Paper>
  )
}

/* ─── Página principal de Configuración ────────────────────────────────── */
export default function Settings() {
  const { role } = useAuth()

  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 2 }}>Configuración</Typography>

      {/* General — disponible para todos */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1.5 }}>General</Typography>
        <FormControlLabel control={<Switch defaultChecked />} label="Notificaciones por correo" />
        <FormControlLabel control={<Switch defaultChecked />} label="Alertas en panel" />
      </Paper>

      {/* Conexión en red — muestra la URL para que otros dispositivos se conecten */}
      <NetworkPanel />

      {/* Acceso rápido PIN — disponible para todos los usuarios */}
      <PinManagement />

      {/* Gestión de usuarios — exclusivo admin */}
      {role === 'admin' && (
        <>
          <Divider sx={{ my: 2 }} />
          <UserManagement />
          <SmtpSettings />
        </>
      )}
    </Box>
  )
}
