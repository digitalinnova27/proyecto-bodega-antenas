const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

exports.crearMovimiento = async (req, res) => {
    try {
        const { tipo, usuarioId, articuloId } = req.body;

        // crear movimiento
        const movimiento = await prisma.movimiento.create({
            data: {
                tipo,
                usuarioId,
                articuloId
            }
        });

        // lógica de estado automático
        let nuevoEstado;

        if (tipo === 'SALIDA') nuevoEstado = 2; // En uso
        if (tipo === 'ENTRADA') nuevoEstado = 1; // Disponible
        if (tipo === 'MANTENCION') nuevoEstado = 3;

        if (nuevoEstado) {
            await prisma.articulo.update({
                where: { id: articuloId },
                data: { estadoId: nuevoEstado }
            });
        }

        res.json(movimiento);

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al crear movimiento' });
    }
};