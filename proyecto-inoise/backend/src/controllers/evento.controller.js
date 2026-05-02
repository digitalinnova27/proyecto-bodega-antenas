const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// crear evento
exports.createEvento = async (req, res) => {
    try {
        const { numeroUnico, fecha, lugar, tipoEvento } = req.body;

        const evento = await prisma.evento.create({
            data: {
                numeroUnico,
                fecha: new Date(fecha),
                lugar,
                tipoEvento,
                estado: 'ACTIVO'
            }
        });

        res.json(evento);

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al crear evento' });
    }
};

exports.asignarArticulo = async (req, res) => {
    try {
        const { eventoId, articuloId, usuarioId } = req.body;

        // 1. asignar relación
        await prisma.eventoArticulo.create({
            data: { eventoId, articuloId }
        });

        // 2. registrar movimiento
        await prisma.movimiento.create({
            data: {
                tipo: 'SALIDA',
                usuarioId,
                articuloId
            }
        });

        // 3. cambiar estado automáticamente
        await prisma.articulo.update({
            where: { id: articuloId },
            data: { estadoId: 2 } // En uso
        });

        res.json({ message: 'Artículo asignado al evento' });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al asignar artículo' });
    }
};

const articulo = await prisma.articulo.findUnique({
    where: { id: articuloId }
});

if (articulo.estadoId !== 1) {
    return res.status(400).json({
        error: 'El artículo no está disponible'
    });
}