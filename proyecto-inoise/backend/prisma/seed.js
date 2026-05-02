const { PrismaClient } = require('@prisma/client');
const XLSX = require('xlsx');
const path = require('path');
const prisma = new PrismaClient();

// Mapeo de categorías del Excel al sistema
const CAT_MAP = {
  'AUDIO': 'Audio', 'ILUMINACION': 'Iluminacion', 'EFECTOS': 'Efectos',
  'ESTRUCTURA': 'Estructuras', 'ENERGÍA': 'Energía', 'TECNOLOGIA': 'Tecnologia', 'OTROS': 'Otros',
};
const CATEGORY_PRIORITY = {
  'Audio': 1, 'Iluminacion': 2, 'Pantalla': 3, 'Efectos': 4,
  'Estructuras': 5, 'Energía': 6, 'Tecnologia': 7, 'Otros': 8,
};

async function main() {
  console.log('🚀 Ejecutando seed desde Excel...');

  // Leer el Excel
  const xlsxPath = path.join(__dirname, '../1.Gestion de Inventario.xlsx');
  const wb = XLSX.readFile(xlsxPath);
  const ws = wb.Sheets['Cod_Gen'];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });

  const dataRows = rows.slice(1).filter(r => r[0] != null);

  // Crear estados base
  const estados = ['Disponible', 'Ocupado', 'En Mantenimiento', 'Reservado', 'Perdido'];
  const estadoMap = {};
  for (const nombre of estados) {
    const est = await prisma.estadoArticulo.upsert({
      where: { id: estados.indexOf(nombre) + 1 },
      update: { nombre },
      create: { nombre },
    });
    estadoMap[nombre] = est.id;
  }

  // Crear categorías únicas
  const catsExcel = [...new Set(dataRows.map(r => r[6]).filter(Boolean))];
  const catMap = {};
  let catPrio = 1;
  for (const catExcel of catsExcel) {
    const appCat = CAT_MAP[String(catExcel).toUpperCase()] || 'Otros';
    if (!catMap[appCat]) {
      const cat = await prisma.categoria.upsert({
        where: { id: catPrio },
        update: { nombre: appCat, prioridad: CATEGORY_PRIORITY[appCat] || 99 },
        create: { nombre: appCat, prioridad: CATEGORY_PRIORITY[appCat] || 99 },
      });
      catMap[appCat] = cat.id;
      catPrio++;
    }
  }

  // Insertar artículos
  let created = 0;
  for (const row of dataRows) {
    const [item, codigo, tipo, marca, modelo, serie, catExcel, cantidad] = row;
    if (!tipo) continue;
    const appCat = CAT_MAP[String(catExcel).toUpperCase()] || 'Otros';
    const qty = parseInt(cantidad) || 1;
    const sku = String(codigo || `SKU-${item}`);
    const nombre = [String(tipo).charAt(0).toUpperCase() + String(tipo).slice(1).toLowerCase(), marca, modelo]
      .filter(x => x && !['N/A', 'Sin Modelo', 'GENERICO', null].includes(x)).join(' ');

    for (let u = 1; u <= qty; u++) {
      const rfid = `${sku}-${String(u).padStart(2, '0')}`;
      try {
        await prisma.articulo.create({
          data: {
            nombre,
            descripcion: `${tipo} - ${marca || ''} ${modelo || ''}`.trim(),
            codigoRfid: rfid,
            estadoId: estadoMap['Disponible'],
            categoriaId: catMap[appCat],
          }
        });
        created++;
      } catch (e) {
        // skip duplicates
      }
    }
  }

  console.log(`✅ ${created} artículos insertados desde el Excel`);
}

main()
  .catch(e => { console.error('❌ Error en seed:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
