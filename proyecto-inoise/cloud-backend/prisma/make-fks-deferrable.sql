-- Prisma no tiene forma de declarar foreign keys DEFERRABLE en schema.prisma,
-- así que este script las ajusta directo en Postgres después de cada
-- "prisma db push" / "prisma migrate".
--
-- Por qué hace falta: el patrón de guardado de esta app es "borrar todo y
-- reinsertar" por entidad (ver comentario en electron/db.js) — ej. saveProducts
-- borra TODOS los productos y unidades y los vuelve a insertar con los mismos
-- ids, dentro de la MISMA transacción. Mientras tanto, otras tablas (como
-- event_assignment_units) siguen "apuntando" a esos ids que por un instante
-- no existen. En SQLite esto se resolvía apagando la verificación de FK
-- durante esa transacción puntual (withForeignKeysOff). Postgres no tiene un
-- "apagado global" equivalente, pero sí foreign keys DEFERRABLE: declaradas
-- así, Postgres no revisa la relación statement por statement sino recién al
-- hacer COMMIT de toda la transacción.
--
-- NOTA: "ALTER TABLE ... ALTER CONSTRAINT ... DEFERRABLE" (lo que este
-- script hacía antes) actualiza el catálogo (pg_constraint) pero, al menos
-- en esta base, NO actualiza el trigger "de acción" que vive en la tabla
-- REFERENCIADA (el que corre al hacer DELETE del lado padre) — queda
-- con tgdeferrable=false aunque pg_constraint diga condeferrable=true,
-- y el DELETE sigue fallando al toque. Confirmado a mano con pg_trigger.
-- La única forma confiable es BORRAR y RECREAR cada constraint con
-- DEFERRABLE INITIALLY DEFERRED puesto desde el CREATE — así los triggers
-- nacen ya bien configurados en ambos lados.
DO $$
DECLARE
  fk RECORD;
  def TEXT;
BEGIN
  FOR fk IN
    SELECT conname, conrelid::regclass AS tbl, oid
    FROM pg_constraint
    WHERE contype = 'f' AND connamespace = 'public'::regnamespace
  LOOP
    def := pg_get_constraintdef(fk.oid);
    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', fk.tbl, fk.conname);
    EXECUTE format('ALTER TABLE %s ADD CONSTRAINT %I %s DEFERRABLE INITIALLY DEFERRED', fk.tbl, fk.conname, def);
  END LOOP;
END $$;
