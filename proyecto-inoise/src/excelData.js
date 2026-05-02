// Datos reales importados del Excel: 1.Gestion de Inventario.xlsx
// Generado automáticamente - categorías mapeadas al sistema de inventario

export const categories = ['Audio', 'Iluminacion', 'Pantalla', 'Efectos', 'Estructuras', 'Energía', 'Tecnologia', 'Otros']

export const INITIAL_PRODUCTS = [
  {
    id: 1, name: 'Atriles Microfonos HERCULES MS533B', sku: 'ATHEMS5', rfidBase: 'RFID-ATHEMS5',
    category: 'Audio', total: 2, description: 'Atriles Microfonos - HERCULES MS533B',
    units: Array.from({ length: 2 }, (_, i) => ({ id: `1-${i+1}`, rfid: `RFID-ATHEMS5-${String(i+1).padStart(2,'0')}`, state: 'Disponible' }))
  },
  {
    id: 2, name: 'Atriles Parlantes HERCULES SS200BB', sku: 'ATHESS2', rfidBase: 'RFID-ATHESS2',
    category: 'Audio', total: 8, description: 'Atriles Parlantes - HERCULES SS200BB',
    units: Array.from({ length: 8 }, (_, i) => ({ id: `2-${i+1}`, rfid: `RFID-ATHESS2-${String(i+1).padStart(2,'0')}`, state: 'Disponible' }))
  },
  {
    id: 3, name: 'Atriles Microfonos K&M 25400', sku: 'ATK&254', rfidBase: 'RFID-ATK&254',
    category: 'Audio', total: 10, description: 'Atriles Microfonos - K&M 25400',
    units: Array.from({ length: 10 }, (_, i) => ({ id: `3-${i+1}`, rfid: `RFID-ATK&254-${String(i+1).padStart(2,'0')}`, state: 'Disponible' }))
  },
  {
    id: 4, name: 'Bases Truss GALAXY TIPO CUADRADA', sku: 'BAGATIP', rfidBase: 'RFID-BAGATIP',
    category: 'Estructuras', total: 2, description: 'Bases Truss - GALAXY TIPO CUADRADA',
    units: Array.from({ length: 2 }, (_, i) => ({ id: `4-${i+1}`, rfid: `RFID-BAGATIP-${String(i+1).padStart(2,'0')}`, state: 'Disponible' }))
  },
  {
    id: 5, name: 'Barra T', sku: 'BAGEN/A', rfidBase: 'RFID-BAGEN/A',
    category: 'Estructuras', total: 6, description: 'Barra T - GENERICO N/A',
    units: Array.from({ length: 6 }, (_, i) => ({ id: `5-${i+1}`, rfid: `RFID-BAGEN/A-${String(i+1).padStart(2,'0')}`, state: 'Disponible' }))
  },
  {
    id: 6, name: 'Bases Truss', sku: 'BAGEN/A', rfidBase: 'RFID-BAGEN/A',
    category: 'Estructuras', total: 4, description: 'Bases Truss - GENERICO N/A',
    units: Array.from({ length: 4 }, (_, i) => ({ id: `6-${i+1}`, rfid: `RFID-BAGEN/A-${String(i+1).padStart(2,'0')}`, state: 'Disponible' }))
  },
  {
    id: 7, name: 'Barra Strobe SANYI LIGHT 720', sku: 'BASA720', rfidBase: 'RFID-BASA720',
    category: 'Iluminacion', total: 8, description: 'Barra Strobe - SANYI LIGHT 720',
    units: Array.from({ length: 8 }, (_, i) => ({ id: `7-${i+1}`, rfid: `RFID-BASA720-${String(i+1).padStart(2,'0')}`, state: 'Disponible' }))
  },
  {
    id: 8, name: 'Barras Pin TECHSHOW 6X5W', sku: 'BATE6X5', rfidBase: 'RFID-BATE6X5',
    category: 'Iluminacion', total: 4, description: 'Barras Pin - TECHSHOW 6X5W',
    units: Array.from({ length: 4 }, (_, i) => ({ id: `8-${i+1}`, rfid: `RFID-BATE6X5-${String(i+1).padStart(2,'0')}`, state: 'Disponible' }))
  },
  {
    id: 9, name: 'Barras Pin KEMAX 6X20W', sku: 'BAKE6X2', rfidBase: 'RFID-BAKE6X2',
    category: 'Iluminacion', total: 4, description: 'Barras Pin - KEMAX 6X20W',
    units: Array.from({ length: 4 }, (_, i) => ({ id: `9-${i+1}`, rfid: `RFID-BAKE6X2-${String(i+1).padStart(2,'0')}`, state: 'Disponible' }))
  },
  {
    id: 10, name: 'Biombo', sku: 'BIGEN/A', rfidBase: 'RFID-BIGEN/A',
    category: 'Estructuras', total: 6, description: 'Biombo - GENERICO N/A',
    units: Array.from({ length: 6 }, (_, i) => ({ id: `10-${i+1}`, rfid: `RFID-BIGEN/A-${String(i+1).padStart(2,'0')}`, state: 'Disponible' }))
  },
  {
    id: 11, name: 'Bola Disco 16" WILDPRO WILDPRO', sku: 'BOWIWIL', rfidBase: 'RFID-BOWIWIL',
    category: 'Efectos', total: 20, description: 'Bola Disco 16" - WILDPRO WILDPRO',
    units: Array.from({ length: 20 }, (_, i) => ({ id: `11-${i+1}`, rfid: `RFID-BOWIWIL-${String(i+1).padStart(2,'0')}`, state: 'Disponible' }))
  },
  {
    id: 12, name: 'Bola Disco 21" WILDPRO WILDPRO', sku: 'BOWIWIL', rfidBase: 'RFID-BOWIWIL',
    category: 'Efectos', total: 1, description: 'Bola Disco 21" - WILDPRO WILDPRO',
    units: Array.from({ length: 1 }, (_, i) => ({ id: `12-${i+1}`, rfid: `RFID-BOWIWIL-${String(i+1).padStart(2,'0')}`, state: 'Disponible' }))
  },
  {
    id: 13, name: 'Cabeza Movil Beam AOLAIT 7R', sku: 'CAAO7R', rfidBase: 'RFID-CAAO7R',
    category: 'Iluminacion', total: 8, description: 'Cabeza Movil Beam - AOLAIT 7R',
    units: Array.from({ length: 8 }, (_, i) => ({ id: `13-${i+1}`, rfid: `RFID-CAAO7R-${String(i+1).padStart(2,'0')}`, state: 'Disponible' }))
  },
  {
    id: 14, name: 'Cabeza Movil Beam MOWL 9R', sku: 'CAMO9R', rfidBase: 'RFID-CAMO9R',
    category: 'Iluminacion', total: 10, description: 'Cabeza Movil Beam - MOWL 9R',
    units: Array.from({ length: 10 }, (_, i) => ({ id: `14-${i+1}`, rfid: `RFID-CAMO9R-${String(i+1).padStart(2,'0')}`, state: 'Disponible' }))
  },
  {
    id: 15, name: 'Seven Eyes Backlight MOWL ML-BWJ01', sku: 'SEMOML-', rfidBase: 'RFID-SEMOML-',
    category: 'Iluminacion', total: 2, description: 'Seven Eyes Backlight - MOWL ML-BWJ01',
    units: Array.from({ length: 2 }, (_, i) => ({ id: `15-${i+1}`, rfid: `RFID-SEMOML--${String(i+1).padStart(2,'0')}`, state: 'Disponible' }))
  },
  {
    id: 16, name: 'Six Eyes Backlight MOWL ML-XGD03', sku: 'SIMOML-', rfidBase: 'RFID-SIMOML-',
    category: 'Iluminacion', total: 2, description: 'Six Eyes Backlight - MOWL ML-XGD03',
    units: Array.from({ length: 2 }, (_, i) => ({ id: `16-${i+1}`, rfid: `RFID-SIMOML--${String(i+1).padStart(2,'0')}`, state: 'Disponible' }))
  },
  {
    id: 17, name: 'Caja Cables Audio BAUKER', sku: 'CABASIN', rfidBase: 'RFID-CABASIN',
    category: 'Audio', total: 1, description: 'Caja Cables Audio - BAUKER Sin Modelo',
    units: Array.from({ length: 1 }, (_, i) => ({ id: `17-${i+1}`, rfid: `RFID-CABASIN-${String(i+1).padStart(2,'0')}`, state: 'Disponible' }))
  },
  {
    id: 18, name: 'Caja Cintas BAUKER BAUKER', sku: 'CABABAU', rfidBase: 'RFID-CABABAU',
    category: 'Otros', total: 1, description: 'Caja Cintas - BAUKER BAUKER',
    units: Array.from({ length: 1 }, (_, i) => ({ id: `18-${i+1}`, rfid: `RFID-CABABAU-${String(i+1).padStart(2,'0')}`, state: 'Disponible' }))
  },
  {
    id: 19, name: 'Caja Clamp BAUKER BAUKER', sku: 'CABABAU', rfidBase: 'RFID-CABABAU',
    category: 'Estructuras', total: 1, description: 'Caja Clamp - BAUKER BAUKER',
    units: Array.from({ length: 1 }, (_, i) => ({ id: `19-${i+1}`, rfid: `RFID-CABABAU-${String(i+1).padStart(2,'0')}`, state: 'Disponible' }))
  },
  {
    id: 20, name: 'Caja Conectores Audio BAUKER BAUKER', sku: 'CABABAU', rfidBase: 'RFID-CABABAU',
    category: 'Audio', total: 1, description: 'Caja Conectores Audio - BAUKER BAUKER',
    units: Array.from({ length: 1 }, (_, i) => ({ id: `20-${i+1}`, rfid: `RFID-CABABAU-${String(i+1).padStart(2,'0')}`, state: 'Disponible' }))
  },
  {
    id: 21, name: 'Caja Conectores Electricos ELECTRICO', sku: 'CAELSIN', rfidBase: 'RFID-CAELSIN',
    category: 'Energía', total: 1, description: 'Caja Conectores Electricos - ELECTRICO Sin Modelo',
    units: Array.from({ length: 1 }, (_, i) => ({ id: `21-${i+1}`, rfid: `RFID-CAELSIN-${String(i+1).padStart(2,'0')}`, state: 'Disponible' }))
  },
  {
    id: 22, name: 'Caja Fundas Biombo WENCO WENCO', sku: 'CAWEWEN', rfidBase: 'RFID-CAWEWEN',
    category: 'Estructuras', total: 1, description: 'Caja Fundas Biombo - WENCO WENCO',
    units: Array.from({ length: 1 }, (_, i) => ({ id: `22-${i+1}`, rfid: `RFID-CAWEWEN-${String(i+1).padStart(2,'0')}`, state: 'Disponible' }))
  },
  {
    id: 23, name: 'Caja Fundas Truss WENCO WENCO', sku: 'CAWEWEN', rfidBase: 'RFID-CAWEWEN',
    category: 'Estructuras', total: 1, description: 'Caja Fundas Truss - WENCO WENCO',
    units: Array.from({ length: 1 }, (_, i) => ({ id: `23-${i+1}`, rfid: `RFID-CAWEWEN-${String(i+1).padStart(2,'0')}`, state: 'Disponible' }))
  },
  {
    id: 24, name: 'Caja Guirnaldas Hadas HADAS', sku: 'CAHASIN', rfidBase: 'RFID-CAHASIN',
    category: 'Iluminacion', total: 1, description: 'Caja Guirnaldas Hadas - HADAS Sin Modelo',
    units: Array.from({ length: 1 }, (_, i) => ({ id: `24-${i+1}`, rfid: `RFID-CAHASIN-${String(i+1).padStart(2,'0')}`, state: 'Disponible' }))
  },
  {
    id: 25, name: 'Caja Guirnaldas Toscanas', sku: 'CAGEN/A', rfidBase: 'RFID-CAGEN/A',
    category: 'Iluminacion', total: 1, description: 'Caja Guirnaldas Toscanas - GENERICO N/A',
    units: Array.from({ length: 1 }, (_, i) => ({ id: `25-${i+1}`, rfid: `RFID-CAGEN/A-${String(i+1).padStart(2,'0')}`, state: 'Disponible' }))
  },
  {
    id: 26, name: 'Caja Interlock PELICAN PELICAN', sku: 'CAPEPEL', rfidBase: 'RFID-CAPEPEL',
    category: 'Energía', total: 1, description: 'Caja Interlock - PELICAN PELICAN',
    units: Array.from({ length: 1 }, (_, i) => ({ id: `26-${i+1}`, rfid: `RFID-CAPEPEL-${String(i+1).padStart(2,'0')}`, state: 'Disponible' }))
  },
  {
    id: 27, name: 'Caja Motor Bola Disco ROBUST MJ-5003 B', sku: 'CAROMJ-', rfidBase: 'RFID-CAROMJ-',
    category: 'Efectos', total: 20, description: 'Caja Motor Bola Disco - ROBUST MJ-5003 B',
    units: Array.from({ length: 20 }, (_, i) => ({ id: `27-${i+1}`, rfid: `RFID-CAROMJ--${String(i+1).padStart(2,'0')}`, state: 'Disponible' }))
  },
  {
    id: 28, name: 'Caja Pivotes PIVOTES SILVER EAGLE', sku: 'CAPISIL', rfidBase: 'RFID-CAPISIL',
    category: 'Estructuras', total: 1, description: 'Caja Pivotes - PIVOTES SILVER EAGLE',
    units: Array.from({ length: 1 }, (_, i) => ({ id: `28-${i+1}`, rfid: `RFID-CAPISIL-${String(i+1).padStart(2,'0')}`, state: 'Disponible' }))
  },
  {
    id: 29, name: 'Caja Seguridad WENCO WENCO', sku: 'CAWEWEN', rfidBase: 'RFID-CAWEWEN',
    category: 'Otros', total: 1, description: 'Caja Seguridad - WENCO WENCO',
    units: Array.from({ length: 1 }, (_, i) => ({ id: `29-${i+1}`, rfid: `RFID-CAWEWEN-${String(i+1).padStart(2,'0')}`, state: 'Disponible' }))
  },
  {
    id: 30, name: 'Caja Xlr Cortos PELICAN PELICAN', sku: 'CAPEPEL', rfidBase: 'RFID-CAPEPEL',
    category: 'Iluminacion', total: 1, description: 'Caja Xlr Cortos - PELICAN PELICAN',
    units: Array.from({ length: 1 }, (_, i) => ({ id: `30-${i+1}`, rfid: `RFID-CAPEPEL-${String(i+1).padStart(2,'0')}`, state: 'Disponible' }))
  },
  {
    id: 31, name: 'Caja Zapatillas WENCO WENCO', sku: 'CAWEWEN', rfidBase: 'RFID-CAWEWEN',
    category: 'Energía', total: 1, description: 'Caja Zapatillas - WENCO WENCO',
    units: Array.from({ length: 1 }, (_, i) => ({ id: `31-${i+1}`, rfid: `RFID-CAWEWEN-${String(i+1).padStart(2,'0')}`, state: 'Disponible' }))
  },
  {
    id: 32, name: 'Caja Mtouch+Notebook PELICAN PELICAN', sku: 'CAPEPEL', rfidBase: 'RFID-CAPEPEL',
    category: 'Iluminacion', total: 1, description: 'Caja Mtouch+Notebook - PELICAN PELICAN',
    units: Array.from({ length: 1 }, (_, i) => ({ id: `32-${i+1}`, rfid: `RFID-CAPEPEL-${String(i+1).padStart(2,'0')}`, state: 'Disponible' }))
  },
  {
    id: 33, name: 'Mtouch MARTIN MTOUCH', sku: 'MTMAMTO', rfidBase: 'RFID-MTMAMTO',
    category: 'Iluminacion', total: 1, description: 'Mtouch - MARTIN MTOUCH',
    units: Array.from({ length: 1 }, (_, i) => ({ id: `33-${i+1}`, rfid: `RFID-MTMAMTO-${String(i+1).padStart(2,'0')}`, state: 'Disponible' }))
  },
  {
    id: 34, name: 'Cabeza Movil Wash MARTIN MAC AURA XB', sku: 'CAMAMAC', rfidBase: 'RFID-CAMAMAC',
    category: 'Iluminacion', total: 4, description: 'Cabeza Movil Wash - MARTIN MAC AURA XB',
    units: Array.from({ length: 4 }, (_, i) => ({ id: `34-${i+1}`, rfid: `RFID-CAMAMAC-${String(i+1).padStart(2,'0')}`, state: 'Disponible' }))
  },
  {
    id: 35, name: 'Caja Bordes Pista De Baile ROBUST MJ-5003 B', sku: 'CAROMJ-', rfidBase: 'RFID-CAROMJ-',
    category: 'Estructuras', total: 1, description: 'Caja Bordes Pista De Baile - ROBUST MJ-5003 B',
    units: Array.from({ length: 1 }, (_, i) => ({ id: `35-${i+1}`, rfid: `RFID-CAROMJ--${String(i+1).padStart(2,'0')}`, state: 'Disponible' }))
  },
  {
    id: 36, name: 'Caja Xlr Largos ROBUST ROBUST', sku: 'CAROROB', rfidBase: 'RFID-CAROROB',
    category: 'Iluminacion', total: 2, description: 'Caja Xlr Largos - ROBUST ROBUST',
    units: Array.from({ length: 2 }, (_, i) => ({ id: `36-${i+1}`, rfid: `RFID-CAROROB-${String(i+1).padStart(2,'0')}`, state: 'Disponible' }))
  },
  {
    id: 37, name: 'Cabeza Movil Spot SANYI LIGHT 90W', sku: 'CASA90W', rfidBase: 'RFID-CASA90W',
    category: 'Iluminacion', total: 6, description: 'Cabeza Movil Spot - SANYI LIGHT 90W',
    units: Array.from({ length: 6 }, (_, i) => ({ id: `37-${i+1}`, rfid: `RFID-CASA90W-${String(i+1).padStart(2,'0')}`, state: 'Disponible' }))
  },
  {
    id: 38, name: 'Caja Consola Dmx DMX', sku: 'CADMSIN', rfidBase: 'RFID-CADMSIN',
    category: 'Iluminacion', total: 1, description: 'Caja Consola Dmx - DMX Sin Modelo',
    units: Array.from({ length: 1 }, (_, i) => ({ id: `38-${i+1}`, rfid: `RFID-CADMSIN-${String(i+1).padStart(2,'0')}`, state: 'Disponible' }))
  },
  {
    id: 39, name: 'Consola Dmx LA GAMME CLUB - 12J', sku: 'COLACLU', rfidBase: 'RFID-COLACLU',
    category: 'Iluminacion', total: 1, description: 'Consola Dmx - LA GAMME CLUB - 12J',
    units: Array.from({ length: 1 }, (_, i) => ({ id: `39-${i+1}`, rfid: `RFID-COLACLU-${String(i+1).padStart(2,'0')}`, state: 'Disponible' }))
  },
  {
    id: 40, name: 'Cercha 2 Mts GALAXY 2MM', sku: 'CEGA2MM', rfidBase: 'RFID-CEGA2MM',
    category: 'Estructuras', total: 2, description: 'Cercha 2 Mts - GALAXY 2MM',
    units: Array.from({ length: 2 }, (_, i) => ({ id: `40-${i+1}`, rfid: `RFID-CEGA2MM-${String(i+1).padStart(2,'0')}`, state: 'Disponible' }))
  },
  {
    id: 41, name: 'Chispas Frias LIGHTSOLUTION 600W', sku: 'CHLI600', rfidBase: 'RFID-CHLI600',
    category: 'Efectos', total: 2, description: 'Chispas Frias - LIGHTSOLUTION 600W',
    units: Array.from({ length: 2 }, (_, i) => ({ id: `41-${i+1}`, rfid: `RFID-CHLI600-${String(i+1).padStart(2,'0')}`, state: 'Disponible' }))
  },
  {
    id: 42, name: 'Chispas Frias MOWL 750W', sku: 'CHMO750', rfidBase: 'RFID-CHMO750',
    category: 'Efectos', total: 2, description: 'Chispas Frias - MOWL 750W',
    units: Array.from({ length: 2 }, (_, i) => ({ id: `42-${i+1}`, rfid: `RFID-CHMO750-${String(i+1).padStart(2,'0')}`, state: 'Disponible' }))
  },
  {
    id: 43, name: 'Co2 MOWL ML-CO2-QZ03', sku: 'COMOML-', rfidBase: 'RFID-COMOML-',
    category: 'Efectos', total: 2, description: 'Co2 - MOWL ML-CO2-QZ03',
    units: Array.from({ length: 2 }, (_, i) => ({ id: `43-${i+1}`, rfid: `RFID-COMOML--${String(i+1).padStart(2,'0')}`, state: 'Disponible' }))
  },
  {
    id: 44, name: 'Cortina Led AOLAIT 3X2M (4U)', sku: 'COAO3X2', rfidBase: 'RFID-COAO3X2',
    category: 'Efectos', total: 1, description: 'Cortina Led - AOLAIT 3X2M (4U)',
    units: Array.from({ length: 1 }, (_, i) => ({ id: `44-${i+1}`, rfid: `RFID-COAO3X2-${String(i+1).padStart(2,'0')}`, state: 'Disponible' }))
  },
  {
    id: 45, name: 'Computador  ASUS', sku: 'COASSIN', rfidBase: 'RFID-COASSIN',
    category: 'Tecnologia', total: 1, description: 'Computador  - ASUS Sin Modelo',
    units: Array.from({ length: 1 }, (_, i) => ({ id: `45-${i+1}`, rfid: `RFID-COASSIN-${String(i+1).padStart(2,'0')}`, state: 'Disponible' }))
  },
  {
    id: 46, name: 'Cob Led BIGDIPPER BD-LC001H', sku: 'COBIBD-', rfidBase: 'RFID-COBIBD-',
    category: 'Iluminacion', total: 16, description: 'Cob Led - BIGDIPPER BD-LC001H',
    units: Array.from({ length: 16 }, (_, i) => ({ id: `46-${i+1}`, rfid: `RFID-COBIBD--${String(i+1).padStart(2,'0')}`, state: 'Disponible' }))
  },
  {
    id: 47, name: 'Computador  HP X360 PAVILLION', sku: 'COHPX36', rfidBase: 'RFID-COHPX36',
    category: 'Tecnologia', total: 1, description: 'Computador  - HP X360 PAVILLION',
    units: Array.from({ length: 1 }, (_, i) => ({ id: `47-${i+1}`, rfid: `RFID-COHPX36-${String(i+1).padStart(2,'0')}`, state: 'Disponible' }))
  },
  {
    id: 48, name: 'Confetti SV PRO EFXT-FX03', sku: 'COSVEFX', rfidBase: 'RFID-COSVEFX',
    category: 'Efectos', total: 2, description: 'Confetti - SV PRO EFXT-FX03',
    units: Array.from({ length: 2 }, (_, i) => ({ id: `48-${i+1}`, rfid: `RFID-COSVEFX-${String(i+1).padStart(2,'0')}`, state: 'Disponible' }))
  },
  {
    id: 49, name: 'Escala Mediana HALO 9309-507', sku: 'ESHA930', rfidBase: 'RFID-ESHA930',
    category: 'Estructuras', total: 1, description: 'Escala Mediana - HALO 9309-507',
    units: Array.from({ length: 1 }, (_, i) => ({ id: `49-${i+1}`, rfid: `RFID-ESHA930-${String(i+1).padStart(2,'0')}`, state: 'Disponible' }))
  },
  {
    id: 50, name: 'Escala Retractil SODIMAC', sku: 'ESSOSIN', rfidBase: 'RFID-ESSOSIN',
    category: 'Estructuras', total: 1, description: 'Escala Retractil - SODIMAC Sin Modelo',
    units: Array.from({ length: 1 }, (_, i) => ({ id: `50-${i+1}`, rfid: `RFID-ESSOSIN-${String(i+1).padStart(2,'0')}`, state: 'Disponible' }))
  },
  {
    id: 51, name: 'Extensiones Mono 10 MTS', sku: 'EXGE10 ', rfidBase: 'RFID-EXGE10 ',
    category: 'Energía', total: 10, description: 'Extensiones Mono - GENERICO 10 MTS',
    units: Array.from({ length: 10 }, (_, i) => ({ id: `51-${i+1}`, rfid: `RFID-EXGE10 -${String(i+1).padStart(2,'0')}`, state: 'Disponible' }))
  },
  {
    id: 52, name: 'Fierro Bola Disco', sku: 'FIGEN/A', rfidBase: 'RFID-FIGEN/A',
    category: 'Estructuras', total: 4, description: 'Fierro Bola Disco - GENERICO N/A',
    units: Array.from({ length: 4 }, (_, i) => ({ id: `52-${i+1}`, rfid: `RFID-FIGEN/A-${String(i+1).padStart(2,'0')}`, state: 'Disponible' }))
  },
  {
    id: 53, name: 'Escala Grande HALO 9312-507', sku: 'ESHA931', rfidBase: 'RFID-ESHA931',
    category: 'Estructuras', total: 1, description: 'Escala Grande - HALO 9312-507',
    units: Array.from({ length: 1 }, (_, i) => ({ id: `53-${i+1}`, rfid: `RFID-ESHA931-${String(i+1).padStart(2,'0')}`, state: 'Disponible' }))
  },
  {
    id: 54, name: 'Impresora Cabina HITI PL525', sku: 'IMHIPL5', rfidBase: 'RFID-IMHIPL5',
    category: 'Tecnologia', total: 1, description: 'Impresora Cabina - HITI PL525',
    units: Array.from({ length: 1 }, (_, i) => ({ id: `54-${i+1}`, rfid: `RFID-IMHIPL5-${String(i+1).padStart(2,'0')}`, state: 'Disponible' }))
  },
  {
    id: 55, name: 'Malacates GALAXY 100 KG', sku: 'MAGA100', rfidBase: 'RFID-MAGA100',
    category: 'Estructuras', total: 4, description: 'Malacates - GALAXY 100 KG',
    units: Array.from({ length: 4 }, (_, i) => ({ id: `55-${i+1}`, rfid: `RFID-MAGA100-${String(i+1).padStart(2,'0')}`, state: 'Disponible' }))
  },
  {
    id: 56, name: 'Maquina Hazer PURPLE HF-900', sku: 'MAPUHF-', rfidBase: 'RFID-MAPUHF-',
    category: 'Efectos', total: 1, description: 'Maquina Hazer - PURPLE HF-900',
    units: Array.from({ length: 1 }, (_, i) => ({ id: `56-${i+1}`, rfid: `RFID-MAPUHF--${String(i+1).padStart(2,'0')}`, state: 'Disponible' }))
  },
  {
    id: 57, name: 'Maquina Hazer MOWL 1500', sku: 'MAMO150', rfidBase: 'RFID-MAMO150',
    category: 'Efectos', total: 1, description: 'Maquina Hazer - MOWL 1500',
    units: Array.from({ length: 1 }, (_, i) => ({ id: `57-${i+1}`, rfid: `RFID-MAMO150-${String(i+1).padStart(2,'0')}`, state: 'Disponible' }))
  },
  {
    id: 58, name: 'Mesa Sonido K-ACOUSTIC K68', sku: 'MEK-K68', rfidBase: 'RFID-MEK-K68',
    category: 'Audio', total: 1, description: 'Mesa Sonido - K-ACOUSTIC K68',
    units: Array.from({ length: 1 }, (_, i) => ({ id: `58-${i+1}`, rfid: `RFID-MEK-K68-${String(i+1).padStart(2,'0')}`, state: 'Disponible' }))
  },
  {
    id: 59, name: 'Mesa Sonido SOUNDCRAFT EPM6', sku: 'MESOEPM', rfidBase: 'RFID-MESOEPM',
    category: 'Audio', total: 2, description: 'Mesa Sonido - SOUNDCRAFT EPM6',
    units: Array.from({ length: 2 }, (_, i) => ({ id: `59-${i+1}`, rfid: `RFID-MESOEPM-${String(i+1).padStart(2,'0')}`, state: 'Disponible' }))
  },
  {
    id: 60, name: 'Mesa Sonido SOUNDCRAFT SIGNATURE 10', sku: 'MESOSIG', rfidBase: 'RFID-MESOSIG',
    category: 'Audio', total: 1, description: 'Mesa Sonido - SOUNDCRAFT SIGNATURE 10',
    units: Array.from({ length: 1 }, (_, i) => ({ id: `60-${i+1}`, rfid: `RFID-MESOSIG-${String(i+1).padStart(2,'0')}`, state: 'Disponible' }))
  },
  {
    id: 61, name: 'Mesa Sonido SOUNDCRAFT UI24R', sku: 'MESOUI2', rfidBase: 'RFID-MESOUI2',
    category: 'Audio', total: 1, description: 'Mesa Sonido - SOUNDCRAFT UI24R',
    units: Array.from({ length: 1 }, (_, i) => ({ id: `61-${i+1}`, rfid: `RFID-MESOUI2-${String(i+1).padStart(2,'0')}`, state: 'Disponible' }))
  },
  {
    id: 62, name: 'Microfono BEHRINGER', sku: 'MIBESIN', rfidBase: 'RFID-MIBESIN',
    category: 'Audio', total: 2, description: 'Microfono - BEHRINGER Sin Modelo',
    units: Array.from({ length: 2 }, (_, i) => ({ id: `62-${i+1}`, rfid: `RFID-MIBESIN-${String(i+1).padStart(2,'0')}`, state: 'Disponible' }))
  },
  {
    id: 63, name: 'Microfono Inalambrico NADY HT-1KU-TX-HT-NEUS', sku: 'MINAHT-', rfidBase: 'RFID-MINAHT-',
    category: 'Audio', total: 1, description: 'Microfono Inalambrico - NADY HT-1KU-TX-HT-NEUS',
    units: Array.from({ length: 1 }, (_, i) => ({ id: `63-${i+1}`, rfid: `RFID-MINAHT--${String(i+1).padStart(2,'0')}`, state: 'Disponible' }))
  },
  {
    id: 64, name: 'Microfono SHURE SM58', sku: 'MISHSM5', rfidBase: 'RFID-MISHSM5',
    category: 'Audio', total: 1, description: 'Microfono - SHURE SM58',
    units: Array.from({ length: 1 }, (_, i) => ({ id: `64-${i+1}`, rfid: `RFID-MISHSM5-${String(i+1).padStart(2,'0')}`, state: 'Disponible' }))
  },
  {
    id: 65, name: 'Inalambrico Microfono SHURE SM58', sku: 'INSHSM5', rfidBase: 'RFID-INSHSM5',
    category: 'Audio', total: 1, description: 'Inalambrico Microfono - SHURE SM58',
    units: Array.from({ length: 1 }, (_, i) => ({ id: `65-${i+1}`, rfid: `RFID-INSHSM5-${String(i+1).padStart(2,'0')}`, state: 'Disponible' }))
  },
  {
    id: 66, name: 'Microfono SKP UHF600', sku: 'MISKUHF', rfidBase: 'RFID-MISKUHF',
    category: 'Audio', total: 2, description: 'Microfono - SKP UHF600',
    units: Array.from({ length: 2 }, (_, i) => ({ id: `66-${i+1}`, rfid: `RFID-MISKUHF-${String(i+1).padStart(2,'0')}`, state: 'Disponible' }))
  },
  {
    id: 67, name: 'Pasacable 4 Lineas 4LINEAS', sku: 'PA4LN/A', rfidBase: 'RFID-PA4LN/A',
    category: 'Energía', total: 2, description: 'Pasacable 4 Lineas - 4LINEAS N/A',
    units: Array.from({ length: 2 }, (_, i) => ({ id: `67-${i+1}`, rfid: `RFID-PA4LN/A-${String(i+1).padStart(2,'0')}`, state: 'Disponible' }))
  },
  {
    id: 68, name: 'Par Led AOLAIT 7x12W', sku: 'PAAO7X1', rfidBase: 'RFID-PAAO7X1',
    category: 'Iluminacion', total: 24, description: 'Par Led - AOLAIT 7x12W',
    units: Array.from({ length: 24 }, (_, i) => ({ id: `68-${i+1}`, rfid: `RFID-PAAO7X1-${String(i+1).padStart(2,'0')}`, state: 'Disponible' }))
  },
  {
    id: 69, name: 'Par Led BIGDIPPER 4X50W', sku: 'PABI4X5', rfidBase: 'RFID-PABI4X5',
    category: 'Iluminacion', total: 8, description: 'Par Led - BIGDIPPER 4X50W',
    units: Array.from({ length: 8 }, (_, i) => ({ id: `69-${i+1}`, rfid: `RFID-PABI4X5-${String(i+1).padStart(2,'0')}`, state: 'Disponible' }))
  },
  {
    id: 70, name: 'Pasacable 2 Lineas', sku: 'PAGEN/A', rfidBase: 'RFID-PAGEN/A',
    category: 'Energía', total: 4, description: 'Pasacable 2 Lineas - GENERICO N/A',
    units: Array.from({ length: 4 }, (_, i) => ({ id: `70-${i+1}`, rfid: `RFID-PAGEN/A-${String(i+1).padStart(2,'0')}`, state: 'Disponible' }))
  },
  {
    id: 71, name: 'Parlante QSC K12.2', sku: 'PAQSK12', rfidBase: 'RFID-PAQSK12',
    category: 'Audio', total: 6, description: 'Parlante - QSC K12.2',
    units: Array.from({ length: 6 }, (_, i) => ({ id: `71-${i+1}`, rfid: `RFID-PAQSK12-${String(i+1).padStart(2,'0')}`, state: 'Disponible' }))
  },
  {
    id: 72, name: 'Parlante QSC K10', sku: 'PAQSK10', rfidBase: 'RFID-PAQSK10',
    category: 'Audio', total: 1, description: 'Parlante - QSC K10',
    units: Array.from({ length: 1 }, (_, i) => ({ id: `72-${i+1}`, rfid: `RFID-PAQSK10-${String(i+1).padStart(2,'0')}`, state: 'Disponible' }))
  },
  {
    id: 73, name: 'Paletas Strobe  SANYI LIGHT S960ii', sku: 'PASAS96', rfidBase: 'RFID-PASAS96',
    category: 'Iluminacion', total: 4, description: 'Paletas Strobe  - SANYI LIGHT S960ii',
    units: Array.from({ length: 4 }, (_, i) => ({ id: `73-${i+1}`, rfid: `RFID-PASAS96-${String(i+1).padStart(2,'0')}`, state: 'Disponible' }))
  },
  {
    id: 74, name: 'Perfil Rectangular 3 Mts', sku: 'PEGEN/A', rfidBase: 'RFID-PEGEN/A',
    category: 'Estructuras', total: 7, description: 'Perfil Rectangular 3 Mts - GENERICO N/A',
    units: Array.from({ length: 7 }, (_, i) => ({ id: `74-${i+1}`, rfid: `RFID-PEGEN/A-${String(i+1).padStart(2,'0')}`, state: 'Disponible' }))
  },
  {
    id: 75, name: 'Pista De Baile B&W QINGDAO 100MTS2', sku: 'PIQI100', rfidBase: 'RFID-PIQI100',
    category: 'Estructuras', total: 1, description: 'Pista De Baile B&W - QINGDAO 100MTS2',
    units: Array.from({ length: 1 }, (_, i) => ({ id: `75-${i+1}`, rfid: `RFID-PIQI100-${String(i+1).padStart(2,'0')}`, state: 'Disponible' }))
  },
  {
    id: 76, name: 'Regulador De Voltaje', sku: 'REGEN/A', rfidBase: 'RFID-REGEN/A',
    category: 'Energía', total: 5, description: 'Regulador De Voltaje - GENERICO N/A',
    units: Array.from({ length: 5 }, (_, i) => ({ id: `76-${i+1}`, rfid: `RFID-REGEN/A-${String(i+1).padStart(2,'0')}`, state: 'Disponible' }))
  },
  {
    id: 77, name: 'Sub Bajo AUDIOLAB ALA218', sku: 'SUAUALA', rfidBase: 'RFID-SUAUALA',
    category: 'Audio', total: 1, description: 'Sub Bajo - AUDIOLAB ALA218',
    units: Array.from({ length: 1 }, (_, i) => ({ id: `77-${i+1}`, rfid: `RFID-SUAUALA-${String(i+1).padStart(2,'0')}`, state: 'Disponible' }))
  },
  {
    id: 78, name: 'Tarima', sku: 'TAGEN/A', rfidBase: 'RFID-TAGEN/A',
    category: 'Estructuras', total: 1, description: 'Tarima - GENERICO N/A',
    units: Array.from({ length: 1 }, (_, i) => ({ id: `78-${i+1}`, rfid: `RFID-TAGEN/A-${String(i+1).padStart(2,'0')}`, state: 'Disponible' }))
  },
  {
    id: 79, name: 'Tablero Trifasico LEXO 32A', sku: 'TALE32A', rfidBase: 'RFID-TALE32A',
    category: 'Energía', total: 2, description: 'Tablero Trifasico - LEXO 32A',
    units: Array.from({ length: 2 }, (_, i) => ({ id: `79-${i+1}`, rfid: `RFID-TALE32A-${String(i+1).padStart(2,'0')}`, state: 'Disponible' }))
  },
  {
    id: 80, name: 'Tablero Trifasico 32A', sku: 'TAGE32A', rfidBase: 'RFID-TAGE32A',
    category: 'Energía', total: 1, description: 'Tablero Trifasico - GENERICO 32A',
    units: Array.from({ length: 1 }, (_, i) => ({ id: `80-${i+1}`, rfid: `RFID-TAGE32A-${String(i+1).padStart(2,'0')}`, state: 'Disponible' }))
  },
  {
    id: 81, name: 'Torre FENIX MEGARA 300', sku: 'TOFEMEG', rfidBase: 'RFID-TOFEMEG',
    category: 'Estructuras', total: 2, description: 'Torre - FENIX MEGARA 300',
    units: Array.from({ length: 2 }, (_, i) => ({ id: `81-${i+1}`, rfid: `RFID-TOFEMEG-${String(i+1).padStart(2,'0')}`, state: 'Disponible' }))
  },
  {
    id: 82, name: 'Totem Fotografico', sku: 'TOGEN/A', rfidBase: 'RFID-TOGEN/A',
    category: 'Efectos', total: 1, description: 'Totem Fotografico - GENERICO N/A',
    units: Array.from({ length: 1 }, (_, i) => ({ id: `82-${i+1}`, rfid: `RFID-TOGEN/A-${String(i+1).padStart(2,'0')}`, state: 'Disponible' }))
  },
  {
    id: 83, name: 'Truss 1 Mt GALAXY 1MT-3MM', sku: 'TRGA1MT', rfidBase: 'RFID-TRGA1MT',
    category: 'Estructuras', total: 2, description: 'Truss 1 Mt - GALAXY 1MT-3MM',
    units: Array.from({ length: 2 }, (_, i) => ({ id: `83-${i+1}`, rfid: `RFID-TRGA1MT-${String(i+1).padStart(2,'0')}`, state: 'Disponible' }))
  },
  {
    id: 84, name: 'Truss 2 Mts GALAXY 2MT-3MM', sku: 'TRGA2MT', rfidBase: 'RFID-TRGA2MT',
    category: 'Estructuras', total: 2, description: 'Truss 2 Mts - GALAXY 2MT-3MM',
    units: Array.from({ length: 2 }, (_, i) => ({ id: `84-${i+1}`, rfid: `RFID-TRGA2MT-${String(i+1).padStart(2,'0')}`, state: 'Disponible' }))
  },
  {
    id: 85, name: 'Truss 3 Mts GALAXY 3MT-3MM', sku: 'TRGA3MT', rfidBase: 'RFID-TRGA3MT',
    category: 'Estructuras', total: 10, description: 'Truss 3 Mts - GALAXY 3MT-3MM',
    units: Array.from({ length: 10 }, (_, i) => ({ id: `85-${i+1}`, rfid: `RFID-TRGA3MT-${String(i+1).padStart(2,'0')}`, state: 'Disponible' }))
  },
  {
    id: 86, name: 'Truss 3 Mts MOWL 3MT-3MM', sku: 'TRMO3MT', rfidBase: 'RFID-TRMO3MT',
    category: 'Estructuras', total: 4, description: 'Truss 3 Mts - MOWL 3MT-3MM',
    units: Array.from({ length: 4 }, (_, i) => ({ id: `86-${i+1}`, rfid: `RFID-TRMO3MT-${String(i+1).padStart(2,'0')}`, state: 'Disponible' }))
  },
  {
    id: 87, name: 'Trif Extensiones 10 MTS', sku: 'TRGE10 ', rfidBase: 'RFID-TRGE10 ',
    category: 'Energía', total: 6, description: 'Trif Extensiones - GENERICO 10 MTS',
    units: Array.from({ length: 6 }, (_, i) => ({ id: `87-${i+1}`, rfid: `RFID-TRGE10 -${String(i+1).padStart(2,'0')}`, state: 'Disponible' }))
  },
  {
    id: 88, name: 'Tubo 3 Mts', sku: 'TUGEN/A', rfidBase: 'RFID-TUGEN/A',
    category: 'Estructuras', total: 7, description: 'Tubo 3 Mts - GENERICO N/A',
    units: Array.from({ length: 7 }, (_, i) => ({ id: `88-${i+1}`, rfid: `RFID-TUGEN/A-${String(i+1).padStart(2,'0')}`, state: 'Disponible' }))
  },
]