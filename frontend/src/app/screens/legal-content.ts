import { LegalDocument } from './legal-doc';

export const TERMINOS: LegalDocument = {
  title: 'Términos y Condiciones de Uso',
  updatedAt: '2 de agosto de 2026',
  intro:
    'Los presentes Términos y Condiciones regulan el acceso y uso del sitio web, la aplicación, las funcionalidades y los servicios relacionados operados bajo el nombre comercial "Mi Libro Sorpresa" por Luis Omar Montoya Jaquez (en lo sucesivo, "Mi Libro Sorpresa"). Al registrarse, acceder o utilizar Mi Libro Sorpresa, usted acepta estos Términos y Condiciones. Si no está de acuerdo con ellos, no debe utilizar el servicio.',
  sections: [
    {
      heading: '1. Naturaleza del servicio',
      paragraphs: [
        'Mi Libro Sorpresa es un servicio de curaduría personalizada de libros. A partir de las respuestas que usted proporciona en un cuestionario, se construye un perfil lector y un proceso de selección —con apoyo de algoritmos y revisión humana— elige un libro físico que se envía a su domicilio, acompañado de una carta personalizada, un separador y una invitación para compartir su opinión sobre la lectura.',
        'El valor del servicio reside en la selección hecha a la medida de su perfil. Mi Libro Sorpresa no es una librería con un catálogo de títulos elegibles ni una suscripción, y no garantiza que la lectura resulte de su agrado: el gusto por la lectura es subjetivo y personal.',
      ],
    },
    {
      heading: '2. Aceptación y requisitos',
      paragraphs: [
        'Al crear una cuenta o utilizar el servicio, usted manifiesta su aceptación de estos Términos y Condiciones y del Aviso de Privacidad correspondiente.',
      ],
      items: [
        'Debe ser mayor de 18 años para utilizar el servicio.',
        'Debe proporcionar información veraz, completa y actualizada.',
        'Debe contar con un domicilio de entrega válido dentro de México.',
      ],
    },
    {
      heading: '3. Registro y cuenta',
      paragraphs: [
        'Para adquirir el servicio usted debe crear una cuenta. Las credenciales de acceso son administradas mediante un proveedor de autenticación de terceros; Mi Libro Sorpresa no almacena su contraseña.',
        'Usted es responsable de mantener la confidencialidad de sus credenciales, de restringir el acceso no autorizado a su cuenta y de notificarnos oportunamente cualquier uso no autorizado o incidente de seguridad.',
        'Mi Libro Sorpresa puede suspender o limitar cuentas cuando detecte riesgos de seguridad, uso indebido, fraude, incumplimiento de estos Términos y Condiciones o conductas que afecten a terceros o a la operación del servicio.',
      ],
    },
    {
      heading: '4. Proceso del servicio',
      paragraphs: [
        'El servicio se presta conforme a las siguientes etapas:',
      ],
      items: [
        'Cuestionario: usted responde un cuestionario de aproximadamente 5 a 7 minutos sobre sus hábitos, preferencias y aversiones de lectura.',
        'Perfil lector: sus respuestas se ordenan y procesan para construir un perfil lector.',
        'Selección: un sistema compara libros candidatos y ordena las opciones; una persona investiga los finalistas y toma la decisión final.',
        'Preparación: se prepara su paquete con el libro elegido, una carta personalizada, un separador y una invitación para compartir su opinión.',
        'Envío: el paquete se envía a la dirección que usted registró, con un tiempo estimado de 5 a 10 días hábiles.',
      ],
    },
    {
      heading: '5. Precio y pago',
      paragraphs: [
        'El precio actual del servicio es de $499.00 MXN, pago único, con envío incluido y sin suscripción. Este precio puede corresponder a una promoción o "precio fundador" y podrá cambiar para compras futuras; el precio aplicable será el vigente al momento de completar cada compra.',
        'El pago se procesa a través de Stripe, un proveedor de pagos de terceros, mediante enlaces de pago seguros. Mi Libro Sorpresa no almacena ni accede a los datos de su tarjeta; los reembolsos, cuando apliquen, se procesarán contra el método de pago original conforme a los plazos del proveedor.',
        'Su pedido se confirma cuando el pago se completa correctamente. Para que el pedido se vincule a su cuenta, debe completar el pago estando iniciada su sesión.',
        'Los precios están expresados en pesos mexicanos e incluyen los impuestos aplicables.',
      ],
    },
    {
      heading: '6. Cancelación y reembolsos',
      paragraphs: [
        'Retracto antes del envío: puede cancelar su pedido y solicitar el reembolso total mientras el libro aún no haya sido enviado, sin penalización alguna.',
        'Después del envío: si el ejemplar llega con defectos físicos de manufactura o se detecta un error en el empaque o en el libro enviado, lo reemplazamos sin costo adicional. Para ello deberá reportarlo con fotografía del ejemplar dentro de los 7 días naturales siguientes a la entrega.',
        'No se realizan devoluciones, cambios de título ni reembolsos por diferencia de gusto. La selección del libro es personalizada y el disfrute de una lectura es subjetivo; si el libro no fue de su agrado, el feedback que nos comparta nos ayuda a afinar sus futuras recomendaciones.',
        'No se realizan cambios de título una vez que el libro ha sido enviado.',
      ],
    },
    {
      heading: '7. Envío y entrega',
      paragraphs: [
        'El envío se realiza dentro de México con un tiempo estimado de 5 a 10 días hábiles. Nos comunicaremos con usted en cada paso relevante de su pedido.',
        'El riesgo de pérdida o daño del paquete en tránsito por causas imputables a la empresa de mensajería es a nuestro cargo: reenviaremos el paquete sin costo o, si no es viable, le reembolsaremos el monto pagado.',
        'Si el paquete no puede entregarse porque la dirección registrada es incorrecta o incompleta, o porque el destinatario no fue localizado, el riesgo es del cliente: el reenvío correrá a su costo o, a nuestro criterio, podremos reembolsar el pedido.',
        'No realizamos entregas en apartados postales ni a direcciones fuera de México.',
      ],
    },
    {
      heading: '8. Feedback, aprendizaje y recompra',
      paragraphs: [
        'Al recibir su paquete podrá compartir su opinión escaneando el código QR incluido o siguiendo la invitación que reciba. El feedback nos permite mejorar su perfil y afinar futuras selecciones.',
        'La posibilidad de realizar una nueva compra se habilita una vez que el pedido activo cuenta con feedback o cuando el ciclo de feedback del pedido concluye, conforme al flujo del servicio.',
      ],
    },
    {
      heading: '9. Uso de algoritmos',
      paragraphs: [
        'Su perfil lector se construye mediante procesos automatizados que pueden contener errores u omisiones. Las sugerencias y ordenamientos generados por el sistema son de apoyo: la decisión final de selección siempre la toma una persona.',
        'No se garantiza la exactitud del perfil lector ni que el libro elegido encaje con sus expectativas.',
      ],
    },
    {
      heading: '10. Limitación de responsabilidad',
      paragraphs: [
        'En la máxima medida permitida por la legislación aplicable, Mi Libro Sorpresa no será responsable por daños directos, indirectos, incidentales, especiales o consecuenciales, ni por lucro cesante, derivados de o relacionados con:',
      ],
      items: [
        'errores, omisiones o inexactitudes en el perfil lector o en las recomendaciones generadas;',
        'diferencias de gusto, expectativas o interpretaciones personales sobre el libro seleccionado;',
        'fallas, interrupciones o indisponibilidad temporal del servicio o de sus proveedores;',
        'demoras o pérdidas en el envío por causas imputables a la empresa de mensajería o por fuerza mayor;',
        'direcciones de entrega incorrectas o datos de contacto erróneos proporcionados por usted; y',
        'uso no autorizado de su cuenta derivado de descuidos propios o de incidentes fuera de nuestro control razonable.',
      ],
      closing: [
        'En ningún caso nuestra responsabilidad agregada por cualquier reclamación relacionada con una compra excederá el monto que usted haya pagado por dicha compra.',
        'El servicio se presta en el estado en que se encuentre y, en la medida permitida por la ley, sin garantías de disponibilidad continua, ausencia de errores o aptitud para un propósito particular. Nada en esta cláusula pretende excluir responsabilidades que no puedan limitarse o excluirse válidamente conforme a la ley aplicable.',
      ],
    },
    {
      heading: '11. Uso permitido y prohibiciones',
      paragraphs: ['Usted se obliga a utilizar el servicio de manera lícita y conforme a estos Términos y Condiciones. Queda prohibido, entre otros supuestos:'],
      items: [
        'utilizar el servicio para fines ilícitos o fraudulentos, incluyendo el uso de métodos de pago ajenos o no autorizados;',
        'intentar acceder sin autorización a cuentas, sistemas, datos o infraestructura;',
        'interferir con la seguridad, funcionamiento o disponibilidad del servicio;',
        'realizar ingeniería inversa, scraping, extracción automatizada no autorizada o intentos de evasión de controles técnicos; y',
        'proporcionar respuestas falsas o abusar del cuestionario o del sistema de feedback con fines de manipulación o fraude.',
      ],
    },
    {
      heading: '12. Propiedad intelectual',
      paragraphs: [
        'Salvo que se indique expresamente lo contrario, el software, la marca, los textos, el diseño y demás componentes de Mi Libro Sorpresa son propiedad de su titular o de sus respectivos licenciatarios y están protegidos por la legislación aplicable.',
        'Estos Términos y Condiciones no transfieren ningún derecho de propiedad intelectual, salvo una licencia limitada, revocable, no exclusiva e intransferible para utilizar el servicio conforme a su finalidad permitida.',
      ],
    },
    {
      heading: '13. Suspensión y cambios del servicio',
      paragraphs: [
        'Mi Libro Sorpresa podrá, en cualquier momento: modificar, limitar, sustituir o eliminar funcionalidades; suspender temporalmente la operación por mantenimiento, seguridad, fallas o mejoras; y cancelar cuentas o accesos cuando existan causas razonables de seguridad, abuso, incumplimiento o riesgo operativo.',
      ],
    },
    {
      heading: '14. Privacidad',
      paragraphs: [
        'El tratamiento de sus datos personales se rige por el Aviso de Privacidad de Mi Libro Sorpresa, disponible en el sitio. Al utilizar el servicio usted reconoce haber leído dicho aviso.',
      ],
    },
    {
      heading: '15. Legislación aplicable y jurisdicción',
      paragraphs: [
        'Estos Términos y Condiciones se interpretarán conforme a las leyes de los Estados Unidos Mexicanos. Cualquier controversia relacionada con su interpretación, cumplimiento o ejecución se atenderá conforme a la legislación mexicana y ante los tribunales competentes de Ciudad Juárez, Chihuahua, México, salvo disposición legal imperativa en contrario.',
        'Como consumidor, usted conserva los derechos que le otorgan la Ley Federal de Protección al Consumidor y la Procuraduría Federal del Consumidor (PROFECO).',
      ],
    },
    {
      heading: '16. Cambios a los Términos y Condiciones',
      paragraphs: [
        'Mi Libro Sorpresa puede actualizar estos Términos y Condiciones en cualquier momento. Las versiones actualizadas se publicarán en el sitio. El uso continuado del servicio después de una actualización implicará la aceptación de la versión vigente, en la medida permitida por la ley.',
      ],
    },
    {
      heading: '17. Contacto',
      paragraphs: [
        'Para dudas relacionadas con estos Términos y Condiciones o con el servicio, puede escribirnos a hola@milibrosorpresa.com o enviarnos un mensaje por WhatsApp al +52 653 128 6373.',
      ],
    },
  ],
};

