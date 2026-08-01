import { Component, Directive, ElementRef, HostListener, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

const MEDIA = {
  heroPackage:
    'https://images.pexels.com/photos/34255056/pexels-photo-34255056.jpeg?auto=compress&cs=tinysrgb&w=1200',
  wrappingHands:
    'https://images.pexels.com/photos/4865725/pexels-photo-4865725.jpeg?auto=compress&cs=tinysrgb&w=1200',
  spotlightBook:
    'https://images.pexels.com/photos/1029141/pexels-photo-1029141.jpeg?auto=compress&cs=tinysrgb&w=1400',
  cozyBook:
    'https://images.pexels.com/photos/6958652/pexels-photo-6958652.jpeg?auto=compress&cs=tinysrgb&w=1200',
};

const NAV_LINKS = [
  { href: '#como-funciona', label: 'Cómo funciona' },
  { href: '#que-recibes', label: 'Qué recibes' },
  { href: '#nuestra-forma-de-elegir', label: 'Nuestra forma de elegir' },
  { href: '#preguntas-frecuentes', label: 'Preguntas frecuentes' },
];

const STEPS = [
  {
    number: '01',
    title: 'Cuéntanos cómo lees',
    text: 'Responde un cuestionario de aproximadamente 5 a 7 minutos. No necesitas recordar cien títulos ni saber describirte como lector. Nosotros hacemos las preguntas importantes.',
  },
  {
    number: '02',
    title: 'Construimos tu perfil lector',
    text: 'Organizamos tus respuestas para comprender aspectos como ritmo, profundidad, estilo, atmósfera, emociones, temas y nivel de descubrimiento.',
  },
  {
    number: '03',
    title: 'Investigamos y comparamos',
    text: 'El sistema nos ayuda a medir la compatibilidad entre tu perfil y diferentes libros. Después, una persona revisa los candidatos, investiga y toma la decisión final.',
  },
  {
    number: '04',
    title: 'Recibes tu sorpresa',
    text: 'Preparamos tu libro, un separador y una carta que explica por qué creemos que esa historia merece llegar a tus manos.',
  },
];

const WHAT_YOU_GET: Array<{ icon: 'book' | 'letter' | 'bookmark' | 'box'; title: string; text: string }> = [
  {
    icon: 'book',
    title: 'Un libro físico',
    text: 'Una historia seleccionada después de analizar tu perfil e investigar diferentes candidatos.',
  },
  {
    icon: 'letter',
    title: 'Una carta personalizada',
    text: 'Te contamos por qué elegimos ese libro, qué encontramos en tus respuestas y qué creemos que podrías descubrir en él.',
  },
  {
    icon: 'bookmark',
    title: 'Un separador',
    text: 'Un pequeño detalle para acompañarte durante la lectura.',
  },
  {
    icon: 'box',
    title: 'Envío incluido',
    text: 'El precio de la experiencia incluye el envío. No queremos que descubras un costo inesperado al final.',
  },
];

const VALUES = [
  {
    number: '01',
    title: 'Escuchamos antes de elegir',
    text: 'Una recomendación debe empezar por la persona, no por el inventario.',
  },
  {
    number: '02',
    title: 'Medimos sin reducirte a un número',
    text: 'Los datos nos ayudan a ordenar señales, pero nunca cuentan toda tu historia.',
  },
  {
    number: '03',
    title: 'Elegimos con responsabilidad',
    text: 'Cada libro debe tener una razón concreta para formar parte de tu experiencia.',
  },
  {
    number: '04',
    title: 'Aprendemos contigo',
    text: 'No buscamos acertar una vez por casualidad. Queremos comprender mejor tus lecturas con el tiempo.',
  },
];

const PRICE_INCLUDES = [
  'Un libro físico.',
  'Análisis de tu perfil lector.',
  'Investigación y curaduría humana.',
  'Separador.',
  'Carta personalizada.',
  'Envío incluido.',
  'Pago único.',
  'Sin suscripción.',
];

const FAQS = [
  {
    q: '¿El libro lo elige una inteligencia artificial?',
    a: 'No. Utilizamos un sistema para organizar tus preferencias y comparar distintos candidatos, pero una persona investiga las opciones y toma la decisión final.',
  },
  {
    q: '¿Puedo elegir el título?',
    a: 'La elección del título forma parte de la sorpresa. Durante el cuestionario podrás compartir tus preferencias, los libros que ya conoces y cualquier cosa que prefieras evitar.',
  },
  {
    q: '¿Es completamente al azar?',
    a: 'No. La sorpresa está en no conocer el título, no en recibir un libro escogido sin razones. Cada selección parte de tu perfil lector.',
  },
  {
    q: '¿Necesito contratar una suscripción?',
    a: 'No. Es una compra individual de $499 MXN. Después de la lectura, tú decides si quieres vivir nuevamente la experiencia.',
  },
  {
    q: '¿Qué sucede después de recibir el libro?',
    a: 'Puedes leerlo a tu ritmo. Cuando termines, tendrás la posibilidad de compartir tu experiencia para que conozcamos mejor tus preferencias en una futura compra.',
  },
  {
    q: '¿Pueden garantizar que el libro me encantará?',
    a: 'No sería honesto prometerlo. La lectura es personal y puede sorprender incluso al propio lector. Lo que sí garantizamos es que la elección tendrá una investigación y una intención detrás.',
  },
  {
    q: '¿Qué incluye el precio?',
    a: 'Incluye el libro físico, el análisis de tu perfil, la curaduría, el separador, la carta personalizada y el envío.',
  },
];

const FOOTER_LINKS = [
  { href: '#como-funciona', label: 'Cómo funciona' },
  { href: '#preguntas-frecuentes', label: 'Preguntas frecuentes' },
  { href: '#', label: 'Aviso de privacidad' },
  { href: '#', label: 'Términos y condiciones' },
  { href: '#', label: 'Contacto' },
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
        transition: opacity 0.7s ease, transform 0.7s ease;
      }
      .reveal.reveal-visible {
        opacity: 1;
        transform: none;
      }
    `,
  ],
  template: `
    <div class="min-h-screen overflow-x-hidden bg-paper pb-24 text-graphite md:pb-0">
      <header
        class="sticky top-0 z-40 border-b border-[#cad7df] bg-paper/95 backdrop-blur"
        (keydown.esc)="menuOpen.set(false)">
        <nav
          class="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6"
          aria-label="Navegación principal">
          <a
            href="#inicio"
            class="font-display text-xl font-extrabold tracking-[-0.03em] text-ink no-underline"
            aria-label="Libro Sorpresa, inicio">
            Libro <span class="relative inline-block isolate">Sorpresa</span>
          </a>

          <div class="hidden items-center gap-7 lg:flex">
            @for (link of NAV_LINKS; track link.href) {
              <a href="{{ link.href }}" class="text-sm font-semibold text-ink no-underline transition hover:text-coral">
                {{ link.label }}
              </a>
            }
          </div>

          <div class="flex items-center gap-3">
            <a
              routerLink="/app"
              class="hidden rounded-sm bg-coral-deep px-4 py-2.5 text-sm font-bold text-white transition hover:bg-coral md:inline-flex">
              Crear mi perfil lector
            </a>
            <button
              type="button"
              class="inline-flex h-11 w-11 items-center justify-center rounded-sm border border-[#7d9ab0] text-ink transition hover:bg-[#e6eef3] lg:hidden"
              [attr.aria-expanded]="menuOpen()"
              aria-controls="menu-movil"
              (click)="menuOpen.set(!menuOpen())">
              <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                @if (menuOpen()) {
                  <path stroke-linecap="round" d="M6 6l12 12M18 6L6 18" />
                } @else {
                  <path stroke-linecap="round" d="M4 7h16M4 12h16M4 17h16" />
                }
              </svg>
              <span class="sr-only">Abrir menú</span>
            </button>
          </div>
        </nav>

        @if (menuOpen()) {
          <div id="menu-movil" class="border-t border-[#cad7df] bg-paper px-4 pb-5 pt-3 lg:hidden">
            <div class="flex flex-col gap-1">
              @for (link of NAV_LINKS; track link.href) {
                <a
                  href="{{ link.href }}"
                  (click)="menuOpen.set(false)"
                  class="rounded-sm px-2 py-2.5 text-sm font-semibold text-ink no-underline hover:bg-[#e6eef3]">
                  {{ link.label }}
                </a>
              }
              <a
                routerLink="/app"
                (click)="menuOpen.set(false)"
                class="mt-2 rounded-sm bg-coral-deep px-4 py-3 text-center text-sm font-bold text-white transition hover:bg-coral">
                Crear mi perfil lector
              </a>
            </div>
          </div>
        }
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
                Curaduría humana apoyada por datos
              </p>
              <h1 class="mb-6 max-w-[13ch] font-display text-[2.65rem] font-bold leading-[0.95] tracking-[-0.055em] text-ink sm:text-6xl lg:text-7xl">
                Tu próximo libro <span class="relative isolate whitespace-nowrap">no se elige al azar<span aria-hidden="true" class="absolute inset-x-0 bottom-1 -z-10 h-4 bg-marker/60 sm:h-5"></span></span>.
              </h1>
              <p class="mb-8 max-w-[46ch] text-lg leading-relaxed text-[#536875]">
                Cuéntanos cómo lees, qué te mueve y qué buscas en este momento. Analizamos tus preferencias y hacemos una
                curaduría humana para enviarte un libro sorpresa elegido con intención.
              </p>
              <div class="flex flex-col gap-3 sm:flex-row sm:items-center">
                <a routerLink="/app" class="{{ btnPrimary }} w-full sm:w-auto">
                  Descubrir mi próximo libro
                </a>
                <a href="#como-funciona" class="{{ btnOutline }} w-full sm:w-auto">
                  Conocer cómo funciona
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
                class="absolute -left-3 -bottom-4 max-w-[230px] -rotate-3 rounded-sm border border-[#d8e1e8] bg-white p-4 shadow-[0_14px_34px_rgba(19,42,58,0.18)] sm:-left-10">
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

              <p aria-hidden="true" class="absolute -right-3 top-8 hidden -rotate-90 font-mono text-[11px] uppercase tracking-[0.14em] text-[#7d9ab0] lg:block">
                Selección manual — No azar
              </p>
            </div>
          </div>
        </section>

        <section class="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-24">
          <div reveal class="rounded-sm border border-[#cad7df] bg-white">
            <div class="flex justify-center gap-8 border-b border-[#e3eaef] bg-[#f2f6f9] py-3">
              <span aria-hidden="true" class="h-3.5 w-3.5 rounded-full border border-[#cad7df] bg-white"></span>
              <span aria-hidden="true" class="h-3.5 w-3.5 rounded-full border border-[#cad7df] bg-white"></span>
            </div>
            <div class="p-7 sm:p-12">
              <p class="mb-4 font-mono text-xs uppercase tracking-[0.08em] text-[#567088]">Nota de la editorial</p>
              <h2 class="mb-6 font-display text-3xl font-bold leading-[1.02] tracking-[-0.04em] text-ink sm:text-4xl">
                No es una caja misteriosa. Es una elección pensada para ti.
              </h2>
              <div class="space-y-4 text-base leading-relaxed text-[#536875] sm:text-lg">
                <p>
                  Muchas recomendaciones empiezan y terminan con una pregunta: “¿Cuál es tu género favorito?”. Nosotros
                  queremos conocer algo más profundo.
                </p>
                <p>
                  Queremos entender qué ritmo disfrutas, qué tipo de personajes recuerdas, cuánto deseas que una historia
                  te rete, qué emociones buscas y qué clase de descubrimiento estás dispuesto a vivir.
                </p>
              </div>
              <p class="mt-8 border-l-[3px] border-marker pl-4 font-display text-xl font-bold tracking-[-0.02em] text-ink sm:text-2xl">
                La sorpresa sigue existiendo. Lo que eliminamos es el azar sin intención.
              </p>
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
                Combinamos un perfil lector estructurado con investigación y criterio humano. Así convertimos tus
                respuestas en una recomendación que podemos explicar.
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

        <section id="nuestra-forma-de-elegir" class="border-y border-[#cad7df] bg-[#eef3f6] scroll-mt-24">
          <div class="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
            <div reveal class="mb-12 max-w-2xl">
              <p class="mb-3 font-mono text-xs uppercase tracking-[0.08em] text-[#567088]">Nuestra forma de elegir</p>
              <h2 class="mb-4 font-display text-3xl font-bold leading-[1.02] tracking-[-0.04em] text-ink sm:text-5xl">
                Matemáticas para comprender. Personas para decidir.
              </h2>
            </div>

            <div class="grid gap-6 lg:grid-cols-2">
              <article reveal class="rounded-sm border border-[#9eb2c1] bg-mist/30 p-7 sm:p-9">
                <p class="mb-4 font-mono text-xs uppercase tracking-[0.08em] text-[#567088]">Señales</p>
                <div aria-hidden="true" class="mb-7 flex h-14 items-end gap-2">
                  @for (bar of signalBars; track bar) {
                    <span class="w-3 rounded-sm bg-ink/25" [style.height.%]="bar"></span>
                  }
                </div>
                <h3 class="mb-3 font-display text-2xl font-bold tracking-[-0.02em] text-ink">
                  Un sistema que encuentra patrones
                </h3>
                <p class="leading-relaxed text-[#536875]">
                  Tus respuestas se convierten en señales que podemos comparar: cuánto valoras el desarrollo de
                  personajes, qué densidad narrativa disfrutas, cómo te relacionas con la ambigüedad o qué tan lejos
                  quieres salir de lo conocido.
                </p>
                <p class="mt-4 leading-relaxed text-[#536875]">
                  No usamos los datos para etiquetarte. Los usamos para hacer mejores preguntas y reducir las
                  recomendaciones genéricas.
                </p>
              </article>

              <article reveal class="overflow-hidden rounded-sm border border-[#cad7df] bg-white">
                <img
                  [src]="MEDIA.wrappingHands"
                  alt="Manos de una persona envolviendo con cuidado un libro con papel de regalo."
                  class="aspect-[16/9] w-full object-cover">
                <div class="p-7 sm:p-9">
                  <p class="mb-4 font-mono text-xs uppercase tracking-[0.08em] text-[#567088]">Criterio</p>
                  <h3 class="mb-3 font-display text-2xl font-bold tracking-[-0.02em] text-ink">
                    Una persona detrás de cada elección
                  </h3>
                  <p class="leading-relaxed text-[#536875]">
                    Una puntuación puede señalar buenos candidatos, pero no conoce por completo tu contexto ni puede
                    sustituir una decisión editorial.
                  </p>
                  <p class="mt-4 leading-relaxed text-[#536875]">
                    Por eso investigamos cada opción y elegimos manualmente el libro que recibirás.
                  </p>
                </div>
              </article>
            </div>

            <p reveal class="mx-auto mt-12 max-w-3xl text-center font-display text-2xl font-bold leading-snug tracking-[-0.02em] text-ink sm:text-3xl">
              <span class="relative inline-block isolate">El sistema orienta la búsqueda.<span aria-hidden="true" class="absolute inset-x-0 bottom-0 -z-10 h-3 bg-marker/60"></span></span>
              El criterio humano firma la elección.
            </p>
          </div>
        </section>

        <section id="que-recibes" class="scroll-mt-24">
          <div class="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
            <div reveal class="mb-12 max-w-2xl">
              <p class="mb-3 font-mono text-xs uppercase tracking-[0.08em] text-[#567088]">Qué recibes</p>
              <h2 class="mb-4 font-display text-3xl font-bold leading-[1.02] tracking-[-0.04em] text-ink sm:text-5xl">
                Una experiencia preparada para una sola persona: tú.
              </h2>
            </div>

            <div class="grid gap-5 sm:grid-cols-2">
              @for (item of WHAT_YOU_GET; track item.title; let i = $index) {
                <article reveal class="rounded-sm border border-[#cad7df] bg-white p-7 sm:p-8">
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
                No enviamos sobrantes de inventario. No seleccionamos al azar. No vendemos el mismo paquete para todos.
              </p>
            </div>
          </div>
        </section>

        <section class="border-y border-[#cad7df] bg-[#eef3f6]">
          <div class="mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 sm:px-6 sm:py-24 lg:grid-cols-2">
            <div reveal class="max-w-xl">
              <p class="mb-3 font-mono text-xs uppercase tracking-[0.08em] text-[#567088]">Aprender a leerte</p>
              <h2 class="mb-5 font-display text-3xl font-bold leading-[1.02] tracking-[-0.04em] text-ink sm:text-5xl">
                Tu perfil no termina con el cuestionario.
              </h2>
              <div class="space-y-4 text-[#536875]">
                <p>
                  Una persona puede disfrutar un libro por razones que ningún formulario habría anticipado. También puede
                  descubrir que algo que creía buscar no era tan importante como imaginaba.
                </p>
                <p>
                  Cuando termines de leer, podrás contarnos qué funcionó, qué no funcionó y qué te gustaría explorar
                  después.
                </p>
                <p>
                  Con cada experiencia, tu perfil puede volverse más preciso y más tuyo.
                </p>
              </div>
              <p class="mt-7 rounded-sm border-l-[3px] border-coral pl-4 font-display text-lg font-bold tracking-[-0.02em] text-ink">
                No necesitas una suscripción para continuar. Tú decides cuándo quieres recibir otro libro.
              </p>
            </div>
            <div reveal class="relative">
              <figure class="rounded-sm border border-[#cad7df] bg-white p-3 shadow-[0_18px_44px_rgba(19,42,58,0.14)]">
                <img
                  [src]="MEDIA.cozyBook"
                  alt="Una persona sosteniendo un libro en un momento de lectura tranquila."
                  class="aspect-[4/3] w-full object-cover">
              </figure>
            </div>
          </div>
        </section>

        <section>
          <div class="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
            <div reveal class="mb-12 max-w-2xl">
              <p class="mb-3 font-mono text-xs uppercase tracking-[0.08em] text-[#567088]">Manifiesto</p>
              <h2 class="mb-4 font-display text-3xl font-bold leading-[1.02] tracking-[-0.04em] text-ink sm:text-5xl">
                Nuestra manera de recomendar
              </h2>
            </div>

            <div class="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              @for (value of VALUES; track value.number) {
                <article reveal class="flex flex-col rounded-sm border border-[#cad7df] bg-white">
                  <div class="flex justify-center gap-6 border-b border-[#e3eaef] bg-[#f2f6f9] py-3">
                    <span aria-hidden="true" class="h-3 w-3 rounded-full border border-[#cad7df] bg-white"></span>
                    <span aria-hidden="true" class="h-3 w-3 rounded-full border border-[#cad7df] bg-white"></span>
                  </div>
                  <div class="flex flex-1 flex-col p-6">
                    <span class="mb-4 font-mono text-xs text-[#567088]">{{ value.number }}</span>
                    <h3 class="mb-3 font-display text-lg font-bold leading-tight tracking-[-0.02em] text-ink">
                      {{ value.title }}
                    </h3>
                    <p class="text-sm leading-relaxed text-[#536875]">{{ value.text }}</p>
                  </div>
                </article>
              }
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
            <p class="mb-8 font-mono text-xs uppercase tracking-[0.1em] text-mist">Nota del curador</p>
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
            <p class="mt-10 inline-block rounded-sm bg-marker px-4 py-2 font-display text-lg font-bold tracking-[-0.02em] text-ink">
              Una sorpresa con razones detrás.
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
                    Una experiencia completa de selección personalizada, preparada especialmente para ti.
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
              <p class="mb-3 font-mono text-xs uppercase tracking-[0.08em] text-[#567088]">Preguntas frecuentes</p>
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
                  <div class="border-t border-[#e3eaef] px-5 py-4 text-[#536875] sm:px-6">
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
              Libro Sorpresa — Elegimos historias pensando en quien las va a leer.
            </p>
          </div>
        </section>
      </div>

      <footer class="bg-ink text-white">
        <div class="mx-auto max-w-6xl px-4 py-14 sm:px-6">
          <div class="flex flex-col gap-10 md:flex-row md:items-start md:justify-between">
            <div>
              <p class="font-display text-2xl font-extrabold tracking-[-0.03em] text-white">
                Libro <span class="text-marker">Sorpresa</span>
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
                      href="{{ link.href }}"
                      (click)="$event.preventDefault()"
                      class="text-sm text-[#c6d3de] no-underline transition hover:text-white">
                      {{ link.label }}
                    </a>
                  </li>
                }
              </ul>
            </nav>
          </div>
          <div class="mt-12 flex flex-col items-start justify-between gap-3 border-t border-[#2b4a63] pt-6 font-mono text-xs uppercase tracking-[0.08em] text-[#8fa8bc] sm:flex-row sm:items-center">
            <p>Libro Sorpresa</p>
            <p>México</p>
          </div>
        </div>
      </footer>

      <div class="fixed inset-x-0 bottom-0 z-40 border-t border-[#cad7df] bg-white/95 px-4 py-3 backdrop-blur md:hidden">
        <a routerLink="/app" class="{{ btnPrimary }} w-full">
          Crear mi perfil lector
        </a>
      </div>

      <aside aria-hidden="true" class="fixed right-5 top-1/2 z-30 hidden -translate-y-1/2 flex-col items-center gap-3 lg:flex">
        <span class="font-mono text-[10px] uppercase tracking-[0.12em] text-[#567088]">Ficha</span>
        <div class="relative h-40 w-1 overflow-hidden rounded-full bg-[#dce5ec]">
          <div
            class="absolute inset-x-0 top-0 rounded-full bg-coral transition-[height] duration-150"
            [style.height.%]="progress()"></div>
        </div>
        <div class="flex flex-col items-center gap-2.5">
          @for (link of NAV_LINKS; track link.href) {
            <a href="{{ link.href }}" tabindex="-1" class="group relative">
              <span class="block h-2 w-2 rounded-full border border-[#7d9ab0] bg-paper transition group-hover:bg-coral"></span>
              <span class="absolute right-4 top-1/2 -translate-y-1/2 whitespace-nowrap rounded-sm border border-[#cad7df] bg-white px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em] text-ink opacity-0 transition group-hover:opacity-100">
                {{ link.label }}
              </span>
            </a>
          }
        </div>
      </aside>
    </div>
  `,
})
export class Landing {
  readonly MEDIA = MEDIA;
  readonly NAV_LINKS = NAV_LINKS;
  readonly STEPS = STEPS;
  readonly WHAT_YOU_GET = WHAT_YOU_GET;
  readonly VALUES = VALUES;
  readonly PRICE_INCLUDES = PRICE_INCLUDES;
  readonly FAQS = FAQS;
  readonly FOOTER_LINKS = FOOTER_LINKS;
  readonly signalBars = [35, 60, 45, 80, 55, 90, 70, 50, 75, 40, 65, 85];

  readonly menuOpen = signal(false);
  readonly progress = signal(0);

  @HostListener('window:scroll')
  onScroll(): void {
    const doc = document.documentElement;
    const max = doc.scrollHeight - window.innerHeight;
    const value = max > 0 ? (window.scrollY / max) * 100 : 0;
    this.progress.set(Math.min(100, Math.max(0, value)));
  }

  readonly btnPrimary =
    'inline-flex items-center justify-center gap-2 rounded-sm bg-coral-deep px-6 py-3.5 text-base font-bold text-white transition hover:bg-coral';
  readonly btnDark =
    'inline-flex items-center justify-center gap-2 rounded-sm bg-ink px-6 py-3.5 text-base font-bold text-white transition hover:bg-ink-soft';
  readonly btnOutline =
    'inline-flex items-center justify-center gap-2 rounded-sm border border-[#7d9ab0] px-6 py-3.5 text-base font-bold text-ink transition hover:bg-[#e6eef3]';
}
