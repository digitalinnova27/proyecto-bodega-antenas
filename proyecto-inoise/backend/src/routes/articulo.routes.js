const express = require('express');
const router = express.Router();

const {
    getArticulos,
    createArticulo,
    updateArticulo,
    deleteArticulo,
    cambiarEstado
} = require('../controllers/articulo.controller');

router.get('/', getArticulos);
router.post('/', createArticulo);
router.put('/:id', updateArticulo);
router.delete('/:id', deleteArticulo);
router.patch('/:id/estado', cambiarEstado);

module.exports = router;