export const AVISO_PRIVACIDAD: LegalDocument = {
  title: 'Aviso de Privacidad Integral',
  updatedAt: '2 de agosto de 2026',
  intro:
    'Luis Omar Montoya Jaquez, quien opera la aplicación y los servicios relacionados bajo el nombre comercial "Mi Libro Sorpresa" (en lo sucesivo, "Mi Libro Sorpresa"), con domicilio en Rincones de Barcelona 1512, Col. Rincones de Oriente Sur, C.P. 32563, Ciudad Juárez, Chihuahua, México, y correo electrónico de contacto hola@milibrosorpresa.com, es responsable del tratamiento de los datos personales que recaba de sus usuarios, de conformidad con la Ley Federal de Protección de Datos Personales en Posesión de los Particulares y demás normativa aplicable en México.',
  sections: [
    {
      heading: '1. Datos personales que recabamos',
      paragraphs: ['Dependiendo de la forma en que use el servicio, podemos recabar y tratar las siguientes categorías de datos personales:'],
      items: [
        'Datos de identificación y contacto, como nombre, correo electrónico y datos asociados a su cuenta.',
        'Datos de cuenta y autenticación, como la referencia de identidad y el correo con el que se registró; las credenciales de acceso son administradas por nuestro proveedor de autenticación y nosotros no almacenamos contraseñas.',
        'Datos de perfil lector, como las respuestas a nuestro cuestionario sobre hábitos, géneros, temas, emociones, aversiones, preferencias de extensión y libros que disfruta, así como el perfil lector que se deriva de esas respuestas.',
        'Datos del pedido y del envío, como el nombre del destinatario, número de teléfono y dirección de entrega.',
        'Datos de pago: el cobro se procesa a través de Stripe, que puede tratar sus datos de pago bajo sus propios términos; nosotros solo registramos el estado, el monto y la referencia de cada pago, y no almacenamos los datos de su tarjeta.',
        'Datos de feedback, como estado de lectura, valoraciones, motivos y comentarios que comparte sobre el libro recibido.',
        'Datos de soporte y comunicación, cuando nos contacta por correo electrónico, WhatsApp u otros medios.',
      ],
    },
    {
      heading: '2. Datos sensibles',
      paragraphs: [
        'Mi Libro Sorpresa no recaba datos personales sensibles, entendidos como aquellos que revelen origen étnico o racial, estado de salud, religión, preferencia sexual, opiniones políticas o afiliación sindical. Las preferencias de lectura no se consideran datos sensibles conforme a la ley aplicable.',
      ],
    },
    {
      heading: '3. Finalidades primarias del tratamiento',
      paragraphs: ['Trataremos sus datos personales para las siguientes finalidades primarias, necesarias para la existencia, operación y prestación del servicio:'],
      items: [
        'Crear, administrar y proteger su cuenta de usuario.',
        'Autenticar su identidad y mantener sesiones activas.',
        'Construir y mantener su perfil lector a partir de sus respuestas.',
        'Seleccionar, preparar y enviar el libro sorpresa y los elementos del paquete.',
        'Gestionar su pedido, el cobro a través de nuestro proveedor de pagos y los reembolsos cuando apliquen.',
        'Enviarle comunicaciones relacionadas con su pedido, envío y entrega.',
        'Recibir y procesar su feedback para mejorar futuras recomendaciones.',
        'Atender solicitudes de soporte, aclaraciones, seguridad y ejercicio de derechos.',
        'Prevenir accesos no autorizados, fraudes, abusos y uso indebido del servicio.',
        'Ejecutar procesos de baja de cuenta y depuración de información conforme a las reglas del servicio.',
      ],
    },
    {
      heading: '4. Finalidades secundarias',
      paragraphs: [
        'De manera adicional, podemos tratar sus datos para finalidades secundarias compatibles con el servicio, como mejorar la estabilidad, calidad y experiencia de uso, analizar fallas técnicas y documentar funcionalidades. En caso de que alguna finalidad secundaria requiera un consentimiento adicional conforme a la normatividad aplicable, se lo solicitaremos por separado cuando corresponda.',
      ],
    },
    {
      heading: '5. Cookies y herramientas de análisis',
      paragraphs: [
        'Podremos utilizar cookies propias y de terceros, así como herramientas de medición de audiencia y análisis de uso (por ejemplo, Google Analytics), para entender cómo se utiliza el servicio y mejorarlo. Estas herramientas pueden recabar información de uso como páginas visitadas, duración de la sesión, tipo de dispositivo y región aproximada, de forma anónima o agregada.',
        'Usted puede configurar su navegador para rechazar o eliminar las cookies, y podrá rechazar estas herramientas cuando se le ofrezca esa opción. Este aviso se actualizará cuando se habiliten o cambien dichas herramientas.',
      ],
    },
    {
      heading: '6. Transferencias y proveedores que intervienen en el tratamiento',
      paragraphs: [
        'Para la operación del servicio podemos apoyarnos en proveedores que intervienen como encargados del tratamiento. Entre ellos, de manera enunciativa más no limitativa:',
      ],
      items: [
        'Supabase: autenticación y base de datos.',
        'Stripe: procesamiento de pagos y reembolsos.',
        'Resend: envío de correos electrónicos transaccionales.',
        'Proveedores de mensajería y envío: para entregar el paquete, a quienes se les comparte el nombre, teléfono y dirección del destinatario.',
        'Proveedores de hosting e infraestructura, y, en su caso, herramientas de análisis.',
      ],
      closing: [
        'Estos terceros pueden tratar datos personales en calidad de encargados, bajo nuestras instrucciones o conforme a la relación técnica necesaria para prestar el servicio. No vendemos ni rentamos sus datos personales.',
        'Podremos compartir información cuando exista obligación legal, requerimiento de autoridad competente o necesidad de proteger nuestros derechos, la seguridad del servicio o la integridad de otros usuarios.',
      ],
    },
    {
      heading: '7. Medidas de seguridad',
      paragraphs: [
        'Implementamos medidas administrativas, técnicas y organizativas razonables para proteger sus datos personales contra daño, pérdida, alteración, destrucción o uso, acceso o tratamiento no autorizado, incluyendo cifrado en tránsito (HTTPS), reglas de acceso por usuario, mecanismos de hash para ciertos elementos de seguridad y proveedores especializados de infraestructura.',
        'Ningún sistema es completamente invulnerable, por lo que no podemos garantizar seguridad absoluta ni ausencia total de incidentes.',
      ],
    },
    {
      heading: '8. Conservación de datos',
      paragraphs: [
        'Conservaremos sus datos personales durante el tiempo necesario para cumplir las finalidades descritas en este aviso, mientras su cuenta permanezca activa o mientras exista una relación válida con usted, así como por el tiempo exigido por las obligaciones legales y fiscales aplicables.',
        'Al finalizar la relación, sus datos podrán entrar en procesos de bloqueo, supresión o depuración técnica conforme a nuestras capacidades operativas y obligaciones legales. Los registros de pedidos y pagos pueden conservarse durante los plazos legales, incluso después de la baja de la cuenta, en su caso de forma anonimizada.',
      ],
    },
    {
      heading: '9. Derechos ARCO y revocación del consentimiento',
      paragraphs: [
        'Usted tiene derecho a Acceder, Rectificar, Cancelar u Oponerse al tratamiento de sus datos personales, así como a revocar el consentimiento que haya otorgado para finalidades que legalmente admitan dicha revocación.',
        'Para ejercer sus derechos ARCO o solicitar información relacionada con este aviso, envíe un correo a hola@milibrosorpresa.com indicando al menos:',
      ],
      items: [
        'su nombre;',
        'el correo electrónico vinculado con su cuenta o un medio para responderle;',
        'el derecho que desea ejercer; y',
        'una descripción clara de su solicitud.',
      ],
      closing: [
        'Podremos solicitar información adicional para confirmar su identidad o la legitimidad de la representación con la que actúa. Atenderemos su solicitud dentro de los plazos establecidos por la ley, por regla general en un plazo máximo de 15 días hábiles, que podrá ampliarse por un período igual cuando las circunstancias lo justifiquen.',
      ],
    },
    {
      heading: '10. Limitación del uso o divulgación de sus datos',
      paragraphs: [
        'Usted puede solicitar la limitación del uso o divulgación de sus datos personales mediante correo a hola@milibrosorpresa.com. Atenderemos su solicitud en la medida en que sea técnica y legalmente procedente, sin afectar los tratamientos indispensables para la operación, seguridad o cumplimiento del servicio.',
      ],
    },
    {
      heading: '11. Menores de edad',
      paragraphs: [
        'El servicio está dirigido a personas mayores de edad y no está destinado a menores de 18 años. Si usted considera que un menor nos ha proporcionado datos personales sin autorización válida, contacte a hola@milibrosorpresa.com para revisar el caso.',
      ],
    },
    {
      heading: '12. Cambios al presente aviso de privacidad',
      paragraphs: [
        'Mi Libro Sorpresa puede modificar o actualizar este aviso de privacidad en cualquier momento, por ejemplo, por cambios legales, regulatorios, técnicos u operativos del servicio. Las modificaciones se publicarán en el sitio por medios razonables.',
      ],
    },
    {
      heading: '13. Consentimiento',
      paragraphs: [
        'Al crear una cuenta, utilizar el servicio o habilitar funcionalidades adicionales, usted reconoce haber leído el presente aviso de privacidad y, en su caso, otorga el consentimiento necesario para el tratamiento de sus datos conforme a las finalidades aquí descritas.',
      ],
    },
  ],
};

