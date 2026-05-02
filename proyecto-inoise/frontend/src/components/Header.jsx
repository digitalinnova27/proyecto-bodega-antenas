import { AppBar, Toolbar, Typography, Box } from "@mui/material"
import { useAuth } from "../context/AuthContext"

export default function Header() {
  const { role } = useAuth()

  return (
    <AppBar position="static">
      <Toolbar>
        <Typography variant="h6" sx={{ flexGrow:1 }}>
          RFID Dashboard
        </Typography>

        <Box>
          <Typography variant="body2">
            {role === "admin" ? "Modo Administrador" : "Modo Operador"}
          </Typography>
        </Box>
      </Toolbar>
    </AppBar>
  )
}
