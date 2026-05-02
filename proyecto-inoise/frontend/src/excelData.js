// Datos reales importados del Excel: 1.Gestion de Inventario.xlsx
// SKUs generados por categoría: AUD-001, ILU-001, EST-001, etc.

export const categories = ['Audio', 'Iluminacion', 'Pantalla', 'Efectos', 'Estructuras', 'Energía', 'Tecnologia', 'Otros']

export const INITIAL_PRODUCTS = [
  {
    id: 1, name: 'Atriles Microfonos HERCULES MS533B', sku: 'AUD-001', rfidBase: 'AUD-001',
    category: 'Audio', total: 2, description: 'ATRILES MICROFONOS - HERCULES MS533B',
    units: Array.from({ length: 2 }, (_, i) => ({ id: `1-${i + 1}`, rfid: `AUD-001-${String(i + 1).padStart(2, '0')}`, state: 'Disponible' }))
  },
  {
    id: 2, name: 'Atriles Parlantes HERCULES SS200BB', sku: 'AUD-002', rfidBase: 'AUD-002',
    category: 'Audio', total: 8, description: 'ATRILES PARLANTES - HERCULES SS200BB',
    units: Array.from({ length: 8 }, (_, i) => ({ id: `2-${i + 1}`, rfid: `AUD-002-${String(i + 1).padStart(2, '0')}`, state: 'Disponible' }))
  },
  {
    id: 3, name: 'Atriles Microfonos K&M 25400', sku: 'AUD-003', rfidBase: 'AUD-003',
    category: 'Audio', total: 10, description: 'ATRILES MICROFONOS - K&M 25400',
    units: Array.from({ length: 10 }, (_, i) => ({ id: `3-${i + 1}`, rfid: `AUD-003-${String(i + 1).padStart(2, '0')}`, state: 'Disponible' }))
  },
  {
    id: 4, name: 'Bases Truss GALAXY TIPO CUADRADA', sku: 'EST-001', rfidBase: 'EST-001',
    category: 'Estructuras', total: 2, description: 'BASES TRUSS - GALAXY TIPO CUADRADA',
    units: Array.from({ length: 2 }, (_, i) => ({ id: `4-${i + 1}`, rfid: `EST-001-${String(i + 1).padStart(2, '0')}`, state: 'Disponible' }))
  },
  {
    id: 5, name: 'Barra T', sku: 'EST-002', rfidBase: 'EST-002',
    category: 'Estructuras', total: 6, description: 'BARRA T - GENERICO N/A',
    units: Array.from({ length: 6 }, (_, i) => ({ id: `5-${i + 1}`, rfid: `EST-002-${String(i + 1).padStart(2, '0')}`, state: 'Disponible' }))
  },
  {
    id: 6, name: 'Bases Truss', sku: 'EST-003', rfidBase: 'EST-003',
    category: 'Estructuras', total: 4, description: 'BASES TRUSS - GENERICO N/A',
    units: Array.from({ length: 4 }, (_, i) => ({ id: `6-${i + 1}`, rfid: `EST-003-${String(i + 1).padStart(2, '0')}`, state: 'Disponible' }))
  },
  {
    id: 7, name: 'Barra Strobe SANYI LIGHT 720', sku: 'ILU-001', rfidBase: 'ILU-001',
    category: 'Iluminacion', total: 8, description: 'BARRA STROBE - SANYI LIGHT 720',
    units: Array.from({ length: 8 }, (_, i) => ({ id: `7-${i + 1}`, rfid: `ILU-001-${String(i + 1).padStart(2, '0')}`, state: 'Disponible' }))
  },
  {
    id: 8, name: 'Barras Pin TECHSHOW 6X5W', sku: 'ILU-002', rfidBase: 'ILU-002',
    category: 'Iluminacion', total: 4, description: 'BARRAS PIN - TECHSHOW 6X5W',
    units: Array.from({ length: 4 }, (_, i) => ({ id: `8-${i + 1}`, rfid: `ILU-002-${String(i + 1).padStart(2, '0')}`, state: 'Disponible' }))
  },
  {
    id: 9, name: 'Barras Pin KEMAX 6X20W', sku: 'ILU-003', rfidBase: 'ILU-003',
    category: 'Iluminacion', total: 4, description: 'BARRAS PIN - KEMAX 6X20W',
    units: Array.from({ length: 4 }, (_, i) => ({ id: `9-${i + 1}`, rfid: `ILU-003-${String(i + 1).padStart(2, '0')}`, state: 'Disponible' }))
  },
  {
    id: 10, name: 'Biombo', sku: 'EST-004', rfidBase: 'EST-004',
    category: 'Estructuras', total: 6, description: 'BIOMBO - GENERICO N/A',
    units: Array.from({ length: 6 }, (_, i) => ({ id: `10-${i + 1}`, rfid: `EST-004-${String(i + 1).padStart(2, '0')}`, state: 'Disponible' }))
  },
  {
    id: 11, name: 'Bola Disco 16" WILDPRO WILDPRO', sku: 'EFE-001', rfidBase: 'EFE-001',
    category: 'Efectos', total: 20, description: 'BOLA DISCO 16" - WILDPRO WILDPRO',
    units: Array.from({ length: 20 }, (_, i) => ({ id: `11-${i + 1}`, rfid: `EFE-001-${String(i + 1).padStart(2, '0')}`, state: 'Disponible' }))
  },
  {
    id: 12, name: 'Bola Disco 21" WILDPRO WILDPRO', sku: 'EFE-002', rfidBase: 'EFE-002',
    category: 'Efectos', total: 1, description: 'BOLA DISCO 21" - WILDPRO WILDPRO',
    units: Array.from({ length: 1 }, (_, i) => ({ id: `12-${i + 1}`, rfid: `EFE-002-${String(i + 1).padStart(2, '0')}`, state: 'Disponible' }))
  },
  {
    id: 13, name: 'Cabeza Movil Beam AOLAIT 7R', sku: 'ILU-004', rfidBase: 'ILU-004',
    category: 'Iluminacion', total: 8, description: 'CABEZA MOVIL BEAM - AOLAIT 7R',
    units: Array.from({ length: 8 }, (_, i) => ({ id: `13-${i + 1}`, rfid: `ILU-004-${String(i + 1).padStart(2, '0')}`, state: 'Disponible' }))
  },
  {
    id: 14, name: 'Cabeza Movil Beam MOWL 9R', sku: 'ILU-005', rfidBase: 'ILU-005',
    category: 'Iluminacion', total: 10, description: 'CABEZA MOVIL BEAM - MOWL 9R',
    units: Array.from({ length: 10 }, (_, i) => ({ id: `14-${i + 1}`, rfid: `ILU-005-${String(i + 1).padStart(2, '0')}`, state: 'Disponible' }))
  },
  {
    id: 15, name: 'Seven Eyes Backlight MOWL ML-BWJ01', sku: 'ILU-006', rfidBase: 'ILU-006',
    category: 'Iluminacion', total: 2, description: 'SEVEN EYES BACKLIGHT - MOWL ML-BWJ01',
    units: Array.from({ length: 2 }, (_, i) => ({ id: `15-${i + 1}`, rfid: `ILU-006-${String(i + 1).padStart(2, '0')}`, state: 'Disponible' }))
  },
  {
    id: 16, name: 'Six Eyes Backlight MOWL ML-XGD03', sku: 'ILU-007', rfidBase: 'ILU-007',
    category: 'Iluminacion', total: 2, description: 'SIX EYES BACKLIGHT - MOWL ML-XGD03',
    units: Array.from({ length: 2 }, (_, i) => ({ id: `16-${i + 1}`, rfid: `ILU-007-${String(i + 1).padStart(2, '0')}`, state: 'Disponible' }))
  },
  {
    id: 17, name: 'Caja Cables Audio BAUKER', sku: 'AUD-004', rfidBase: 'AUD-004',
    category: 'Audio', total: 1, description: 'CAJA CABLES AUDIO - BAUKER Sin Modelo',
    units: Array.from({ length: 1 }, (_, i) => ({ id: `17-${i + 1}`, rfid: `AUD-004-${String(i + 1).padStart(2, '0')}`, state: 'Disponible' }))
  },
  {
    id: 18, name: 'Caja Cintas BAUKER BAUKER', sku: 'OTR-001', rfidBase: 'OTR-001',
    category: 'Otros', total: 1, description: 'CAJA CINTAS - BAUKER BAUKER',
    units: Array.from({ length: 1 }, (_, i) => ({ id: `18-${i + 1}`, rfid: `OTR-001-${String(i + 1).padStart(2, '0')}`, state: 'Disponible' }))
  },
  {
    id: 19, name: 'Caja Clamp BAUKER BAUKER', sku: 'EST-005', rfidBase: 'EST-005',
    category: 'Estructuras', total: 1, description: 'CAJA CLAMP - BAUKER BAUKER',
    units: Array.from({ length: 1 }, (_, i) => ({ id: `19-${i + 1}`, rfid: `EST-005-${String(i + 1).padStart(2, '0')}`, state: 'Disponible' }))
  },
  {
    id: 20, name: 'Caja Conectores Audio BAUKER BAUKER', sku: 'AUD-005', rfidBase: 'AUD-005',
    category: 'Audio', total: 1, description: 'CAJA CONECTORES AUDIO - BAUKER BAUKER',
    units: Array.from({ length: 1 }, (_, i) => ({ id: `20-${i + 1}`, rfid: `AUD-005-${String(i + 1).padStart(2, '0')}`, state: 'Disponible' }))
  },
  {
    id: 21, name: 'Caja Conectores Electricos ELECTRICO', sku: 'ENE-001', rfidBase: 'ENE-001',
    category: 'Energía', total: 1, description: 'CAJA CONECTORES ELECTRICOS - ELECTRICO Sin Modelo',
    units: Array.from({ length: 1 }, (_, i) => ({ id: `21-${i + 1}`, rfid: `ENE-001-${String(i + 1).padStart(2, '0')}`, state: 'Disponible' }))
  },
  {
    id: 22, name: 'Caja Fundas Biombo WENCO WENCO', sku: 'EST-006', rfidBase: 'EST-006',
    category: 'Estructuras', total: 1, description: 'CAJA FUNDAS BIOMBO - WENCO WENCO',
    units: Array.from({ length: 1 }, (_, i) => ({ id: `22-${i + 1}`, rfid: `EST-006-${String(i + 1).padStart(2, '0')}`, state: 'Disponible' }))
  },
  {
    id: 23, name: 'Caja Fundas Truss WENCO WENCO', sku: 'EST-007', rfidBase: 'EST-007',
    category: 'Estructuras', total: 1, description: 'CAJA FUNDAS TRUSS - WENCO WENCO',
    units: Array.from({ length: 1 }, (_, i) => ({ id: `23-${i + 1}`, rfid: `EST-007-${String(i + 1).padStart(2, '0')}`, state: 'Disponible' }))
  },
  {
    id: 24, name: 'Caja Guirnaldas Hadas HADAS', sku: 'ILU-008', rfidBase: 'ILU-008',
    category: 'Iluminacion', total: 1, description: 'CAJA GUIRNALDAS HADAS - HADAS Sin Modelo',
    units: Array.from({ length: 1 }, (_, i) => ({ id: `24-${i + 1}`, rfid: `ILU-008-${String(i + 1).padStart(2, '0')}`, state: 'Disponible' }))
  },
  {
    id: 25, name: 'Caja Guirnaldas Toscanas', sku: 'ILU-009', rfidBase: 'ILU-009',
    category: 'Iluminacion', total: 1, description: 'CAJA GUIRNALDAS TOSCANAS - GENERICO N/A',
    units: Array.from({ length: 1 }, (_, i) => ({ id: `25-${i + 1}`, rfid: `ILU-009-${String(i + 1).padStart(2, '0')}`, state: 'Disponible' }))
  },
  {
    id: 26, name: 'Caja Interlock PELICAN PELICAN', sku: 'ENE-002', rfidBase: 'ENE-002',
    category: 'Energía', total: 1, description: 'CAJA INTERLOCK - PELICAN PELICAN',
    units: Array.from({ length: 1 }, (_, i) => ({ id: `26-${i + 1}`, rfid: `ENE-002-${String(i + 1).padStart(2, '0')}`, state: 'Disponible' }))
  },
  {
    id: 27, name: 'Caja Motor Bola Disco ROBUST MJ-5003 B', sku: 'EFE-003', rfidBase: 'EFE-003',
    category: 'Efectos', total: 20, description: 'CAJA MOTOR BOLA DISCO - ROBUST MJ-5003 B',
    units: Array.from({ length: 20 }, (_, i) => ({ id: `27-${i + 1}`, rfid: `EFE-003-${String(i + 1).padStart(2, '0')}`, state: 'Disponible' }))
  },
  {
    id: 28, name: 'Caja Pivotes PIVOTES SILVER EAGLE', sku: 'EST-008', rfidBase: 'EST-008',
    category: 'Estructuras', total: 1, description: 'CAJA PIVOTES - PIVOTES SILVER EAGLE',
    units: Array.from({ length: 1 }, (_, i) => ({ id: `28-${i + 1}`, rfid: `EST-008-${String(i + 1).padStart(2, '0')}`, state: 'Disponible' }))
  },
  {
    id: 29, name: 'Caja Seguridad WENCO WENCO', sku: 'OTR-002', rfidBase: 'OTR-002',
    category: 'Otros', total: 1, description: 'CAJA SEGURIDAD - WENCO WENCO',
    units: Array.from({ length: 1 }, (_, i) => ({ id: `29-${i + 1}`, rfid: `OTR-002-${String(i + 1).padStart(2, '0')}`, state: 'Disponible' }))
  },
  {
    id: 30, name: 'Caja Xlr Cortos PELICAN PELICAN', sku: 'ILU-010', rfidBase: 'ILU-010',
    category: 'Iluminacion', total: 1, description: 'CAJA XLR CORTOS - PELICAN PELICAN',
    units: Array.from({ length: 1 }, (_, i) => ({ id: `30-${i + 1}`, rfid: `ILU-010-${String(i + 1).padStart(2, '0')}`, state: 'Disponible' }))
  },
  {
    id: 31, name: 'Caja Zapatillas WENCO WENCO', sku: 'ENE-003', rfidBase: 'ENE-003',
    category: 'Energía', total: 1, description: 'CAJA ZAPATILLAS - WENCO WENCO',
    units: Array.from({ length: 1 }, (_, i) => ({ id: `31-${i + 1}`, rfid: `ENE-003-${String(i + 1).padStart(2, '0')}`, state: 'Disponible' }))
  },
  {
    id: 32, name: 'Caja Mtouch+Notebook PELICAN PELICAN', sku: 'ILU-011', rfidBase: 'ILU-011',
    category: 'Iluminacion', total: 1, description: 'CAJA MTOUCH+NOTEBOOK - PELICAN PELICAN',
    units: Array.from({ length: 1 }, (_, i) => ({ id: `32-${i + 1}`, rfid: `ILU-011-${String(i + 1).padStart(2, '0')}`, state: 'Disponible' }))
  },
  {
    id: 33, name: 'Mtouch MARTIN MTOUCH', sku: 'ILU-012', rfidBase: 'ILU-012',
    category: 'Iluminacion', total: 1, description: 'MTOUCH - MARTIN MTOUCH',
    units: Array.from({ length: 1 }, (_, i) => ({ id: `33-${i + 1}`, rfid: `ILU-012-${String(i + 1).padStart(2, '0')}`, state: 'Disponible' }))
  },
  {
    id: 34, name: 'Cabeza Movil Wash MARTIN MAC AURA XB', sku: 'ILU-013', rfidBase: 'ILU-013',
    category: 'Iluminacion', total: 4, description: 'CABEZA MOVIL WASH - MARTIN MAC AURA XB',
    units: Array.from({ length: 4 }, (_, i) => ({ id: `34-${i + 1}`, rfid: `ILU-013-${String(i + 1).padStart(2, '0')}`, state: 'Disponible' }))
  },
  {
    id: 35, name: 'Caja Bordes Pista De Baile ROBUST MJ-5003 B', sku: 'EST-009', rfidBase: 'EST-009',
    category: 'Estructuras', total: 1, description: 'CAJA BORDES PISTA DE BAILE - ROBUST MJ-5003 B',
    units: Array.from({ length: 1 }, (_, i) => ({ id: `35-${i + 1}`, rfid: `EST-009-${String(i + 1).padStart(2, '0')}`, state: 'Disponible' }))
  },
  {
    id: 36, name: 'Caja Xlr Largos ROBUST ROBUST', sku: 'ILU-014', rfidBase: 'ILU-014',
    category: 'Iluminacion', total: 2, description: 'CAJA XLR LARGOS - ROBUST ROBUST',
    units: Array.from({ length: 2 }, (_, i) => ({ id: `36-${i + 1}`, rfid: `ILU-014-${String(i + 1).padStart(2, '0')}`, state: 'Disponible' }))
  },
  {
    id: 37, name: 'Cabeza Movil Spot SANYI LIGHT 90W', sku: 'ILU-015', rfidBase: 'ILU-015',
    category: 'Iluminacion', total: 6, description: 'CABEZA MOVIL SPOT - SANYI LIGHT 90W',
    units: Array.from({ length: 6 }, (_, i) => ({ id: `37-${i + 1}`, rfid: `ILU-015-${String(i + 1).padStart(2, '0')}`, state: 'Disponible' }))
  },
  {
    id: 38, name: 'Caja Consola Dmx DMX', sku: 'ILU-016', rfidBase: 'ILU-016',
    category: 'Iluminacion', total: 1, description: 'CAJA CONSOLA DMX - DMX Sin Modelo',
    units: Array.from({ length: 1 }, (_, i) => ({ id: `38-${i + 1}`, rfid: `ILU-016-${String(i + 1).padStart(2, '0')}`, state: 'Disponible' }))
  },
  {
    id: 39, name: 'Consola Dmx LA GAMME CLUB - 12J', sku: 'ILU-017', rfidBase: 'ILU-017',
    category: 'Iluminacion', total: 1, description: 'CONSOLA DMX - LA GAMME CLUB - 12J',
    units: Array.from({ length: 1 }, (_, i) => ({ id: `39-${i + 1}`, rfid: `ILU-017-${String(i + 1).padStart(2, '0')}`, state: 'Disponible' }))
  },
  {
    id: 40, name: 'Cercha 2 Mts GALAXY 2MM', sku: 'EST-010', rfidBase: 'EST-010',
    category: 'Estructuras', total: 2, description: 'CERCHA 2 MTS - GALAXY 2MM',
    units: Array.from({ length: 2 }, (_, i) => ({ id: `40-${i + 1}`, rfid: `EST-010-${String(i + 1).padStart(2, '0')}`, state: 'Disponible' }))
  },
  {
    id: 41, name: 'Chispas Frias LIGHTSOLUTION 600W', sku: 'EFE-004', rfidBase: 'EFE-004',
    category: 'Efectos', total: 2, description: 'CHISPAS FRIAS - LIGHTSOLUTION 600W',
    units: Array.from({ length: 2 }, (_, i) => ({ id: `41-${i + 1}`, rfid: `EFE-004-${String(i + 1).padStart(2, '0')}`, state: 'Disponible' }))
  },
  {
    id: 42, name: 'Chispas Frias MOWL 750W', sku: 'EFE-005', rfidBase: 'EFE-005',
    category: 'Efectos', total: 2, description: 'CHISPAS FRIAS - MOWL 750W',
    units: Array.from({ length: 2 }, (_, i) => ({ id: `42-${i + 1}`, rfid: `EFE-005-${String(i + 1).padStart(2, '0')}`, state: 'Disponible' }))
  },
  {
    id: 43, name: 'Co2 MOWL ML-CO2-QZ03', sku: 'EFE-006', rfidBase: 'EFE-006',
    category: 'Efectos', total: 2, description: 'CO2 - MOWL ML-CO2-QZ03',
    units: Array.from({ length: 2 }, (_, i) => ({ id: `43-${i + 1}`, rfid: `EFE-006-${String(i + 1).padStart(2, '0')}`, state: 'Disponible' }))
  },
  {
    id: 44, name: 'Cortina Led AOLAIT 3X2M (4U)', sku: 'EFE-007', rfidBase: 'EFE-007',
    category: 'Efectos', total: 1, description: 'CORTINA LED - AOLAIT 3X2M (4U)',
    units: Array.from({ length: 1 }, (_, i) => ({ id: `44-${i + 1}`, rfid: `EFE-007-${String(i + 1).padStart(2, '0')}`, state: 'Disponible' }))
  },
  {
    id: 45, name: 'Computador  ASUS', sku: 'TEC-001', rfidBase: 'TEC-001',
    category: 'Tecnologia', total: 1, description: 'COMPUTADOR  - ASUS Sin Modelo',
    units: Array.from({ length: 1 }, (_, i) => ({ id: `45-${i + 1}`, rfid: `TEC-001-${String(i + 1).padStart(2, '0')}`, state: 'Disponible' }))
  },
  {
    id: 46, name: 'Cob Led BIGDIPPER BD-LC001H', sku: 'ILU-018', rfidBase: 'ILU-018',
    category: 'Iluminacion', total: 16, description: 'COB LED - BIGDIPPER BD-LC001H',
    units: Array.from({ length: 16 }, (_, i) => ({ id: `46-${i + 1}`, rfid: `ILU-018-${String(i + 1).padStart(2, '0')}`, state: 'Disponible' }))
  },
  {
    id: 47, name: 'Computador  HP X360 PAVILLION', sku: 'TEC-002', rfidBase: 'TEC-002',
    category: 'Tecnologia', total: 1, description: 'COMPUTADOR  - HP X360 PAVILLION',
    units: Array.from({ length: 1 }, (_, i) => ({ id: `47-${i + 1}`, rfid: `TEC-002-${String(i + 1).padStart(2, '0')}`, state: 'Disponible' }))
  },
  {
    id: 48, name: 'Confetti SV PRO EFXT-FX03', sku: 'EFE-008', rfidBase: 'EFE-008',
    category: 'Efectos', total: 2, description: 'CONFETTI - SV PRO EFXT-FX03',
    units: Array.from({ length: 2 }, (_, i) => ({ id: `48-${i + 1}`, rfid: `EFE-008-${String(i + 1).padStart(2, '0')}`, state: 'Disponible' }))
  },
  {
    id: 49, name: 'Escala Mediana HALO 9309-507', sku: 'EST-011', rfidBase: 'EST-011',
    category: 'Estructuras', total: 1, description: 'ESCALA MEDIANA - HALO 9309-507',
    units: Array.from({ length: 1 }, (_, i) => ({ id: `49-${i + 1}`, rfid: `EST-011-${String(i + 1).padStart(2, '0')}`, state: 'Disponible' }))
  },
  {
    id: 50, name: 'Escala Retractil SODIMAC', sku: 'EST-012', rfidBase: 'EST-012',
    category: 'Estructuras', total: 1, description: 'ESCALA RETRACTIL - SODIMAC Sin Modelo',
    units: Array.from({ length: 1 }, (_, i) => ({ id: `50-${i + 1}`, rfid: `EST-012-${String(i + 1).padStart(2, '0')}`, state: 'Disponible' }))
  },
  {
    id: 51, name: 'Extensiones Mono 10 MTS', sku: 'ENE-004', rfidBase: 'ENE-004',
    category: 'Energía', total: 10, description: 'EXTENSIONES MONO - GENERICO 10 MTS',
    units: Array.from({ length: 10 }, (_, i) => ({ id: `51-${i + 1}`, rfid: `ENE-004-${String(i + 1).padStart(2, '0')}`, state: 'Disponible' }))
  },
  {
    id: 52, name: 'Fierro Bola Disco', sku: 'EST-013', rfidBase: 'EST-013',
    category: 'Estructuras', total: 4, description: 'FIERRO BOLA DISCO - GENERICO N/A',
    units: Array.from({ length: 4 }, (_, i) => ({ id: `52-${i + 1}`, rfid: `EST-013-${String(i + 1).padStart(2, '0')}`, state: 'Disponible' }))
  },
  {
    id: 53, name: 'Escala Grande HALO 9312-507', sku: 'EST-014', rfidBase: 'EST-014',
    category: 'Estructuras', total: 1, description: 'ESCALA GRANDE - HALO 9312-507',
    units: Array.from({ length: 1 }, (_, i) => ({ id: `53-${i + 1}`, rfid: `EST-014-${String(i + 1).padStart(2, '0')}`, state: 'Disponible' }))
  },
  {
    id: 54, name: 'Impresora Cabina HITI PL525', sku: 'TEC-003', rfidBase: 'TEC-003',
    category: 'Tecnologia', total: 1, description: 'IMPRESORA CABINA - HITI PL525',
    units: Array.from({ length: 1 }, (_, i) => ({ id: `54-${i + 1}`, rfid: `TEC-003-${String(i + 1).padStart(2, '0')}`, state: 'Disponible' }))
  },
  {
    id: 55, name: 'Malacates GALAXY 100 KG', sku: 'EST-015', rfidBase: 'EST-015',
    category: 'Estructuras', total: 4, description: 'MALACATES - GALAXY 100 KG',
    units: Array.from({ length: 4 }, (_, i) => ({ id: `55-${i + 1}`, rfid: `EST-015-${String(i + 1).padStart(2, '0')}`, state: 'Disponible' }))
  },
  {
    id: 56, name: 'Maquina Hazer PURPLE HF-900', sku: 'EFE-009', rfidBase: 'EFE-009',
    category: 'Efectos', total: 1, description: 'MAQUINA HAZER - PURPLE HF-900',
    units: Array.from({ length: 1 }, (_, i) => ({ id: `56-${i + 1}`, rfid: `EFE-009-${String(i + 1).padStart(2, '0')}`, state: 'Disponible' }))
  },
  {
    id: 57, name: 'Maquina Hazer MOWL 1500', sku: 'EFE-010', rfidBase: 'EFE-010',
    category: 'Efectos', total: 1, description: 'MAQUINA HAZER - MOWL 1500',
    units: Array.from({ length: 1 }, (_, i) => ({ id: `57-${i + 1}`, rfid: `EFE-010-${String(i + 1).padStart(2, '0')}`, state: 'Disponible' }))
  },
  {
    id: 58, name: 'Mesa Sonido K-ACOUSTIC K68', sku: 'AUD-006', rfidBase: 'AUD-006',
    category: 'Audio', total: 1, description: 'MESA SONIDO - K-ACOUSTIC K68',
    units: Array.from({ length: 1 }, (_, i) => ({ id: `58-${i + 1}`, rfid: `AUD-006-${String(i + 1).padStart(2, '0')}`, state: 'Disponible' }))
  },
  {
    id: 59, name: 'Mesa Sonido SOUNDCRAFT EPM6', sku: 'AUD-007', rfidBase: 'AUD-007',
    category: 'Audio', total: 2, description: 'MESA SONIDO - SOUNDCRAFT EPM6',
    units: Array.from({ length: 2 }, (_, i) => ({ id: `59-${i + 1}`, rfid: `AUD-007-${String(i + 1).padStart(2, '0')}`, state: 'Disponible' }))
  },
  {
    id: 60, name: 'Mesa Sonido SOUNDCRAFT SIGNATURE 10', sku: 'AUD-008', rfidBase: 'AUD-008',
    category: 'Audio', total: 1, description: 'MESA SONIDO - SOUNDCRAFT SIGNATURE 10',
    units: Array.from({ length: 1 }, (_, i) => ({ id: `60-${i + 1}`, rfid: `AUD-008-${String(i + 1).padStart(2, '0')}`, state: 'Disponible' }))
  },
  {
    id: 61, name: 'Mesa Sonido SOUNDCRAFT UI24R', sku: 'AUD-009', rfidBase: 'AUD-009',
    category: 'Audio', total: 1, description: 'MESA SONIDO - SOUNDCRAFT UI24R',
    units: Array.from({ length: 1 }, (_, i) => ({ id: `61-${i + 1}`, rfid: `AUD-009-${String(i + 1).padStart(2, '0')}`, state: 'Disponible' }))
  },
  {
    id: 62, name: 'Microfono BEHRINGER', sku: 'AUD-010', rfidBase: 'AUD-010',
    category: 'Audio', total: 2, description: 'MICROFONO - BEHRINGER Sin Modelo',
    units: Array.from({ length: 2 }, (_, i) => ({ id: `62-${i + 1}`, rfid: `AUD-010-${String(i + 1).padStart(2, '0')}`, state: 'Disponible' }))
  },
  {
    id: 63, name: 'Microfono Inalambrico NADY HT-1KU-TX-HT-NEUS', sku: 'AUD-011', rfidBase: 'AUD-011',
    category: 'Audio', total: 1, description: 'MICROFONO INALAMBRICO - NADY HT-1KU-TX-HT-NEUS',
    units: Array.from({ length: 1 }, (_, i) => ({ id: `63-${i + 1}`, rfid: `AUD-011-${String(i + 1).padStart(2, '0')}`, state: 'Disponible' }))
  },
  {
    id: 64, name: 'Microfono SHURE SM58', sku: 'AUD-012', rfidBase: 'AUD-012',
    category: 'Audio', total: 1, description: 'MICROFONO - SHURE SM58',
    units: Array.from({ length: 1 }, (_, i) => ({ id: `64-${i + 1}`, rfid: `AUD-012-${String(i + 1).padStart(2, '0')}`, state: 'Disponible' }))
  },
  {
    id: 65, name: 'Inalambrico Microfono SHURE SM58', sku: 'AUD-013', rfidBase: 'AUD-013',
    category: 'Audio', total: 1, description: 'INALAMBRICO MICROFONO - SHURE SM58',
    units: Array.from({ length: 1 }, (_, i) => ({ id: `65-${i + 1}`, rfid: `AUD-013-${String(i + 1).padStart(2, '0')}`, state: 'Disponible' }))
  },
  {
    id: 66, name: 'Microfono SKP UHF600', sku: 'AUD-014', rfidBase: 'AUD-014',
    category: 'Audio', total: 2, description: 'MICROFONO - SKP UHF600',
    units: Array.from({ length: 2 }, (_, i) => ({ id: `66-${i + 1}`, rfid: `AUD-014-${String(i + 1).padStart(2, '0')}`, state: 'Disponible' }))
  },
  {
    id: 67, name: 'Pasacable 4 Lineas 4LINEAS', sku: 'ENE-005', rfidBase: 'ENE-005',
    category: 'Energía', total: 2, description: 'PASACABLE 4 LINEAS - 4LINEAS N/A',
    units: Array.from({ length: 2 }, (_, i) => ({ id: `67-${i + 1}`, rfid: `ENE-005-${String(i + 1).padStart(2, '0')}`, state: 'Disponible' }))
  },
  {
    id: 68, name: 'Par Led AOLAIT 7x12W', sku: 'ILU-019', rfidBase: 'ILU-019',
    category: 'Iluminacion', total: 24, description: 'PAR LED - AOLAIT 7x12W',
    units: Array.from({ length: 24 }, (_, i) => ({ id: `68-${i + 1}`, rfid: `ILU-019-${String(i + 1).padStart(2, '0')}`, state: 'Disponible' }))
  },
  {
    id: 69, name: 'Par Led BIGDIPPER 4X50W', sku: 'ILU-020', rfidBase: 'ILU-020',
    category: 'Iluminacion', total: 8, description: 'PAR LED - BIGDIPPER 4X50W',
    units: Array.from({ length: 8 }, (_, i) => ({ id: `69-${i + 1}`, rfid: `ILU-020-${String(i + 1).padStart(2, '0')}`, state: 'Disponible' }))
  },
  {
    id: 70, name: 'Pasacable 2 Lineas', sku: 'ENE-006', rfidBase: 'ENE-006',
    category: 'Energía', total: 4, description: 'PASACABLE 2 LINEAS - GENERICO N/A',
    units: Array.from({ length: 4 }, (_, i) => ({ id: `70-${i + 1}`, rfid: `ENE-006-${String(i + 1).padStart(2, '0')}`, state: 'Disponible' }))
  },
  {
    id: 71, name: 'Parlante QSC K12.2', sku: 'AUD-015', rfidBase: 'AUD-015',
    category: 'Audio', total: 6, description: 'PARLANTE - QSC K12.2',
    units: Array.from({ length: 6 }, (_, i) => ({ id: `71-${i + 1}`, rfid: `AUD-015-${String(i + 1).padStart(2, '0')}`, state: 'Disponible' }))
  },
  {
    id: 72, name: 'Parlante QSC K10', sku: 'AUD-016', rfidBase: 'AUD-016',
    category: 'Audio', total: 1, description: 'PARLANTE - QSC K10',
    units: Array.from({ length: 1 }, (_, i) => ({ id: `72-${i + 1}`, rfid: `AUD-016-${String(i + 1).padStart(2, '0')}`, state: 'Disponible' }))
  },
  {
    id: 73, name: 'Paletas Strobe  SANYI LIGHT S960ii', sku: 'ILU-021', rfidBase: 'ILU-021',
    category: 'Iluminacion', total: 4, description: 'PALETAS STROBE  - SANYI LIGHT S960ii',
    units: Array.from({ length: 4 }, (_, i) => ({ id: `73-${i + 1}`, rfid: `ILU-021-${String(i + 1).padStart(2, '0')}`, state: 'Disponible' }))
  },
  {
    id: 74, name: 'Perfil Rectangular 3 Mts', sku: 'EST-016', rfidBase: 'EST-016',
    category: 'Estructuras', total: 7, description: 'PERFIL RECTANGULAR 3 MTS - GENERICO N/A',
    units: Array.from({ length: 7 }, (_, i) => ({ id: `74-${i + 1}`, rfid: `EST-016-${String(i + 1).padStart(2, '0')}`, state: 'Disponible' }))
  },
  {
    id: 75, name: 'Pista De Baile B&W QINGDAO 100MTS2', sku: 'EST-017', rfidBase: 'EST-017',
    category: 'Estructuras', total: 1, description: 'PISTA DE BAILE B&W - QINGDAO 100MTS2',
    units: Array.from({ length: 1 }, (_, i) => ({ id: `75-${i + 1}`, rfid: `EST-017-${String(i + 1).padStart(2, '0')}`, state: 'Disponible' }))
  },
  {
    id: 76, name: 'Regulador De Voltaje', sku: 'ENE-007', rfidBase: 'ENE-007',
    category: 'Energía', total: 5, description: 'REGULADOR DE VOLTAJE - GENERICO N/A',
    units: Array.from({ length: 5 }, (_, i) => ({ id: `76-${i + 1}`, rfid: `ENE-007-${String(i + 1).padStart(2, '0')}`, state: 'Disponible' }))
  },
  {
    id: 77, name: 'Sub Bajo AUDIOLAB ALA218', sku: 'AUD-017', rfidBase: 'AUD-017',
    category: 'Audio', total: 1, description: 'SUB BAJO - AUDIOLAB ALA218',
    units: Array.from({ length: 1 }, (_, i) => ({ id: `77-${i + 1}`, rfid: `AUD-017-${String(i + 1).padStart(2, '0')}`, state: 'Disponible' }))
  },
  {
    id: 78, name: 'Tarima', sku: 'EST-018', rfidBase: 'EST-018',
    category: 'Estructuras', total: 1, description: 'TARIMA - GENERICO N/A',
    units: Array.from({ length: 1 }, (_, i) => ({ id: `78-${i + 1}`, rfid: `EST-018-${String(i + 1).padStart(2, '0')}`, state: 'Disponible' }))
  },
  {
    id: 79, name: 'Tablero Trifasico LEXO 32A', sku: 'ENE-008', rfidBase: 'ENE-008',
    category: 'Energía', total: 2, description: 'TABLERO TRIFASICO - LEXO 32A',
    units: Array.from({ length: 2 }, (_, i) => ({ id: `79-${i + 1}`, rfid: `ENE-008-${String(i + 1).padStart(2, '0')}`, state: 'Disponible' }))
  },
  {
    id: 80, name: 'Tablero Trifasico 32A', sku: 'ENE-009', rfidBase: 'ENE-009',
    category: 'Energía', total: 1, description: 'TABLERO TRIFASICO - GENERICO 32A',
    units: Array.from({ length: 1 }, (_, i) => ({ id: `80-${i + 1}`, rfid: `ENE-009-${String(i + 1).padStart(2, '0')}`, state: 'Disponible' }))
  },
  {
    id: 81, name: 'Torre FENIX MEGARA 300', sku: 'EST-019', rfidBase: 'EST-019',
    category: 'Estructuras', total: 2, description: 'TORRE - FENIX MEGARA 300',
    units: Array.from({ length: 2 }, (_, i) => ({ id: `81-${i + 1}`, rfid: `EST-019-${String(i + 1).padStart(2, '0')}`, state: 'Disponible' }))
  },
  {
    id: 82, name: 'Totem Fotografico', sku: 'EFE-011', rfidBase: 'EFE-011',
    category: 'Efectos', total: 1, description: 'TOTEM FOTOGRAFICO - GENERICO N/A',
    units: Array.from({ length: 1 }, (_, i) => ({ id: `82-${i + 1}`, rfid: `EFE-011-${String(i + 1).padStart(2, '0')}`, state: 'Disponible' }))
  },
  {
    id: 83, name: 'Truss 1 Mt GALAXY 1MT-3MM', sku: 'EST-020', rfidBase: 'EST-020',
    category: 'Estructuras', total: 2, description: 'TRUSS 1 MT - GALAXY 1MT-3MM',
    units: Array.from({ length: 2 }, (_, i) => ({ id: `83-${i + 1}`, rfid: `EST-020-${String(i + 1).padStart(2, '0')}`, state: 'Disponible' }))
  },
  {
    id: 84, name: 'Truss 2 Mts GALAXY 2MT-3MM', sku: 'EST-021', rfidBase: 'EST-021',
    category: 'Estructuras', total: 2, description: 'TRUSS 2 MTS - GALAXY 2MT-3MM',
    units: Array.from({ length: 2 }, (_, i) => ({ id: `84-${i + 1}`, rfid: `EST-021-${String(i + 1).padStart(2, '0')}`, state: 'Disponible' }))
  },
  {
    id: 85, name: 'Truss 3 Mts GALAXY 3MT-3MM', sku: 'EST-022', rfidBase: 'EST-022',
    category: 'Estructuras', total: 10, description: 'TRUSS 3 MTS - GALAXY 3MT-3MM',
    units: Array.from({ length: 10 }, (_, i) => ({ id: `85-${i + 1}`, rfid: `EST-022-${String(i + 1).padStart(2, '0')}`, state: 'Disponible' }))
  },
  {
    id: 86, name: 'Truss 3 Mts MOWL 3MT-3MM', sku: 'EST-023', rfidBase: 'EST-023',
    category: 'Estructuras', total: 4, description: 'TRUSS 3 MTS - MOWL 3MT-3MM',
    units: Array.from({ length: 4 }, (_, i) => ({ id: `86-${i + 1}`, rfid: `EST-023-${String(i + 1).padStart(2, '0')}`, state: 'Disponible' }))
  },
  {
    id: 87, name: 'Trif Extensiones 10 MTS', sku: 'ENE-010', rfidBase: 'ENE-010',
    category: 'Energía', total: 6, description: 'TRIF EXTENSIONES - GENERICO 10 MTS',
    units: Array.from({ length: 6 }, (_, i) => ({ id: `87-${i + 1}`, rfid: `ENE-010-${String(i + 1).padStart(2, '0')}`, state: 'Disponible' }))
  },
  {
    id: 88, name: 'Tubo 3 Mts', sku: 'EST-024', rfidBase: 'EST-024',
    category: 'Estructuras', total: 7, description: 'TUBO 3 MTS - GENERICO N/A',
    units: Array.from({ length: 7 }, (_, i) => ({ id: `88-${i + 1}`, rfid: `EST-024-${String(i + 1).padStart(2, '0')}`, state: 'Disponible' }))
  },
]