export const ELIMINACION: LegalDocument = {
  title: 'Eliminación de cuenta y datos',
  updatedAt: '2 de agosto de 2026',
  intro:
    'Puede solicitar la eliminación total de su cuenta o pedir apoyo para eliminar información específica asociada a su perfil. A continuación le explicamos cómo hacerlo.',
  sections: [
    {
      heading: '1. Cómo solicitar la eliminación de su cuenta',
      paragraphs: [
        'Para eliminar su cuenta, envíe un correo a hola@milibrosorpresa.com desde la dirección de correo con la que está registrado, o escríbanos por WhatsApp al +52 653 128 6373, indicando su nombre y la solicitud de eliminación.',
        'Para agilizar la atención le recomendamos incluir:',
      ],
      items: [
        'el correo electrónico de su cuenta;',
        'una descripción clara de la solicitud; y',
        'cualquier contexto adicional que nos ayude a identificar su caso.',
      ],
    },
    {
      heading: '2. Qué se elimina',
      paragraphs: ['Al procesar su solicitud eliminamos la información asociada a su perfil, incluyendo:'],
      items: [
        'su cuenta de usuario;',
        'su perfil lector;',
        'las respuestas de su cuestionario; y',
        'sus respuestas de feedback.',
      ],
    },
    {
      heading: '3. Qué conservamos y por qué',
      paragraphs: [
        'Podremos conservar ciertos datos por un tiempo limitado cuando sea necesario para cumplir obligaciones legales o fiscales, prevenir fraude o abuso, resolver controversias o mantener registros mínimos de seguridad o auditoría.',
        'En particular, los registros de pedidos y pagos pueden conservarse durante los plazos legales aplicables (por ejemplo, los plazos fiscales), en su caso de forma anonimizada, incluso después de la eliminación de su cuenta.',
      ],
    },
    {
      heading: '4. Plazo de atención',
      paragraphs: [
        'Revisaremos cada solicitud y le confirmaremos su atención en un plazo razonable, que por regla general no excederá de 15 días hábiles, sujeto a la validación de su identidad y a la viabilidad técnica y legal de cada caso.',
      ],
    },
    {
      heading: '5. Excepciones',
      paragraphs: [
        'La eliminación puede no ser posible o puede ser parcial cuando existan disputas activas, obligaciones legales pendientes, indicios de fraude o abuso, o cuando la información sea necesaria para proteger nuestros derechos o los de otros usuarios. En esos casos le informaremos las razones y el alcance de la conservación.',
      ],
    },
    {
      heading: '6. Aclaraciones',
      paragraphs: [
        'La eliminación de cierta información puede afectar funcionalidades del servicio o la continuidad de pedidos en curso. Si esto aplica a su caso, se lo informaremos durante la atención de su solicitud.',
      ],
    },
  ],
};
