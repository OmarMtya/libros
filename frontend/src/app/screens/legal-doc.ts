import { Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';

export interface LegalSection {
  heading?: string;
  paragraphs?: string[];
  items?: string[];
  closing?: string[];
}

export interface LegalDocument {
  title: string;
  updatedAt?: string;
  intro?: string;
  sections: LegalSection[];
}

@Component({
  selector: 'app-legal-shell',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="min-h-screen bg-paper text-graphite">
      <header class="sticky top-0 z-40 border-b border-[#cad7df] bg-paper/95 backdrop-blur">
        <nav class="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-4 sm:px-6" aria-label="Navegación">
          <a routerLink="/" class="font-display text-xl font-extrabold tracking-[-0.03em] text-ink no-underline">
            Mi Libro <span class="bg-coral px-1 py-0.5 text-white">Sorpresa</span>
          </a>
        </nav>
      </header>

      <main class="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
        <ng-content />
      </main>

      <footer class="border-t border-[#cad7df] bg-ink text-white">
        <div class="mx-auto max-w-3xl px-4 py-8 sm:px-6">
          <div class="flex flex-col items-start justify-between gap-3 font-mono text-xs uppercase tracking-[0.08em] text-[#8fa8bc] sm:flex-row sm:items-center">
            <p>Mi Libro Sorpresa</p>
            <p>México</p>
          </div>
        </div>
      </footer>
    </div>
  `,
})
export class LegalShell {}

@Component({
  selector: 'app-legal-doc',
  standalone: true,
  imports: [LegalShell],
  template: `
    <app-legal-shell>
      <p class="mb-3 font-mono text-xs uppercase tracking-[0.08em] text-[#567088]">Información legal</p>
      <h1 class="mb-3 font-display text-4xl font-bold leading-[1.02] tracking-[-0.04em] text-ink sm:text-5xl">
        {{ document.title }}
      </h1>
      @if (document.updatedAt) {
        <p class="mb-8 font-mono text-[11px] uppercase tracking-[0.08em] text-[#567088]">
          Fecha de última actualización: {{ document.updatedAt }}
        </p>
      }
      @if (document.intro) {
        <p class="mb-8 max-w-2xl text-[15px] leading-relaxed text-[#536875]">{{ document.intro }}</p>
      }

      @for (section of document.sections; track $index) {
        <section class="mb-10">
          @if (section.heading) {
            <h2 class="mb-3 font-display text-2xl font-bold tracking-[-0.02em] text-ink">{{ section.heading }}</h2>
          }
          @for (paragraph of section.paragraphs ?? []; track $index) {
            <p class="mb-3 max-w-2xl text-[15px] leading-relaxed text-[#536875]">{{ paragraph }}</p>
          }
          @if (section.items?.length) {
            <ul class="mt-2 space-y-2">
              @for (item of section.items; track $index) {
                <li class="flex items-start gap-2.5 text-[15px] leading-relaxed text-[#536875]">
                  <span aria-hidden="true" class="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-coral"></span>
                  <span>{{ item }}</span>
                </li>
              }
            </ul>
          }
          @for (paragraph of section.closing ?? []; track $index) {
            <p class="mb-3 mt-3 max-w-2xl text-[15px] leading-relaxed text-[#536875]">{{ paragraph }}</p>
          }
        </section>
      }
    </app-legal-shell>
  `,
})
export class LegalDoc {
  @Input() document!: LegalDocument;
}
