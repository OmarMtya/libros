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
    text: 'Responde un cuestionario de 5 a 7 minutos. No necesitas saber describirte como lector: nosotros hacemos las preguntas.',
  },
  {
    number: '02',
    title: 'Construimos tu perfil lector',
    text: 'Ordenamos tus respuestas para entender qué ritmo, estilos, emociones y temas disfrutas.',
  },
  {
    number: '03',
    title: 'Investigamos y comparamos',
    text: 'El sistema compara candidatos, pero una persona investiga los finalistas y toma la decisión final.',
  },
  {
    number: '04',
    title: 'Recibes tu sorpresa',
    text: 'Preparamos tu libro, un separador y una carta que explica por qué elegimos esa historia.',
  },
];

const WHAT_YOU_GET: Array<{ icon: 'book' | 'letter' | 'bookmark' | 'box'; title: string; text: string }> = [
  {
    icon: 'book',
    title: 'Un libro físico',
    text: 'Una historia elegida a partir de tu perfil.',
  },
  {
    icon: 'letter',
    title: 'Una carta personalizada',
    text: 'Te contamos por qué elegimos esa historia y qué creemos que puedes descubrir en ella.',
  },
  {
    icon: 'bookmark',
    title: 'Un separador',
    text: 'Un pequeño detalle para acompañarte durante la lectura.',
  },
  {
    icon: 'box',
    title: 'Envío incluido',
    text: 'El precio ya lo incluye. Sin costos inesperados al final.',
  },
];

const PRICE_INCLUDES = [
  'Análisis de tu perfil lector.',
  'Selección humana del libro.',
  'Carta y separador.',
  'Envío incluido.',
  'Pago único.',
  'Sin suscripción.',
];

