const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

// ─── Datos reales del Excel: 1.Gestion de Inventario.xlsx ───────────────────
const categories = ['Audio', 'Iluminacion', 'Pantalla', 'Efectos', 'Estructuras', 'Energía', 'Tecnologia', 'Otros'];

const products = [
  {
    "id": 1,
    "name": "Atriles Microfonos HERCULES MS533B",
    "sku": "ATHEMS5",
    "category": "Audio",
    "qty": 2,
    "state": "Disponible",
    "rfid": "RFID-ATHEMS5",
    "description": "ATRILES MICROFONOS - HERCULES MS533B"
  },
  {
    "id": 2,
    "name": "Atriles Parlantes HERCULES SS200BB",
    "sku": "ATHESS2",
    "category": "Audio",
    "qty": 8,
    "state": "Disponible",
    "rfid": "RFID-ATHESS2",
    "description": "ATRILES PARLANTES - HERCULES SS200BB"
  },
  {
    "id": 3,
    "name": "Atriles Microfonos K&M 25400",
    "sku": "ATK&254",
    "category": "Audio",
    "qty": 10,
    "state": "Disponible",
    "rfid": "RFID-ATK&254",
    "description": "ATRILES MICROFONOS - K&M 25400"
  },
  {
    "id": 4,
    "name": "Bases Truss GALAXY TIPO CUADRADA",
    "sku": "BAGATIP",
    "category": "Estructuras",
    "qty": 2,
    "state": "Disponible",
    "rfid": "RFID-BAGATIP",
    "description": "BASES TRUSS - GALAXY TIPO CUADRADA"
  },
  {
    "id": 5,
    "name": "Barra T",
    "sku": "BAGEN/A",
    "category": "Estructuras",
    "qty": 6,
    "state": "Disponible",
    "rfid": "RFID-BAGEN/A",
    "description": "BARRA T - GENERICO N/A"
  },
  {
    "id": 6,
    "name": "Bases Truss",
    "sku": "BAGEN/A",
    "category": "Estructuras",
    "qty": 4,
    "state": "Disponible",
    "rfid": "RFID-BAGEN/A",
    "description": "BASES TRUSS - GENERICO N/A"
  },
  {
    "id": 7,
    "name": "Barra Strobe SANYI LIGHT 720",
    "sku": "BASA720",
    "category": "Iluminacion",
    "qty": 8,
    "state": "Disponible",
    "rfid": "RFID-BASA720",
    "description": "BARRA STROBE - SANYI LIGHT 720"
  },
  {
    "id": 8,
    "name": "Barras Pin TECHSHOW 6X5W",
    "sku": "BATE6X5",
    "category": "Iluminacion",
    "qty": 4,
    "state": "Disponible",
    "rfid": "RFID-BATE6X5",
    "description": "BARRAS PIN - TECHSHOW 6X5W"
  },
  {
    "id": 9,
    "name": "Barras Pin KEMAX 6X20W",
    "sku": "BAKE6X2",
    "category": "Iluminacion",
    "qty": 4,
    "state": "Disponible",
    "rfid": "RFID-BAKE6X2",
    "description": "BARRAS PIN - KEMAX 6X20W"
  },
  {
    "id": 10,
    "name": "Biombo",
    "sku": "BIGEN/A",
    "category": "Estructuras",
    "qty": 6,
    "state": "Disponible",
    "rfid": "RFID-BIGEN/A",
    "description": "BIOMBO - GENERICO N/A"
  },
  {
    "id": 11,
    "name": "Bola Disco 16\" WILDPRO WILDPRO",
    "sku": "BOWIWIL",
    "category": "Efectos",
    "qty": 20,
    "state": "Disponible",
    "rfid": "RFID-BOWIWIL",
    "description": "BOLA DISCO 16\" - WILDPRO WILDPRO"
  },
  {
    "id": 12,
    "name": "Bola Disco 21\" WILDPRO WILDPRO",
    "sku": "BOWIWIL",
    "category": "Efectos",
    "qty": 1,
    "state": "Disponible",
    "rfid": "RFID-BOWIWIL",
    "description": "BOLA DISCO 21\" - WILDPRO WILDPRO"
  },
  {
    "id": 13,
    "name": "Cabeza Movil Beam AOLAIT 7R",
    "sku": "CAAO7R",
    "category": "Iluminacion",
    "qty": 8,
    "state": "Disponible",
    "rfid": "RFID-CAAO7R",
    "description": "CABEZA MOVIL BEAM - AOLAIT 7R"
  },
  {
    "id": 14,
    "name": "Cabeza Movil Beam MOWL 9R",
    "sku": "CAMO9R",
    "category": "Iluminacion",
    "qty": 10,
    "state": "Disponible",
    "rfid": "RFID-CAMO9R",
    "description": "CABEZA MOVIL BEAM - MOWL 9R"
  },
  {
    "id": 15,
    "name": "Seven Eyes Backlight MOWL ML-BWJ01",
    "sku": "SEMOML-",
    "category": "Iluminacion",
    "qty": 2,
    "state": "Disponible",
    "rfid": "RFID-SEMOML-",
    "description": "SEVEN EYES BACKLIGHT - MOWL ML-BWJ01"
  },
  {
    "id": 16,
    "name": "Six Eyes Backlight MOWL ML-XGD03",
    "sku": "SIMOML-",
    "category": "Iluminacion",
    "qty": 2,
    "state": "Disponible",
    "rfid": "RFID-SIMOML-",
    "description": "SIX EYES BACKLIGHT - MOWL ML-XGD03"
  },
  {
    "id": 17,
    "name": "Caja Cables Audio BAUKER",
    "sku": "CABASIN",
    "category": "Audio",
    "qty": 1,
    "state": "Disponible",
    "rfid": "RFID-CABASIN",
    "description": "CAJA CABLES AUDIO - BAUKER Sin Modelo"
  },
  {
    "id": 18,
    "name": "Caja Cintas BAUKER BAUKER",
    "sku": "CABABAU",
    "category": "Otros",
    "qty": 1,
    "state": "Disponible",
    "rfid": "RFID-CABABAU",
    "description": "CAJA CINTAS - BAUKER BAUKER"
  },
  {
    "id": 19,
    "name": "Caja Clamp BAUKER BAUKER",
    "sku": "CABABAU",
    "category": "Estructuras",
    "qty": 1,
    "state": "Disponible",
    "rfid": "RFID-CABABAU",
    "description": "CAJA CLAMP - BAUKER BAUKER"
  },
  {
    "id": 20,
    "name": "Caja Conectores Audio BAUKER BAUKER",
    "sku": "CABABAU",
    "category": "Audio",
    "qty": 1,
    "state": "Disponible",
    "rfid": "RFID-CABABAU",
    "description": "CAJA CONECTORES AUDIO - BAUKER BAUKER"
  },
  {
    "id": 21,
    "name": "Caja Conectores Electricos ELECTRICO",
    "sku": "CAELSIN",
    "category": "Energía",
    "qty": 1,
    "state": "Disponible",
    "rfid": "RFID-CAELSIN",
    "description": "CAJA CONECTORES ELECTRICOS - ELECTRICO Sin Modelo"
  },
  {
    "id": 22,
    "name": "Caja Fundas Biombo WENCO WENCO",
    "sku": "CAWEWEN",
    "category": "Estructuras",
    "qty": 1,
    "state": "Disponible",
    "rfid": "RFID-CAWEWEN",
    "description": "CAJA FUNDAS BIOMBO - WENCO WENCO"
  },
  {
    "id": 23,
    "name": "Caja Fundas Truss WENCO WENCO",
    "sku": "CAWEWEN",
    "category": "Estructuras",
    "qty": 1,
    "state": "Disponible",
    "rfid": "RFID-CAWEWEN",
    "description": "CAJA FUNDAS TRUSS - WENCO WENCO"
  },
  {
    "id": 24,
    "name": "Caja Guirnaldas Hadas HADAS",
    "sku": "CAHASIN",
    "category": "Iluminacion",
    "qty": 1,
    "state": "Disponible",
    "rfid": "RFID-CAHASIN",
    "description": "CAJA GUIRNALDAS HADAS - HADAS Sin Modelo"
  },
  {
    "id": 25,
    "name": "Caja Guirnaldas Toscanas",
    "sku": "CAGEN/A",
    "category": "Iluminacion",
    "qty": 1,
    "state": "Disponible",
    "rfid": "RFID-CAGEN/A",
    "description": "CAJA GUIRNALDAS TOSCANAS - GENERICO N/A"
  },
  {
    "id": 26,
    "name": "Caja Interlock PELICAN PELICAN",
    "sku": "CAPEPEL",
    "category": "Energía",
    "qty": 1,
    "state": "Disponible",
    "rfid": "RFID-CAPEPEL",
    "description": "CAJA INTERLOCK - PELICAN PELICAN"
  },
  {
    "id": 27,
    "name": "Caja Motor Bola Disco ROBUST MJ-5003 B",
    "sku": "CAROMJ-",
    "category": "Efectos",
    "qty": 20,
    "state": "Disponible",
    "rfid": "RFID-CAROMJ-",
    "description": "CAJA MOTOR BOLA DISCO - ROBUST MJ-5003 B"
  },
  {
    "id": 28,
    "name": "Caja Pivotes PIVOTES SILVER EAGLE",
    "sku": "CAPISIL",
    "category": "Estructuras",
    "qty": 1,
    "state": "Disponible",
    "rfid": "RFID-CAPISIL",
    "description": "CAJA PIVOTES - PIVOTES SILVER EAGLE"
  },
  {
    "id": 29,
    "name": "Caja Seguridad WENCO WENCO",
    "sku": "CAWEWEN",
    "category": "Otros",
    "qty": 1,
    "state": "Disponible",
    "rfid": "RFID-CAWEWEN",
    "description": "CAJA SEGURIDAD - WENCO WENCO"
  },
  {
    "id": 30,
    "name": "Caja Xlr Cortos PELICAN PELICAN",
    "sku": "CAPEPEL",
    "category": "Iluminacion",
    "qty": 1,
    "state": "Disponible",
    "rfid": "RFID-CAPEPEL",
    "description": "CAJA XLR CORTOS - PELICAN PELICAN"
  },
  {
    "id": 31,
    "name": "Caja Zapatillas WENCO WENCO",
    "sku": "CAWEWEN",
    "category": "Energía",
    "qty": 1,
    "state": "Disponible",
    "rfid": "RFID-CAWEWEN",
    "description": "CAJA ZAPATILLAS - WENCO WENCO"
  },
  {
    "id": 32,
    "name": "Caja Mtouch+Notebook PELICAN PELICAN",
    "sku": "CAPEPEL",
    "category": "Iluminacion",
    "qty": 1,
    "state": "Disponible",
    "rfid": "RFID-CAPEPEL",
    "description": "CAJA MTOUCH+NOTEBOOK - PELICAN PELICAN"
  },
  {
    "id": 33,
    "name": "Mtouch MARTIN MTOUCH",
    "sku": "MTMAMTO",
    "category": "Iluminacion",
    "qty": 1,
    "state": "Disponible",
    "rfid": "RFID-MTMAMTO",
    "description": "MTOUCH - MARTIN MTOUCH"
  },
  {
    "id": 34,
    "name": "Cabeza Movil Wash MARTIN MAC AURA XB",
    "sku": "CAMAMAC",
    "category": "Iluminacion",
    "qty": 4,
    "state": "Disponible",
    "rfid": "RFID-CAMAMAC",
    "description": "CABEZA MOVIL WASH - MARTIN MAC AURA XB"
  },
  {
    "id": 35,
    "name": "Caja Bordes Pista De Baile ROBUST MJ-5003 B",
    "sku": "CAROMJ-",
    "category": "Estructuras",
    "qty": 1,
    "state": "Disponible",
    "rfid": "RFID-CAROMJ-",
    "description": "CAJA BORDES PISTA DE BAILE - ROBUST MJ-5003 B"
  },
  {
    "id": 36,
    "name": "Caja Xlr Largos ROBUST ROBUST",
    "sku": "CAROROB",
    "category": "Iluminacion",
    "qty": 2,
    "state": "Disponible",
    "rfid": "RFID-CAROROB",
    "description": "CAJA XLR LARGOS - ROBUST ROBUST"
  },
  {
    "id": 37,
    "name": "Cabeza Movil Spot SANYI LIGHT 90W",
    "sku": "CASA90W",
    "category": "Iluminacion",
    "qty": 6,
    "state": "Disponible",
    "rfid": "RFID-CASA90W",
    "description": "CABEZA MOVIL SPOT - SANYI LIGHT 90W"
  },
  {
    "id": 38,
    "name": "Caja Consola Dmx DMX",
    "sku": "CADMSIN",
    "category": "Iluminacion",
    "qty": 1,
    "state": "Disponible",
    "rfid": "RFID-CADMSIN",
    "description": "CAJA CONSOLA DMX - DMX Sin Modelo"
  },
  {
    "id": 39,
    "name": "Consola Dmx LA GAMME CLUB - 12J",
    "sku": "COLACLU",
    "category": "Iluminacion",
    "qty": 1,
    "state": "Disponible",
    "rfid": "RFID-COLACLU",
    "description": "CONSOLA DMX - LA GAMME CLUB - 12J"
  },
  {
    "id": 40,
    "name": "Cercha 2 Mts GALAXY 2MM",
    "sku": "CEGA2MM",
    "category": "Estructuras",
    "qty": 2,
    "state": "Disponible",
    "rfid": "RFID-CEGA2MM",
    "description": "CERCHA 2 MTS - GALAXY 2MM"
  },
  {
    "id": 41,
    "name": "Chispas Frias LIGHTSOLUTION 600W",
    "sku": "CHLI600",
    "category": "Efectos",
    "qty": 2,
    "state": "Disponible",
    "rfid": "RFID-CHLI600",
    "description": "CHISPAS FRIAS - LIGHTSOLUTION 600W"
  },
  {
    "id": 42,
    "name": "Chispas Frias MOWL 750W",
    "sku": "CHMO750",
    "category": "Efectos",
    "qty": 2,
    "state": "Disponible",
    "rfid": "RFID-CHMO750",
    "description": "CHISPAS FRIAS - MOWL 750W"
  },
  {
    "id": 43,
    "name": "Co2 MOWL ML-CO2-QZ03",
    "sku": "COMOML-",
    "category": "Efectos",
    "qty": 2,
    "state": "Disponible",
    "rfid": "RFID-COMOML-",
    "description": "CO2 - MOWL ML-CO2-QZ03"
  },
  {
    "id": 44,
    "name": "Cortina Led AOLAIT 3X2M (4U)",
    "sku": "COAO3X2",
    "category": "Efectos",
    "qty": 1,
    "state": "Disponible",
    "rfid": "RFID-COAO3X2",
    "description": "CORTINA LED - AOLAIT 3X2M (4U)"
  },
  {
    "id": 45,
    "name": "Computador  ASUS",
    "sku": "COASSIN",
    "category": "Tecnologia",
    "qty": 1,
    "state": "Disponible",
    "rfid": "RFID-COASSIN",
    "description": "COMPUTADOR  - ASUS Sin Modelo"
  },
  {
    "id": 46,
    "name": "Cob Led BIGDIPPER BD-LC001H",
    "sku": "COBIBD-",
    "category": "Iluminacion",
    "qty": 16,
    "state": "Disponible",
    "rfid": "RFID-COBIBD-",
    "description": "COB LED - BIGDIPPER BD-LC001H"
  },
  {
    "id": 47,
    "name": "Computador  HP X360 PAVILLION",
    "sku": "COHPX36",
    "category": "Tecnologia",
    "qty": 1,
    "state": "Disponible",
    "rfid": "RFID-COHPX36",
    "description": "COMPUTADOR  - HP X360 PAVILLION"
  },
  {
    "id": 48,
    "name": "Confetti SV PRO EFXT-FX03",
    "sku": "COSVEFX",
    "category": "Efectos",
    "qty": 2,
    "state": "Disponible",
    "rfid": "RFID-COSVEFX",
    "description": "CONFETTI - SV PRO EFXT-FX03"
  },
  {
    "id": 49,
    "name": "Escala Mediana HALO 9309-507",
    "sku": "ESHA930",
    "category": "Estructuras",
    "qty": 1,
    "state": "Disponible",
    "rfid": "RFID-ESHA930",
    "description": "ESCALA MEDIANA - HALO 9309-507"
  },
  {
    "id": 50,
    "name": "Escala Retractil SODIMAC",
    "sku": "ESSOSIN",
    "category": "Estructuras",
    "qty": 1,
    "state": "Disponible",
    "rfid": "RFID-ESSOSIN",
    "description": "ESCALA RETRACTIL - SODIMAC Sin Modelo"
  },
  {
    "id": 51,
    "name": "Extensiones Mono 10 MTS",
    "sku": "EXGE10 ",
    "category": "Energía",
    "qty": 10,
    "state": "Disponible",
    "rfid": "RFID-EXGE10 ",
    "description": "EXTENSIONES MONO - GENERICO 10 MTS"
  },
  {
    "id": 52,
    "name": "Fierro Bola Disco",
    "sku": "FIGEN/A",
    "category": "Estructuras",
    "qty": 4,
    "state": "Disponible",
    "rfid": "RFID-FIGEN/A",
    "description": "FIERRO BOLA DISCO - GENERICO N/A"
  },
  {
    "id": 53,
    "name": "Escala Grande HALO 9312-507",
    "sku": "ESHA931",
    "category": "Estructuras",
    "qty": 1,
    "state": "Disponible",
    "rfid": "RFID-ESHA931",
    "description": "ESCALA GRANDE - HALO 9312-507"
  },
  {
    "id": 54,
    "name": "Impresora Cabina HITI PL525",
    "sku": "IMHIPL5",
    "category": "Tecnologia",
    "qty": 1,
    "state": "Disponible",
    "rfid": "RFID-IMHIPL5",
    "description": "IMPRESORA CABINA - HITI PL525"
  },
  {
    "id": 55,
    "name": "Malacates GALAXY 100 KG",
    "sku": "MAGA100",
    "category": "Estructuras",
    "qty": 4,
    "state": "Disponible",
    "rfid": "RFID-MAGA100",
    "description": "MALACATES - GALAXY 100 KG"
  },
  {
    "id": 56,
    "name": "Maquina Hazer PURPLE HF-900",
    "sku": "MAPUHF-",
    "category": "Efectos",
    "qty": 1,
    "state": "Disponible",
    "rfid": "RFID-MAPUHF-",
    "description": "MAQUINA HAZER - PURPLE HF-900"
  },
  {
    "id": 57,
    "name": "Maquina Hazer MOWL 1500",
    "sku": "MAMO150",
    "category": "Efectos",
    "qty": 1,
    "state": "Disponible",
    "rfid": "RFID-MAMO150",
    "description": "MAQUINA HAZER - MOWL 1500"
  },
  {
    "id": 58,
    "name": "Mesa Sonido K-ACOUSTIC K68",
    "sku": "MEK-K68",
    "category": "Audio",
    "qty": 1,
    "state": "Disponible",
    "rfid": "RFID-MEK-K68",
    "description": "MESA SONIDO - K-ACOUSTIC K68"
  },
  {
    "id": 59,
    "name": "Mesa Sonido SOUNDCRAFT EPM6",
    "sku": "MESOEPM",
    "category": "Audio",
    "qty": 2,
    "state": "Disponible",
    "rfid": "RFID-MESOEPM",
    "description": "MESA SONIDO - SOUNDCRAFT EPM6"
  },
  {
    "id": 60,
    "name": "Mesa Sonido SOUNDCRAFT SIGNATURE 10",
    "sku": "MESOSIG",
    "category": "Audio",
    "qty": 1,
    "state": "Disponible",
    "rfid": "RFID-MESOSIG",
    "description": "MESA SONIDO - SOUNDCRAFT SIGNATURE 10"
  },
  {
    "id": 61,
    "name": "Mesa Sonido SOUNDCRAFT UI24R",
    "sku": "MESOUI2",
    "category": "Audio",
    "qty": 1,
    "state": "Disponible",
    "rfid": "RFID-MESOUI2",
    "description": "MESA SONIDO - SOUNDCRAFT UI24R"
  },
  {
    "id": 62,
    "name": "Microfono BEHRINGER",
    "sku": "MIBESIN",
    "category": "Audio",
    "qty": 2,
    "state": "Disponible",
    "rfid": "RFID-MIBESIN",
    "description": "MICROFONO - BEHRINGER Sin Modelo"
  },
  {
    "id": 63,
    "name": "Microfono Inalambrico NADY HT-1KU-TX-HT-NEUS",
    "sku": "MINAHT-",
    "category": "Audio",
    "qty": 1,
    "state": "Disponible",
    "rfid": "RFID-MINAHT-",
    "description": "MICROFONO INALAMBRICO - NADY HT-1KU-TX-HT-NEUS"
  },
  {
    "id": 64,
    "name": "Microfono SHURE SM58",
    "sku": "MISHSM5",
    "category": "Audio",
    "qty": 1,
    "state": "Disponible",
    "rfid": "RFID-MISHSM5",
    "description": "MICROFONO - SHURE SM58"
  },
  {
    "id": 65,
    "name": "Inalambrico Microfono SHURE SM58",
    "sku": "INSHSM5",
    "category": "Audio",
    "qty": 1,
    "state": "Disponible",
    "rfid": "RFID-INSHSM5",
    "description": "INALAMBRICO MICROFONO - SHURE SM58"
  },
  {
    "id": 66,
    "name": "Microfono SKP UHF600",
    "sku": "MISKUHF",
    "category": "Audio",
    "qty": 2,
    "state": "Disponible",
    "rfid": "RFID-MISKUHF",
    "description": "MICROFONO - SKP UHF600"
  },
  {
    "id": 67,
    "name": "Pasacable 4 Lineas 4LINEAS",
    "sku": "PA4LN/A",
    "category": "Energía",
    "qty": 2,
    "state": "Disponible",
    "rfid": "RFID-PA4LN/A",
    "description": "PASACABLE 4 LINEAS - 4LINEAS N/A"
  },
  {
    "id": 68,
    "name": "Par Led AOLAIT 7x12W",
    "sku": "PAAO7X1",
    "category": "Iluminacion",
    "qty": 24,
    "state": "Disponible",
    "rfid": "RFID-PAAO7X1",
    "description": "PAR LED - AOLAIT 7x12W"
  },
  {
    "id": 69,
    "name": "Par Led BIGDIPPER 4X50W",
    "sku": "PABI4X5",
    "category": "Iluminacion",
    "qty": 8,
    "state": "Disponible",
    "rfid": "RFID-PABI4X5",
    "description": "PAR LED - BIGDIPPER 4X50W"
  },
  {
    "id": 70,
    "name": "Pasacable 2 Lineas",
    "sku": "PAGEN/A",
    "category": "Energía",
    "qty": 4,
    "state": "Disponible",
    "rfid": "RFID-PAGEN/A",
    "description": "PASACABLE 2 LINEAS - GENERICO N/A"
  },
  {
    "id": 71,
    "name": "Parlante QSC K12.2",
    "sku": "PAQSK12",
    "category": "Audio",
    "qty": 6,
    "state": "Disponible",
    "rfid": "RFID-PAQSK12",
    "description": "PARLANTE - QSC K12.2"
  },
  {
    "id": 72,
    "name": "Parlante QSC K10",
    "sku": "PAQSK10",
    "category": "Audio",
    "qty": 1,
    "state": "Disponible",
    "rfid": "RFID-PAQSK10",
    "description": "PARLANTE - QSC K10"
  },
  {
    "id": 73,
    "name": "Paletas Strobe  SANYI LIGHT S960ii",
    "sku": "PASAS96",
    "category": "Iluminacion",
    "qty": 4,
    "state": "Disponible",
    "rfid": "RFID-PASAS96",
    "description": "PALETAS STROBE  - SANYI LIGHT S960ii"
  },
  {
    "id": 74,
    "name": "Perfil Rectangular 3 Mts",
    "sku": "PEGEN/A",
    "category": "Estructuras",
    "qty": 7,
    "state": "Disponible",
    "rfid": "RFID-PEGEN/A",
    "description": "PERFIL RECTANGULAR 3 MTS - GENERICO N/A"
  },
  {
    "id": 75,
    "name": "Pista De Baile B&W QINGDAO 100MTS2",
    "sku": "PIQI100",
    "category": "Estructuras",
    "qty": 1,
    "state": "Disponible",
    "rfid": "RFID-PIQI100",
    "description": "PISTA DE BAILE B&W - QINGDAO 100MTS2"
  },
  {
    "id": 76,
    "name": "Regulador De Voltaje",
    "sku": "REGEN/A",
    "category": "Energía",
    "qty": 5,
    "state": "Disponible",
    "rfid": "RFID-REGEN/A",
    "description": "REGULADOR DE VOLTAJE - GENERICO N/A"
  },
  {
    "id": 77,
    "name": "Sub Bajo AUDIOLAB ALA218",
    "sku": "SUAUALA",
    "category": "Audio",
    "qty": 1,
    "state": "Disponible",
    "rfid": "RFID-SUAUALA",
    "description": "SUB BAJO - AUDIOLAB ALA218"
  },
  {
    "id": 78,
    "name": "Tarima",
    "sku": "TAGEN/A",
    "category": "Estructuras",
    "qty": 1,
    "state": "Disponible",
    "rfid": "RFID-TAGEN/A",
    "description": "TARIMA - GENERICO N/A"
  },
  {
    "id": 79,
    "name": "Tablero Trifasico LEXO 32A",
    "sku": "TALE32A",
    "category": "Energía",
    "qty": 2,
    "state": "Disponible",
    "rfid": "RFID-TALE32A",
    "description": "TABLERO TRIFASICO - LEXO 32A"
  },
  {
    "id": 80,
    "name": "Tablero Trifasico 32A",
    "sku": "TAGE32A",
    "category": "Energía",
    "qty": 1,
    "state": "Disponible",
    "rfid": "RFID-TAGE32A",
    "description": "TABLERO TRIFASICO - GENERICO 32A"
  },
  {
    "id": 81,
    "name": "Torre FENIX MEGARA 300",
    "sku": "TOFEMEG",
    "category": "Estructuras",
    "qty": 2,
    "state": "Disponible",
    "rfid": "RFID-TOFEMEG",
    "description": "TORRE - FENIX MEGARA 300"
  },
  {
    "id": 82,
    "name": "Totem Fotografico",
    "sku": "TOGEN/A",
    "category": "Efectos",
    "qty": 1,
    "state": "Disponible",
    "rfid": "RFID-TOGEN/A",
    "description": "TOTEM FOTOGRAFICO - GENERICO N/A"
  },
  {
    "id": 83,
    "name": "Truss 1 Mt GALAXY 1MT-3MM",
    "sku": "TRGA1MT",
    "category": "Estructuras",
    "qty": 2,
    "state": "Disponible",
    "rfid": "RFID-TRGA1MT",
    "description": "TRUSS 1 MT - GALAXY 1MT-3MM"
  },
  {
    "id": 84,
    "name": "Truss 2 Mts GALAXY 2MT-3MM",
    "sku": "TRGA2MT",
    "category": "Estructuras",
    "qty": 2,
    "state": "Disponible",
    "rfid": "RFID-TRGA2MT",
    "description": "TRUSS 2 MTS - GALAXY 2MT-3MM"
  },
  {
    "id": 85,
    "name": "Truss 3 Mts GALAXY 3MT-3MM",
    "sku": "TRGA3MT",
    "category": "Estructuras",
    "qty": 10,
    "state": "Disponible",
    "rfid": "RFID-TRGA3MT",
    "description": "TRUSS 3 MTS - GALAXY 3MT-3MM"
  },
  {
    "id": 86,
    "name": "Truss 3 Mts MOWL 3MT-3MM",
    "sku": "TRMO3MT",
    "category": "Estructuras",
    "qty": 4,
    "state": "Disponible",
    "rfid": "RFID-TRMO3MT",
    "description": "TRUSS 3 MTS - MOWL 3MT-3MM"
  },
  {
    "id": 87,
    "name": "Trif Extensiones 10 MTS",
    "sku": "TRGE10 ",
    "category": "Energía",
    "qty": 6,
    "state": "Disponible",
    "rfid": "RFID-TRGE10 ",
    "description": "TRIF EXTENSIONES - GENERICO 10 MTS"
  },
  {
    "id": 88,
    "name": "Tubo 3 Mts",
    "sku": "TUGEN/A",
    "category": "Estructuras",
    "qty": 7,
    "state": "Disponible",
    "rfid": "RFID-TUGEN/A",
    "description": "TUBO 3 MTS - GENERICO N/A"
  }
];

