-- Fecha de cumpleaños de la clienta (day-month; year opcional).
-- Tipo `date` sin zona horaria: sólo importa el día/mes, no el instante.
ALTER TABLE "clients" ADD COLUMN "birthday_date" date;