const FAQS = [
  {
    q: '¿El libro lo elige una inteligencia artificial o es al azar?',
    a: 'Ninguno de los dos. El sistema ordena tus preferencias y compara candidatos, pero una persona investiga y toma la decisión final.',
  },
  {
    q: '¿Puedo elegir el título?',
    a: 'La elección del título forma parte de la sorpresa. En el cuestionario podrás compartir lo que prefieres y lo que prefieres evitar.',
  },
  {
    q: '¿Necesito contratar una suscripción?',
    a: 'No. Es una compra única de $499 MXN y tú decides cuándo quieres repetir la experiencia.',
  },
  {
    q: '¿Qué sucede después de recibir el libro?',
    a: 'Léelo a tu ritmo. Cuando termines, puedes contarnos qué funcionó para afinar tus próximas recomendaciones.',
  },
  {
    q: '¿Pueden garantizar que el libro me encantará?',
    a: 'No sería honesto prometerlo: la lectura es personal. Lo que sí aseguramos es que cada libro se elige con investigación y cuidado.',
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
                Selección humana, con apoyo de datos
              </p>
              <h1 class="mb-6 max-w-[13ch] font-display text-[2.65rem] font-bold leading-[0.95] tracking-[-0.055em] text-ink sm:text-6xl lg:text-7xl">
                Tu próximo libro <span class="relative isolate whitespace-nowrap">no se elige al azar<span aria-hidden="true" class="absolute inset-x-0 bottom-1 -z-10 h-4 bg-marker/60 sm:h-5"></span></span>.
              </h1>
              <p class="mb-8 max-w-[46ch] text-lg leading-relaxed text-[#536875]">
                Cuéntanos cómo lees y qué buscas. Analizamos tus respuestas y una persona elige un libro sorpresa pensado para ti.
              </p>
              <div>
                <a routerLink="/app" class="{{ btnPrimary }} w-full sm:w-auto">
                  Descubrir mi próximo libro
                </a>
              </div>
              <p class="mt-7 font-mono text-[11px] uppercase tracking-[0.08em] text-[#567088]">
                Libro físico <span aria-hidden="true" class="text-marker">·</span> Pago único
                <span aria-hidden="true" class="text-marker">·</span> Sin suscripción
                <span aria-hidden="true" class="text-marker">·</span> Envío incluido
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
              <p class="mb-3 font-mono text-xs uppercase tracking-[0.08em] text-[#567088]">Cómo funciona</p>
              <h2 class="mb-4 font-display text-3xl font-bold leading-[1.02] tracking-[-0.04em] text-ink sm:text-5xl">
                De tus preferencias a una elección con sentido
              </h2>
              <p class="text-lg leading-relaxed text-[#536875]">
                Un cuestionario para conocerte y una persona que elige tu libro a partir de tus respuestas.
              </p>
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
                Comenzar mi cuestionario
              </a>
            </div>
          </div>
        </section>

        <section id="que-recibes" class="scroll-mt-24">
          <div class="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
            <div reveal class="mb-12 max-w-2xl">
              <p class="mb-3 font-mono text-xs uppercase tracking-[0.08em] text-[#567088]">Qué recibes</p>
              <h2 class="mb-4 font-display text-3xl font-bold leading-[1.02] tracking-[-0.04em] text-ink sm:text-5xl">
                Una experiencia pensada solo para ti.
              </h2>
            </div>

            <div class="grid gap-5 sm:grid-cols-2">
              @for (item of WHAT_YOU_GET; track item.title; let i = $index) {
                <article reveal [style.transition-delay.ms]="i * 70" class="rounded-sm border border-[#cad7df] bg-white p-7 sm:p-8">
                  <div class="mb-5 flex items-center justify-between">
                    <span class="flex h-11 w-11 items-center justify-center rounded-sm bg-[#eef3f6] text-ink">
                      @switch (item.icon) {
                        @case ('book') {
                          <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.6" aria-hidden="true">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                          </svg>
                        }
                        @case ('letter') {
                          <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.6" aria-hidden="true">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M3 6h18v12H3zM3 6l9 7 9-7" />
                          </svg>
                        }
                        @case ('bookmark') {
                          <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.6" aria-hidden="true">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M6 3h12v18l-6-4-6 4V3z" />
                          </svg>
                        }
                        @case ('box') {
                          <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.6" aria-hidden="true">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3zM4.5 7.5L12 12l7.5-4.5M12 12v9" />
                          </svg>
                        }
                      }
                    </span>
                    <span class="font-mono text-xs text-[#567088]">0{{ i + 1 }}</span>
                  </div>
                  <h3 class="mb-2 font-display text-xl font-bold tracking-[-0.02em] text-ink">{{ item.title }}</h3>
                  <p class="text-[#536875]">{{ item.text }}</p>
                </article>
              }
            </div>

            <div reveal class="mx-auto mt-12 max-w-4xl border-y border-marker/60 bg-marker/10 px-6 py-8 text-center sm:px-10">
              <p class="font-display text-xl font-bold leading-snug tracking-[-0.02em] text-ink sm:text-2xl">
                No enviamos sobrantes de inventario ni vendemos el mismo libro para todos.
              </p>
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
          <div class="relative mx-auto max-w-3xl px-4 py-24 text-center sm:px-6 lg:py-36">
            <p class="mb-8 font-mono text-xs uppercase tracking-[0.1em] text-mist">Nota de la editorial</p>
            <h2 class="font-display text-4xl font-bold leading-[1.02] tracking-[-0.045em] sm:text-6xl">
              Tal vez no sea el libro que habrías elegido.
            </h2>
            <p class="mt-4 font-display text-2xl font-bold leading-tight tracking-[-0.03em] text-coral sm:text-4xl">
              Esa es parte de la idea.
            </p>
            <p class="mx-auto mt-8 max-w-xl text-lg leading-relaxed text-[#c6d3de]">
              Queremos llevarte fuera de lo evidente, pero no lejos de ti. Encontrar ese punto en el que una lectura se
              siente nueva, inesperada y, al mismo tiempo, extrañamente adecuada.
            </p>
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
                  <p class="font-display text-6xl font-extrabold tracking-[-0.05em] text-ink sm:text-7xl">$499 MXN</p>
                  <p class="mx-auto mt-4 max-w-sm text-[#536875]">
                    Un libro elegido para ti y enviado a tu puerta.
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
                    Responder el cuestionario toma aproximadamente 5 a 7 minutos.
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
              Hay miles de libros esperando ser leídos.
            </h2>
            <p class="mx-auto mb-9 max-w-md text-lg text-[#536875]">
              Empecemos por encontrar uno que tenga una buena razón para llegar hasta ti.
            </p>
            <a routerLink="/app" class="{{ btnPrimary }}">
              Descubrir mi próximo libro
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
                Libros elegidos con datos, criterio y cuidado.
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
  readonly WHAT_YOU_GET = WHAT_YOU_GET;
  readonly PRICE_INCLUDES = PRICE_INCLUDES;
  readonly FAQS = FAQS;
  readonly FOOTER_LINKS = FOOTER_LINKS;

  readonly btnPrimary =
    'inline-flex items-center justify-center gap-2 rounded-sm bg-coral-deep px-6 py-3.5 text-base font-bold text-white transition hover:bg-coral active:scale-[0.97]';
  readonly btnDark =
    'inline-flex items-center justify-center gap-2 rounded-sm bg-ink px-6 py-3.5 text-base font-bold text-white transition hover:bg-ink-soft active:scale-[0.97]';
}