const events = [];

const antennas = [
  { id: 1, name: 'Antena 1', status: 'Activa', signal: 87, last: '2025-12-10 14:23' },
  { id: 2, name: 'Antena 2', status: 'Offline', signal: 0, last: '2025-12-09 09:12' },
  { id: 3, name: 'Antena 3', status: 'Activa', signal: 65, last: '2025-12-10 13:55' },
];

const history = [];

// ─── Rutas ───────────────────────────────────────────────────────────────────
app.get('/', (req, res) => res.send('RFID Backend - Inventario iNoise'));

app.get('/api/categories', (req, res) => res.json(categories));

app.get('/api/products', (req, res) => {
  const { category } = req.query;
  if (category) return res.json(products.filter(p => p.category === category));
  res.json(products);
});

app.get('/api/products/:id', (req, res) => {
  const product = products.find(p => p.id === Number(req.params.id));
  if (!product) return res.status(404).json({ message: 'Producto no encontrado' });
  res.json(product);
});

app.get('/api/events', (req, res) => res.json(events));
app.get('/api/antennas', (req, res) => res.json(antennas));
app.get('/api/history', (req, res) => res.json(history));

app.listen(PORT, () => {
  console.log(`🚀 Backend iNoise corriendo en http://localhost:${PORT}`);
  console.log(`📦 ${products.length} productos cargados desde el Excel`);
});