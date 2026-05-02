const express = require('express');
const router = express.Router();

const { createEvento } = require('../controllers/evento.controller');
const { asignarArticulo } = require('../controllers/evento.controller');

router.post('/', createEvento);
router.post('/asignar', asignarArticulo);
module.exports = router;

