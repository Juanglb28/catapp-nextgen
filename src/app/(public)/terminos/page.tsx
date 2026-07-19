import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Términos de uso",
  robots: { index: false },
};

export default function TerminosPage() {
  return (
    <article className="prose prose-sm text-foreground max-w-none space-y-6 text-sm leading-relaxed">
      <header>
        <h1 className="text-xl font-bold">Términos de uso</h1>
        <p className="text-muted-foreground">
          Última actualización: junio de 2026
        </p>
        <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
          ⚠️ Este documento es una plantilla de referencia. Debe ser revisada y
          ajustada por un abogado antes de publicarse con carácter definitivo.
        </p>
      </header>

      <section>
        <h2 className="text-base font-semibold">1. Objeto</h2>
        <p>
          CatApp es una plataforma de software como servicio (SaaS) que permite
          a profesionales de belleza —en adelante &ldquo;manicuristas&rdquo; o
          &ldquo;negocios&rdquo;— gestionar citas, clientas, inventario y
          finanzas de su actividad. El acceso y uso de la plataforma implica la
          aceptación plena de estos términos.
        </p>
      </section>

      <section>
        <h2 className="text-base font-semibold">2. Partes</h2>
        <ul className="ml-4 list-disc space-y-1">
          <li>
            <strong>Operador:</strong> la persona natural o jurídica que
            administra CatApp y presta el servicio tecnológico.
          </li>
          <li>
            <strong>Usuario / Negocio:</strong> la manicurista o profesional de
            belleza que crea una cuenta y gestiona su negocio en la plataforma.
          </li>
          <li>
            <strong>Clienta:</strong> la persona cuya información de citas es
            gestionada por el negocio a través de la plataforma.
          </li>
        </ul>
      </section>

      <section>
        <h2 className="text-base font-semibold">3. Acceso al servicio</h2>
        <p>
          El acceso a CatApp requiere registro con correo electrónico y
          contraseña, o mediante cuenta de Google. Cada cuenta está ligada a un
          único negocio (multi-tenant). El usuario es responsable de mantener la
          confidencialidad de sus credenciales.
        </p>
        <p>
          El operador puede suspender o cancelar cuentas que violen estos
          términos, sin previo aviso en casos de uso fraudulento o ilegal.
        </p>
      </section>

      <section>
        <h2 className="text-base font-semibold">4. Uso aceptable</h2>
        <p>El usuario se compromete a:</p>
        <ul className="ml-4 list-disc space-y-1">
          <li>
            Usar la plataforma exclusivamente para la gestión legítima de su
            negocio de belleza
          </li>
          <li>
            Obtener el consentimiento de sus clientas para el tratamiento de sus
            datos personales, conforme a la Ley 1581 de 2012
          </li>
          <li>
            No registrar datos falsos, ni datos de personas sin su conocimiento
            con fines distintos a la prestación del servicio
          </li>
          <li>
            No intentar acceder a los datos de otros negocios ni vulnerar la
            seguridad de la plataforma
          </li>
        </ul>
      </section>

      <section>
        <h2 className="text-base font-semibold">5. Datos de las clientas</h2>
        <p>
          El negocio actúa como responsable del tratamiento de los datos
          personales de sus clientas (nombres, teléfonos, historial de citas).
          El operador actúa como encargado del tratamiento según los términos de
          la Ley Estatutaria 1581 de 2012 y el Decreto 1377 de 2013.
        </p>
        <p>
          El negocio declara contar con la autorización de sus clientas para el
          tratamiento de sus datos y asume la responsabilidad por el
          cumplimiento de la normativa de protección de datos.
        </p>
      </section>

      <section>
        <h2 className="text-base font-semibold">6. Mensajes de WhatsApp</h2>
        <p>
          La función de mensajes automáticos (recordatorios y confirmaciones)
          usa la API de WhatsApp de Meta con plantillas aprobadas. El negocio es
          responsable de obtener el consentimiento de sus clientas para recibir
          estas comunicaciones y de respetar las solicitudes de exclusión
          (opt-out).
        </p>
      </section>

      <section>
        <h2 className="text-base font-semibold">
          7. Disponibilidad del servicio
        </h2>
        <p>
          El operador procura mantener el servicio disponible de forma continua,
          pero no garantiza disponibilidad ininterrumpida. El servicio puede
          interrumpirse por mantenimiento, fallos técnicos o causas de fuerza
          mayor. No se ofrece un SLA formal en el plan actual.
        </p>
      </section>

      <section>
        <h2 className="text-base font-semibold">8. Propiedad intelectual</h2>
        <p>
          El código, diseño y marca de CatApp son propiedad del operador. Los
          datos ingresados por el negocio (clientas, citas, servicios) son
          propiedad del negocio. El operador no reclama derechos sobre el
          contenido del negocio.
        </p>
        <p>
          El negocio puede solicitar la exportación de sus datos en cualquier
          momento a través de la función de descarga CSV disponible en Finanzas,
          y mediante solicitud directa al operador para otros datos.
        </p>
      </section>

      <section>
        <h2 className="text-base font-semibold">
          9. Limitación de responsabilidad
        </h2>
        <p>
          El operador no es responsable de pérdidas de negocio derivadas de
          fallos en el servicio, errores en la información registrada por el
          usuario, ni del uso indebido de las credenciales de acceso. La
          responsabilidad total del operador frente al usuario no excederá el
          valor pagado por el servicio en los últimos 3 meses.
        </p>
      </section>

      <section>
        <h2 className="text-base font-semibold">10. Precio y pagos</h2>
        <p>
          Las condiciones económicas del servicio (precio, período de prueba,
          forma de pago) se comunican al usuario al momento de la contratación y
          pueden actualizarse con un aviso previo de 30 días.
        </p>
      </section>

      <section>
        <h2 className="text-base font-semibold">11. Cancelación</h2>
        <p>
          El usuario puede cancelar su cuenta en cualquier momento. Los datos
          del negocio se conservarán durante 30 días adicionales para permitir
          la exportación, tras lo cual serán eliminados definitivamente.
        </p>
      </section>

      <section>
        <h2 className="text-base font-semibold">12. Ley aplicable</h2>
        <p>
          Estos términos se rigen por las leyes de la República de Colombia.
          Cualquier controversia se someterá a los tribunales competentes de
          Bogotá D.C., Colombia.
        </p>
      </section>

      <section>
        <h2 className="text-base font-semibold">13. Modificaciones</h2>
        <p>
          El operador puede modificar estos términos con un aviso previo de 15
          días. El uso continuado de la plataforma tras ese plazo implica la
          aceptación de los nuevos términos.
        </p>
      </section>

      <footer className="text-muted-foreground border-t pt-4 text-xs">
        <Link href="/privacidad" className="underline">
          Política de privacidad
        </Link>
      </footer>
    </article>
  );
}
