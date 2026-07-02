import React from 'react'
import {
  Box, Typography, Paper, FormControlLabel, Switch, Divider,
  Button, TextField, Dialog, DialogTitle, DialogContent, DialogActions,
  Avatar, Chip, IconButton, Alert, CircularProgress, MenuItem,
  Table, TableHead, TableRow, TableCell, TableBody, InputAdornment
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
  if (!/[0-9]/.test(pw)) return 'Debe incluir al menos un número'
  return null
}

/* ─── Modal: Crear / Editar usuario ────────────────────────────────────── */
function UserFormModal({ open, onClose, onSave, initialData, isCreate, forceRole }) {
  const [form, setForm] = React.useState({
    nombre: '', apellido: '', email: '', cargo: CARGO_OPTIONS[0],
    avatar: '', username: '', password: '', confirm: ''
  })
  const [errors, setErrors] = React.useState({})
  const [showPw, setShowPw] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [saveError, setSaveError] = React.useState('')

  React.useEffect(() => {
    if (open) {
      setForm({
        nombre: initialData?.nombre || '',
        apellido: initialData?.apellido || '',
        email: initialData?.email || '',
        cargo: initialData?.cargo || CARGO_OPTIONS[0],
        avatar: initialData?.avatar || '',
        username: initialData?.username || '',
        password: '',
        confirm: ''
      })
      setErrors({})
      setSaveError('')
    }
  }, [open, initialData])

  const set = (k, v) => {
    setForm(f => ({ ...f, [k]: v }))
    setErrors(e => ({ ...e, [k]: '' }))
    setSaveError('')
  }

  const validate = () => {
    const e = {}
    if (!form.nombre.trim())   e.nombre = 'Requerido'
    if (!form.apellido.trim()) e.apellido = 'Requerido'
    if (!form.avatar)          e.avatar = 'Elige un avatar'
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
      role: forceRole || initialData?.role || 'operador'
    }
    const err = await onSave(fields, form.password || null)
    setSaving(false)
    if (err) { setSaveError(err); return }
    onClose()
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

        <AvatarPicker value={form.avatar} onChange={v => set('avatar', v)} />
        {errors.avatar && <Typography variant="caption" color="error" sx={{ display: 'block', mb: 1, mt: -1 }}>{errors.avatar}</Typography>}

        <TextField label="Usuario *" size="small" fullWidth sx={{ mb: 2 }}
          value={form.username} onChange={e => set('username', e.target.value.toLowerCase())}
          error={!!errors.username} helperText={errors.username}
          inputProps={{ autoComplete: 'off' }} />

        <Box sx={{ display: 'flex', gap: 2 }}>
          <TextField
            label={isCreate ? 'Contraseña *' : 'Nueva contraseña (opcional)'}
            size="small" sx={{ flex: 1 }}
            type={showPw ? 'text' : 'password'}
            value={form.password} onChange={e => set('password', e.target.value)}
            error={!!errors.password} helperText={errors.password}
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
            error={!!errors.confirm} helperText={errors.confirm} />
        </Box>

        {!isCreate && (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
            Deja la contraseña en blanco para no cambiarla.
          </Typography>
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
  const { currentUser, users, updateUser, deleteUser, createUser, verifyAdminPassword } = useAuth()

  const [unlocked, setUnlocked] = React.useState(false)
  const [lockPw, setLockPw] = React.useState('')
  const [lockError, setLockError] = React.useState('')
  const [lockLoading, setLockLoading] = React.useState(false)
  const [showLockPw, setShowLockPw] = React.useState(false)

  const [editUser, setEditUser] = React.useState(null)
  const [deleteTarget, setDeleteTarget] = React.useState(null)
  const [createOpen, setCreateOpen] = React.useState(false)

  const handleUnlock = async () => {
    setLockLoading(true)
    const ok = await verifyAdminPassword(lockPw)
    setLockLoading(false)
    if (!ok) { setLockError('Contraseña incorrecta'); return }
    setUnlocked(true)
    setLockPw('')
    setLockError('')
  }

  const handleSaveUser = async (fields, newPassword) => {
    const res = await updateUser(editUser.id, fields, newPassword)
    if (!res.ok) return res.error || 'Error al guardar'
    return null
  }

  const handleCreateUser = async (fields, password) => {
    const res = await createUser({ ...fields, role: 'operador' }, password)
    if (!res.ok) return res.error || 'Error al crear usuario'
    return null
  }

  const handleDeleteConfirm = async () => {
    await deleteUser(deleteTarget.id)
    setDeleteTarget(null)
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
          {/* Lista de usuarios */}
          <Table size="small" sx={{ mb: 2 }}>
            <TableHead>
              <TableRow>
                <TableCell>Usuario</TableCell>
                <TableCell>Nombre</TableCell>
                <TableCell>Cargo</TableCell>
                <TableCell>Correo</TableCell>
                <TableCell>Rol</TableCell>
                <TableCell align="right">Acciones</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {users.map(u => (
                <TableRow key={u.id} hover>
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
              ))}
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
        forceRole="operador"
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

/* ─── Gestión de PIN (todos los usuarios) ───────────────────────────────── */
function PinManagement() {
  const { currentUser, verifyAdminPassword, setUserPin, removeUserPin } = useAuth()

  // phase: 'status' | 'verifyForSet' | 'enterPin' | 'confirmPin' | 'verifyForRemove'
  const [phase, setPhase]       = React.useState('status')
  const [pwValue, setPwValue]   = React.useState('')
  const [pwError, setPwError]   = React.useState('')
  const [showPw, setShowPw]     = React.useState(false)
  const [pinFirst, setPinFirst] = React.useState('')
  const [pinSecond, setPinSecond] = React.useState('')
  const [pinError, setPinError] = React.useState('')
  const [loading, setLoading]   = React.useState(false)
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
        <Box sx={{ textAlign: 'center' }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Ingresa tu nuevo PIN de 4 dígitos
          </Typography>
          <Box sx={{
            bgcolor: '#111827', borderRadius: 2, p: 2.5,
            display: 'inline-block', color: '#fff'
          }}>
            <PinPad
              value={pinFirst}
              onChange={v => { setPinFirst(v); setPinError('') }}
              onSubmit={handleFirstPin}
              disabled={loading}
            />
          </Box>
          <Box sx={{ mt: 1 }}>
            <Button size="small" onClick={reset}>Cancelar</Button>
          </Box>
        </Box>
      )}

      {/* ── Confirmar PIN ── */}
      {phase === 'confirmPin' && (
        <Box sx={{ textAlign: 'center' }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Confirma tu PIN
          </Typography>
          <Box sx={{
            bgcolor: '#111827', borderRadius: 2, p: 2.5,
            display: 'inline-block', color: '#fff'
          }}>
            <PinPad
              value={pinSecond}
              onChange={v => { setPinSecond(v); if (pinError) setPinError('') }}
              onSubmit={handleConfirmPin}
              disabled={loading}
              error={pinError}
            />
          </Box>
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

      {/* Acceso rápido PIN — disponible para todos los usuarios */}
      <PinManagement />

      {/* Gestión de usuarios — exclusivo admin */}
      {role === 'admin' && (
        <>
          <Divider sx={{ my: 2 }} />
          <UserManagement />
        </>
      )}
    </Box>
  )
}
