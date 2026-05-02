import { createTheme } from '@mui/material/styles'

const theme = createTheme({
  palette: {
    mode: 'dark',
    background: { default: '#0B0C10', paper: '#1F2833' },
    primary: { main: '#66FCF1' },
    secondary: { main: '#6600A1' },
    text: { primary: '#C5C6C7' }
  },
  components: { MuiAppBar: { defaultProps: { elevation: 0 } } }
})

export default theme
