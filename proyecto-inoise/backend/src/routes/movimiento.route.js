const express = require('express');
const router = express.Router();

const { crearMovimiento } = require('../controllers/movimiento.controller');

router.post('/', crearMovimiento);

module.exports = router;