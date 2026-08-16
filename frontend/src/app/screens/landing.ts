import { Component, Directive, ElementRef, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

const MEDIA = {
  heroPackage:
    'https://images.pexels.com/photos/34255056/pexels-photo-34255056.jpeg?auto=compress&cs=tinysrgb&w=1200',
  spotlightBook:
    'https://images.pexels.com/photos/1029141/pexels-photo-1029141.jpeg?auto=compress&cs=tinysrgb&w=1400',
};

const STEPS = [
  {
    number: '01',
    title: 'Cuéntanos cómo lees',
    text: 'Responde un cuestionario breve sobre lo que disfrutas, lo que evitas y lo que esperas encontrar en una historia.',
  },
  {
    number: '02',
    title: 'Construimos tu perfil lector',
    text: 'Convertimos tus respuestas en preferencias claras sobre ritmo, personajes, emociones, complejidad, ambientación y otros aspectos de la lectura.',
  },
  {
    number: '03',
    title: 'Investigamos y comparamos',
    text: 'Buscamos distintos candidatos y analizamos qué tan bien podría responder cada uno a tu perfil.',
  },
  {
    number: '04',
    title: 'Una persona toma la decisión final',
    text: 'El perfil orienta la búsqueda, pero no elige automáticamente. Una persona investiga los mejores candidatos y selecciona el libro final.',
  },
  {
    number: '05',
    title: 'Cuéntanos cómo resultó',
    text: 'Cuando termines el libro, puedes compartir tu experiencia. La incorporamos a tu perfil lector.',
  },
];

const PRICE_INCLUDES = [
  'Un libro físico.',
  'Carta personalizada y separador.',
  'Envío incluido dentro de México.',
  'Pago único, sin suscripción y a tu ritmo.',
];

const FAQS = [
  {
    q: '¿Qué es Mi Libro Sorpresa?',
    a: 'Es un servicio de recomendación personalizada de libros. Construimos tu perfil lector a partir de un cuestionario sobre tus gustos y preferencias, y usamos esa información para seleccionar un libro físico especialmente para ti.',
  },
  {
    q: '¿El libro lo elige una inteligencia artificial?',
    a: 'Usamos un modelo de clasificación de lectores que convierte tus respuestas en señales sobre ritmo, personajes, emociones, complejidad, ambientación y otros aspectos de la lectura. El sistema ordena y compara candidatos; una persona revisa las mejores opciones, verifica que encajen contigo y toma la decisión final.',
  },
  {
    q: '¿Cómo se convierte mi cuestionario en una recomendación?',
    a: 'No nos limitamos a leer tus respuestas una por una. Las normalizamos y las convertimos en un perfil lector estructurado: preferencias, señales de afinidad y cosas que conviene evitar. Después comparamos ese perfil con la clasificación de cada libro disponible para construir una lista de candidatos con razones de compatibilidad.',
  },
  {
    q: '¿Puedo agregar más libros que ya leí?',
    a: 'Sí. Después de completar el cuestionario puedes ampliar tu estantería desde tu perfil e indicar si disfrutaste o no esos títulos. Usamos esa información para evitar repetir libros que ya conoces y para dar más contexto a futuras selecciones.',
  },
  {
    q: '¿Hay un humano leyendo mis respuestas?',
    a: 'Sí. Además de tu cuestionario inicial, nos interesa mucho lo que nos cuentas al terminar cada lectura. Usamos herramientas para ordenar y comparar toda esa información, pero la decisión final siempre la toma una persona: alguien de nuestro equipo revisa los candidatos y elige qué libro enviarte. No es todo automático ni todo manual; tus respuestas orientan la búsqueda y el perfil que construimos contigo es lo más valioso de la experiencia.',
  },
  {
    q: '¿Qué hace diferente esta experiencia de un club o una caja de libros?',
    a: 'No elegimos un solo libro para enviarlo a todos. Cada selección comienza con un perfil lector individual y con la búsqueda de candidatos que puedan encajar con esa persona. Además, acompañamos el envío con una carta que explica por qué elegimos ese título: el proceso es totalmente personal, de principio a fin.',
  },
  {
    q: '¿Mi perfil cambia con el tiempo?',
    a: 'Sí. Cuando termines una lectura podrás contarnos qué funcionó y qué no. Esa experiencia nos ayudará a afinar futuras selecciones.',
  },
  {
    q: '¿Puedo elegir el título?',
    a: 'No. Descubrir el título forma parte de la experiencia. En el cuestionario sí podrás contarnos qué buscas, qué prefieres evitar y qué libros ya conoces.',
  },
  {
    q: '¿Necesito contratar una suscripción?',
    a: 'No. Es una compra única de $499 MXN. Tú decides si quieres repetir la experiencia y cuándo hacerlo. Cada lectura nos ayuda a entender mejor tu perfil y a dar más valor a tus próximas selecciones.',
  },
  {
    q: '¿Hacen envíos fuera de México?',
    a: 'No. Solo enviamos dentro de México; por el momento no realizamos envíos internacionales.',
  },
  {
    q: '¿Qué sucede después de recibir el libro?',
    a: 'Léelo a tu ritmo. Cuando termines, podrás contarnos qué disfrutaste y qué no funcionó. Usaremos esa experiencia para conocer mejor tu forma de leer y orientar futuras selecciones.',
  },
  {
    q: '¿Pueden garantizar que el libro me encantará?',
    a: 'No sería honesto prometerlo. La lectura es personal. Lo que sí podemos garantizar es que el título será investigado y elegido a partir de tu perfil, no al azar ni como una recomendación genérica.',
  },
];

const FOOTER_LINKS = [
  { route: '/terminos-y-condiciones', label: 'Términos y condiciones' },
  { route: '/aviso-de-privacidad', label: 'Aviso de privacidad' },
  { route: '/eliminacion-de-cuenta-y-datos', label: 'Eliminación de cuenta y datos' },
  { route: '/contacto', label: 'Contacto' },
];

@Directive({
  selector: '[reveal]',
  standalone: true,
})
export class Reveal {
  private readonly el = inject(ElementRef<HTMLElement>);

  constructor() {
    const node = this.el.nativeElement;
    node.classList.add('reveal');
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            node.classList.add('reveal-visible');
            observer.disconnect();
          }
        }
      },
      { threshold: 0.12 },
    );
    observer.observe(node);
  }
}

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [RouterLink, Reveal],
  styles: [
    `
      .reveal {
        opacity: 0;
        transform: translateY(18px);
        transition: opacity 0.6s var(--ease-out), transform 0.6s var(--ease-out);
      }
      .reveal.reveal-visible {
        opacity: 1;
        transform: none;
      }
    `,
  ],
  template: `
    <div class="min-h-screen overflow-x-hidden bg-paper text-graphite">
      <header class="sticky top-0 z-40 border-b border-[#cad7df] bg-paper/95 backdrop-blur">
        <nav
          class="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6"
          aria-label="Navegación principal">
          <a
            href="#inicio"
            class="font-display text-xl font-extrabold tracking-[-0.03em] text-ink no-underline"
            aria-label="Mi Libro Sorpresa, inicio">
            Mi Libro <span class="bg-coral px-1 py-0.5 text-white">Sorpresa</span>
          </a>
        </nav>
      </header>

      <div>
        <section id="inicio" class="relative overflow-hidden scroll-mt-24">
          <div
            aria-hidden="true"
            class="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-mist/40 blur-3xl"></div>
          <div
            aria-hidden="true"
            class="pointer-events-none absolute left-[45%] top-[-30%] hidden h-40 w-24 rotate-[24deg] bg-marker/50 lg:block"></div>

          <div class="relative mx-auto grid max-w-6xl gap-14 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-2 lg:items-center lg:gap-20 lg:py-28">
            <div>
              <p class="mb-5 inline-flex items-center gap-2 rounded-sm border border-[#9eb2c1] bg-white px-3 py-1.5 font-mono text-[11px] font-medium uppercase tracking-[0.1em] text-ink">
                <span aria-hidden="true" class="h-1.5 w-1.5 rounded-full bg-coral"></span>
                 Un libro elegido a partir de ti
              </p>
              <h1 class="mb-6 max-w-[13ch] font-display text-[2.65rem] font-bold leading-[0.95] tracking-[-0.055em] text-ink sm:text-6xl lg:text-7xl">
                 Tu próximo libro no se elige para todos.<br><span class="relative isolate whitespace-nowrap">Se elige para ti<span aria-hidden="true" class="absolute inset-x-0 bottom-1 -z-10 h-4 bg-marker/60 sm:h-5"></span></span>.
              </h1>
              <p class="mb-8 max-w-[46ch] text-lg leading-relaxed text-[#536875]">
                 Tus respuestas se convierten en un perfil lector: qué te atrapa, qué te aburre, qué quieres sentir y qué prefieres evitar.<br><br>
                 Con ese perfil investigamos y comparamos libros hasta encontrar el candidato con mejores razones para encajar contigo.
              </p>
              <div>
                <a routerLink="/app" class="{{ btnPrimary }} w-full sm:w-auto">
                   Crear mi perfil lector
                </a>
              </div>
              <p class="mt-7 font-mono text-[11px] uppercase tracking-[0.08em] text-[#567088]">
                 Responder el cuestionario toma entre 5 y 7 minutos.
              </p>
            </div>

            <div reveal class="relative mx-auto w-full max-w-md lg:max-w-none">
              <figure class="relative rotate-[1.5deg] rounded-sm border border-[#cad7df] bg-white p-3 shadow-[0_24px_60px_rgba(19,42,58,0.16)]">
                <img
                  [src]="MEDIA.heroPackage"
                  alt="Libro envuelto y listo para enviarse, con el empaque de la experiencia."
                  class="aspect-[4/5] w-full object-cover sm:aspect-[5/5]">
                <figcaption class="mt-2 flex items-center justify-between px-1 font-mono text-[11px] uppercase tracking-[0.08em] text-[#567088]">
                  <span>Ejemplar en preparación</span>
                  <span>Ficha Nº 042</span>
                </figcaption>
              </figure>

              <div
                aria-hidden="true"
                class="absolute -left-3 bottom-12 max-w-[230px] -rotate-3 rounded-sm border border-[#d8e1e8] bg-white p-4 shadow-[0_14px_34px_rgba(19,42,58,0.18)] sm:-left-10">
                <div class="mb-2.5 flex items-center justify-between gap-3">
                  <span class="font-mono text-[10px] uppercase tracking-[0.08em] text-[#567088]">Carta personalizada</span>
                  <span class="h-2.5 w-2.5 rounded-full bg-coral"></span>
                </div>
                <div class="space-y-1.5">
                  <div class="h-1.5 w-full rounded bg-[#e3eaef]"></div>
                  <div class="h-1.5 w-11/12 rounded bg-[#e3eaef]"></div>
                  <div class="h-1.5 w-4/5 rounded bg-[#e3eaef]"></div>
                  <div class="h-1.5 w-3/5 rounded bg-marker/70"></div>
                </div>
              </div>

              <div aria-hidden="true" class="absolute -top-4 right-6 flex flex-col items-center sm:right-10">
                <div class="h-16 w-6 rounded-t-sm bg-marker shadow-[0_2px_8px_rgba(19,42,58,0.25)]"></div>
                <div class="h-3 w-6 bg-marker"></div>
              </div>
            </div>
          </div>
        </section>

        <section id="como-funciona" class="scroll-mt-24">
          <div class="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
            <div reveal class="mb-12 max-w-2xl">
               <p class="mb-3 font-mono text-xs uppercase tracking-[0.08em] text-[#567088]">De tus preferencias a una elección con sentido</p>
               <h2 class="mb-4 font-display text-3xl font-bold leading-[1.02] tracking-[-0.04em] text-ink sm:text-5xl">
                 No buscamos cualquier buen libro. Buscamos uno que tenga sentido para ti.
               </h2>
            </div>

            <ol class="mx-auto max-w-3xl">
              @for (step of STEPS; track step.number; let last = $last) {
                <li reveal class="flex gap-5">
                  <div class="flex flex-col items-center">
                    <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-coral-deep bg-white font-mono text-sm font-bold text-coral-deep">
                      {{ step.number }}
                    </span>
                    @if (!last) {
                      <span aria-hidden="true" class="mt-2 w-0.5 flex-1 bg-[#cad7df]"></span>
                    }
                  </div>
                  <article class="mb-8 flex-1 rounded-sm border border-[#cad7df] bg-white p-6 sm:p-8">
                    <h3 class="mb-2 font-display text-xl font-bold tracking-[-0.02em] text-ink sm:text-2xl">
                      Paso {{ step.number }} — {{ step.title }}
                    </h3>
                    <p class="text-[#536875]">{{ step.text }}</p>
                  </article>
                </li>
              }
            </ol>

            <div reveal class="mt-2 text-center">
              <a routerLink="/app" class="{{ btnDark }}">
                 Comenzar mi perfil lector
              </a>
            </div>
          </div>
        </section>

        <section class="relative overflow-hidden bg-ink text-white">
          <img
            [src]="MEDIA.spotlightBook"
            alt=""
            aria-hidden="true"
            class="absolute inset-0 h-full w-full object-cover opacity-20">
          <div aria-hidden="true" class="absolute inset-0 bg-gradient-to-b from-ink via-ink/70 to-ink"></div>
          <div class="relative mx-auto max-w-4xl px-4 py-16 sm:px-6 sm:py-24">
            <div reveal class="max-w-3xl">
              <p class="mb-3 font-mono text-xs uppercase tracking-[0.08em] text-mist">El cuestionario es solo el comienzo</p>
              <h2 class="mb-5 font-display text-3xl font-bold leading-[1.02] tracking-[-0.04em] text-white sm:text-5xl">
                Cada lectura puede ayudarnos a conocerte mejor.
              </h2>
              <p class="text-lg leading-relaxed text-[#c6d3de]">
                Las respuestas iniciales nos orientan. Tu experiencia con el libro nos da algo más valioso: saber qué ocurrió en una lectura concreta.<br><br>
                A veces una historia parece ideal en papel y no logra atraparnos; otras veces, un detalle inesperado se vuelve lo mejor de la lectura. Eso también forma parte de conocerte como lector.
              </p>
              <p class="mt-8 border-l-4 border-coral pl-5 font-display text-xl font-bold leading-snug tracking-[-0.02em] text-white sm:text-2xl">
                Tu primera selección nace de tus respuestas. Las siguientes se afinan con lo que nos cuentes al terminar.
              </p>
            </div>
          </div>
        </section>

        <section id="precio" class="relative overflow-hidden scroll-mt-24">
          <div
            aria-hidden="true"
            class="pointer-events-none absolute -left-24 top-10 h-72 w-72 rounded-full bg-mist/40 blur-3xl"></div>
          <div class="relative mx-auto max-w-2xl px-4 py-16 sm:px-6 sm:py-24">
            <div reveal class="overflow-hidden rounded-sm border border-[#cad7df] bg-white shadow-[0_24px_60px_rgba(19,42,58,0.12)]">
              <div aria-hidden="true" class="h-2 bg-coral"></div>
              <div class="p-7 sm:p-12">
                <div class="text-center">
                  <p class="mb-3 font-mono text-xs uppercase tracking-[0.08em] text-[#567088]">Experiencia única</p>
                  <h2 class="mb-5 font-display text-3xl font-bold tracking-[-0.04em] text-ink sm:text-4xl">
                    Tu próximo libro sorpresa
                  </h2>
                  <span
                    class="mb-4 inline-block bg-coral px-4 py-1.5 font-mono text-xs font-bold uppercase tracking-[0.14em] text-white shadow-[0_2px_6px_rgba(19,42,58,0.25)]">
                    Precio fundador
                  </span>
                  <p class="font-display text-6xl font-extrabold tracking-[-0.05em] text-ink sm:text-7xl">$499 MXN</p>
                  <p class="mx-auto mt-3 inline-block rounded-sm bg-[#fff0e6] px-3 py-1.5 font-mono text-xs font-bold uppercase tracking-[0.1em] text-coral-deep">
                    Oferta de lanzamiento
                  </p>
                  <p class="mx-auto mt-4 max-w-sm text-[#536875]">
                     Un libro elegido a partir de tu perfil y enviado a tu puerta.
                  </p>
                  <p class="mx-auto mt-3 max-w-sm rounded-sm bg-[#eef4f7] px-3 py-2 font-mono text-xs uppercase tracking-[0.08em] text-[#3e5a73]">
                     Solo envíos dentro de México
                  </p>
                  <p class="mx-auto mt-6 max-w-md font-display text-lg font-bold leading-snug tracking-[-0.02em] text-ink">
                    El valor de esta experiencia está en entender tu perfil, investigar alternativas y elegir con cuidado.
                  </p>
                </div>

                <ul class="mt-10 grid gap-x-6 gap-y-3 border-t border-[#e3eaef] pt-8 text-[#536875] sm:grid-cols-2">
                  @for (item of PRICE_INCLUDES; track item) {
                    <li class="flex items-start gap-2.5">
                      <span aria-hidden="true" class="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-coral-deep text-[11px] font-bold text-white">✓</span>
                      {{ item }}
                    </li>
                  }
                </ul>

                <div class="mt-10">
                  <a routerLink="/app" class="{{ btnPrimary }} w-full">
                    Crear mi perfil lector
                  </a>
                  <p class="mt-4 text-center text-sm text-[#567088]">
                     Responder el cuestionario toma aproximadamente entre 5 y 7 minutos.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="preguntas-frecuentes" class="scroll-mt-24">
          <div class="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-24">
            <div reveal class="mb-10 text-center">
              <h2 class="font-display text-3xl font-bold leading-[1.02] tracking-[-0.04em] text-ink sm:text-5xl">
                Preguntas frecuentes
              </h2>
            </div>

            <div class="space-y-3">
              @for (item of FAQS; track item.q; let i = $index) {
                <details reveal class="group rounded-sm border border-[#cad7df] bg-white">
                  <summary class="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 font-semibold text-ink sm:px-6 [&::-webkit-details-marker]:hidden">
                    <span>{{ item.q }}</span>
                    <span
                      aria-hidden="true"
                      class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[#7d9ab0] text-lg font-medium text-[#52636f] transition group-open:rotate-45 group-open:border-coral group-open:bg-coral group-open:text-white">
                      +
                    </span>
                  </summary>
                  <div class="faq-answer border-t border-[#e3eaef] px-5 py-4 text-[#536875] sm:px-6">
                    <p>{{ item.a }}</p>
                  </div>
                </details>
              }
            </div>
          </div>
        </section>

        <section class="border-t border-[#cad7df] bg-marker/15">
          <div class="mx-auto max-w-3xl px-4 py-20 text-center sm:px-6 sm:py-28">
            <h2 class="mb-5 font-display text-4xl font-bold leading-[1.0] tracking-[-0.045em] text-ink sm:text-6xl">
               Hay miles de buenos libros.
            </h2>
             <p class="mx-auto mb-4 max-w-xl font-display text-2xl font-bold leading-tight tracking-[-0.03em] text-ink sm:text-3xl">
               Busquemos uno que tenga buenas razones para ser el tuyo.
             </p>
             <p class="mx-auto mb-9 max-w-md text-lg text-[#536875]">
               Todo comienza conociendo cómo lees.
             </p>
             <a routerLink="/app" class="{{ btnPrimary }}">
               Crear mi perfil lector
            </a>
            <p class="mt-8 font-mono text-xs uppercase tracking-[0.08em] text-[#3e5a73]">
              Mi Libro Sorpresa — Elegimos historias pensando en quien las va a leer.
            </p>
          </div>
        </section>
      </div>

      <footer class="bg-ink text-white">
        <div class="mx-auto max-w-6xl px-4 py-14 sm:px-6">
          <div class="flex flex-col gap-10 md:flex-row md:items-start md:justify-between">
            <div>
              <p class="font-display text-2xl font-extrabold tracking-[-0.03em] text-white">
                Mi Libro <span class="bg-coral px-1 py-0.5 text-white">Sorpresa</span>
              </p>
              <p class="mt-3 max-w-xs text-sm leading-relaxed text-[#c6d3de]">
                 Elegimos historias pensando en quien las va a leer.
              </p>
            </div>
            <nav aria-label="Enlaces del pie de página">
              <ul class="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:gap-x-7">
                @for (link of FOOTER_LINKS; track link.label) {
                  <li>
                    <a
                      [routerLink]="link.route"
                      class="text-sm text-[#c6d3de] no-underline transition hover:text-white">
                      {{ link.label }}
                    </a>
                  </li>
                }
              </ul>
            </nav>
          </div>
          <div class="mt-12 flex flex-col items-start justify-between gap-3 border-t border-[#2b4a63] pt-6 font-mono text-xs uppercase tracking-[0.08em] text-[#8fa8bc] sm:flex-row sm:items-center">
            <p>Mi Libro Sorpresa</p>
            <p>México</p>
          </div>
        </div>
      </footer>
    </div>
  `,
})
export class Landing {
  readonly MEDIA = MEDIA;
  readonly STEPS = STEPS;
  readonly PRICE_INCLUDES = PRICE_INCLUDES;
  readonly FAQS = FAQS;
  readonly FOOTER_LINKS = FOOTER_LINKS;

  readonly btnPrimary =
    'inline-flex items-center justify-center gap-2 rounded-sm bg-coral-deep px-6 py-3.5 text-base font-bold text-white transition hover:bg-coral active:scale-[0.97]';
  readonly btnDark =
    'inline-flex items-center justify-center gap-2 rounded-sm bg-ink px-6 py-3.5 text-base font-bold text-white transition hover:bg-ink-soft active:scale-[0.97]';
}
