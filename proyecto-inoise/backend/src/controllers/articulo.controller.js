const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// GET
exports.getArticulos = async (req, res) => {
    const articulos = await prisma.articulo.findMany({
        include: { categoria: true, estado: true }
    });
    res.json(articulos);
};

// POST
// POST
exports.createArticulo = async (req, res) => {
    try {
        const { nombre, descripcion, codigoRfid, estadoId, categoriaId } = req.body;

        // 🔴 VALIDACIÓN AQUÍ
        if (!codigoRfid) {
            return res.status(400).json({ error: 'RFID requerido' });
        }

        if (!nombre || !codigoRfid || !estadoId || !categoriaId) {
            return res.status(400).json({
                error: 'Faltan campos obligatorios'
            });
        }

        const nuevo = await prisma.articulo.create({
            data: {
                nombre,
                descripcion,
                codigoRfid,
                estadoId,
                categoriaId
            }
        });

        res.json(nuevo);

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al crear artículo' });
    }
};

// PUT
exports.updateArticulo = async (req, res) => {
    const { id } = req.params;

    const actualizado = await prisma.articulo.update({
        where: { id: Number(id) },
        data: req.body
    });

    res.json(actualizado);
};

// DELETE
exports.deleteArticulo = async (req, res) => {
    const { id } = req.params;

    await prisma.articulo.delete({
        where: { id: Number(id) }
    });

    res.json({ message: 'Artículo eliminado' });
};

//CAMBIAR ESTADO

exports.cambiarEstado = async (req, res) => {
    try {
        const { id } = req.params;
        const { estadoId } = req.body;

        const articulo = await prisma.articulo.update({
            where: { id: Number(id) },
            data: { estadoId }
        });

        res.json(articulo);

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al cambiar estado' });
    }
};