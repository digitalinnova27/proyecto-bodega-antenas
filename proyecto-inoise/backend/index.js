require('dotenv').config();
const express = require('express');
const cors = require('cors');

const articuloRoutes = require('./src/routes/articulo.routes');
const movimientoRoutes = require('./src/routes/movimiento.routes');
const eventoRoutes = require('./src/routes/evento.routes');



const app = express();

app.use(cors());
app.use(express.json());

// rutas
app.use('/articulos', articuloRoutes);

app.listen(3000, () => {
    console.log('🚀 Backend corriendo en http://localhost:3000');
});

app.get('/', (req, res) => {
    res.send('Servidor funcionando');
});

app.use('/movimientos', movimientoRoutes);
app.use('/eventos', eventoRoutes);