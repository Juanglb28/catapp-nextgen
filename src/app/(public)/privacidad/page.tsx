import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Política de privacidad",
  robots: { index: false },
};

export default function PrivacidadPage() {
  return (
    <article className="prose prose-sm text-foreground max-w-none space-y-6 text-sm leading-relaxed">
      <header>
        <h1 className="text-xl font-bold">Política de privacidad</h1>
        <p className="text-muted-foreground">
          Última actualización: junio de 2026
        </p>
        <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
          ⚠️ Este documento es una plantilla de referencia. Debe ser revisada y
          ajustada por un abogado antes de publicarse con carácter definitivo.
        </p>
      </header>

      <section>
        <h2 className="text-base font-semibold">
          1. Responsable del tratamiento
        </h2>
        <p>
          El negocio de belleza registrado en esta plataforma actúa como
          responsable del tratamiento de los datos de sus clientas. CatApp actúa
          como encargado del tratamiento, prestando la infraestructura
          tecnológica.
        </p>
        <p>
          Para ejercer sus derechos puede contactar directamente con el negocio
          que gestionó su cita, o escribir a:{" "}
          <a href="mailto:contacto@catapp.com" className="underline">
            contacto@catapp.com
          </a>
          .
        </p>
      </section>

      <section>
        <h2 className="text-base font-semibold">2. Datos que recopilamos</h2>
        <p>
          Cuando una manicurista registra una clienta en CatApp, se almacenan:
        </p>
        <ul className="ml-4 list-disc space-y-1">
          <li>Nombre o alias</li>
          <li>Número de teléfono (para envío de recordatorios por WhatsApp)</li>
          <li>Correo electrónico (opcional)</li>
          <li>Notas del servicio (opcional)</li>
          <li>
            Historial de citas: fecha, servicios, montos y estados de pago
          </li>
        </ul>
        <p>
          No recopilamos documentos de identidad, datos financieros (tarjetas o
          cuentas bancarias) ni información sensible según la Ley 1581 de 2012.
        </p>
      </section>

      <section>
        <h2 className="text-base font-semibold">
          3. Finalidad del tratamiento
        </h2>
        <p>Los datos se usan exclusivamente para:</p>
        <ul className="ml-4 list-disc space-y-1">
          <li>Agendar y gestionar citas de belleza</li>
          <li>
            Enviar confirmaciones y recordatorios por WhatsApp (con su
            consentimiento)
          </li>
          <li>
            Generar el historial de servicios y los reportes financieros del
            negocio
          </li>
        </ul>
        <p>
          No cedemos ni vendemos datos personales a terceros con fines
          comerciales.
        </p>
      </section>

      <section>
        <h2 className="text-base font-semibold">4. Base legal</h2>
        <p>
          El tratamiento de sus datos se realiza con base en la{" "}
          <strong>Ley Estatutaria 1581 de 2012</strong> y el{" "}
          <strong>Decreto 1377 de 2013</strong> de la República de Colombia, que
          regulan la protección de datos personales. El fundamento del
          tratamiento es la relación comercial de servicio de belleza entre
          usted y el negocio, así como su consentimiento para el envío de
          comunicaciones.
        </p>
      </section>

      <section>
        <h2 className="text-base font-semibold">
          5. Transferencias internacionales
        </h2>
        <p>
          Los datos se almacenan en servidores de Railway (Estados Unidos). Esta
          transferencia se realiza con las garantías adecuadas exigidas por la
          normativa colombiana.
        </p>
      </section>

      <section>
        <h2 className="text-base font-semibold">
          6. Sus derechos (Habeas Data)
        </h2>
        <p>Conforme a la Ley 1581 de 2012, usted tiene derecho a:</p>
        <ul className="ml-4 list-disc space-y-1">
          <li>
            <strong>Conocer</strong> qué datos suyos están almacenados
          </li>
          <li>
            <strong>Actualizar o corregir</strong> datos inexactos
          </li>
          <li>
            <strong>Suprimir</strong> sus datos cuando no exista deber legal de
            conservarlos
          </li>
          <li>
            <strong>Revocar</strong> el consentimiento para el tratamiento
          </li>
          <li>
            <strong>Reclamar</strong> ante la Superintendencia de Industria y
            Comercio (SIC) si considera que sus derechos han sido vulnerados
          </li>
        </ul>
        <p>
          Para ejercer estos derechos, comuníquese con el negocio que gestiona
          sus citas o escríbanos a{" "}
          <a href="mailto:contacto@catapp.com" className="underline">
            contacto@catapp.com
          </a>
          . Responderemos en un plazo máximo de 15 días hábiles.
        </p>
      </section>

      <section>
        <h2 className="text-base font-semibold">7. Mensajes de WhatsApp</h2>
        <p>
          Si el negocio tiene activados los mensajes automáticos, recibirá
          confirmaciones y recordatorios de sus citas por WhatsApp. Puede pedir
          que lo excluyan de estos mensajes en cualquier momento solicitándolo
          directamente al negocio.
        </p>
      </section>

      <section>
        <h2 className="text-base font-semibold">8. Conservación de datos</h2>
        <p>
          Los datos se conservan mientras exista la relación de servicio con el
          negocio y durante el tiempo que la legislación colombiana lo exija
          para fines fiscales o comerciales. Una vez cumplidos estos plazos, los
          datos son eliminados o anonimizados.
        </p>
      </section>

      <section>
        <h2 className="text-base font-semibold">9. Cambios a esta política</h2>
        <p>
          Podemos actualizar esta política periódicamente. Los cambios
          sustanciales se comunicarán a través del negocio que gestiona sus
          citas. La fecha de última actualización aparece en el encabezado.
        </p>
      </section>

      <footer className="text-muted-foreground border-t pt-4 text-xs">
        <Link href="/terminos" className="underline">
          Términos de uso
        </Link>
      </footer>
    </article>
  );
}
