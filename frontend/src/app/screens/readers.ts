import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ApiService, AdminUser } from '../api.service';
import { ToastService } from '../toast.service';

@Component({
  selector: 'app-readers',
  imports: [FormsModule, RouterLink],
  template: `
    <div class="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <p class="mb-2 font-mono text-xs uppercase tracking-[0.08em] text-[#567088]">Administración</p>
      <h1 class="mb-3 font-display text-4xl font-bold tracking-[-0.045em] text-ink sm:text-5xl">Fichas de lectores</h1>
      <p class="mb-8 text-[#536875]">Consulta el perfil calculado, respuestas, feedback, pedidos y dirección de cada persona.</p>

      <div class="mb-6 flex gap-3">
        <input
          [(ngModel)]="query"
          (keydown.enter)="loadUsers()"
          placeholder="Ej. ana@correo.com…"
          class="w-full max-w-sm rounded-sm border border-[#9eb2c1] bg-white px-3 py-2">
        <button
          class="rounded-sm bg-ink px-5 py-2 text-sm font-bold text-white transition hover:bg-ink-soft disabled:cursor-wait disabled:opacity-60"
          type="button"
          (click)="loadUsers()"
          [disabled]="loading()">
          Buscar personas
        </button>
      </div>

      @if (users().length > 0) {
        <div class="overflow-hidden rounded-sm border border-[#b9cad5] bg-white">
          @for (user of users(); track user.id) {
            <div class="flex items-center justify-between gap-4 border-b border-[#c9d7df] px-4 py-3">
              <button
                class="min-w-0 flex-1 text-left transition hover:text-coral"
                type="button"
                (click)="showUser(user)">
                <strong class="block text-ink">{{ user.displayName || user.email || 'Sin nombre' }}</strong>
                <small class="text-[#566e80]">{{ user.email }}</small>
              </button>
              <div class="flex shrink-0 flex-col items-end gap-1">
                <span class="font-mono text-xs text-[#566e80]">{{ user._count.orders }} pedidos · {{ user._count.readingFeedback }} opiniones</span>
                @if (user.readerProfile?.goodreadsUrl; as goodreadsUrl) {
                  <a class="text-xs font-semibold text-[#8a5a12] underline decoration-[#f2be45] underline-offset-2 hover:text-coral" [href]="goodreadsUrl" target="_blank" rel="noopener">Goodreads · pendiente de importar</a>
                }
                @if (user.readerProfile?.publicSlug; as slug) {
                  <a
                    class="text-sm font-semibold text-coral underline decoration-[#f2be45] underline-offset-2 transition hover:text-ink"
                    [routerLink]="['/app/perfil', slug]">
                    Ver perfil
                  </a>
                }
              </div>
            </div>
          }
        </div>
      } @else if (!loading()) {
        <p class="text-sm text-[#7d9ab0]">No se encontraron personas.</p>
      }

      @if (detail()) {
        <section class="mt-8 rounded-sm border border-[#cad7df] bg-white p-6">
          <h2 class="mb-4 font-display text-xl font-bold tracking-[-0.03em] text-ink">Ficha de {{ detailName() }}</h2>
          <textarea class="min-h-96 w-full rounded-sm border border-[#9eb2c1] bg-[#142c3e] p-3 font-mono text-xs text-[#e4eff5]" [value]="detail()!" readonly aria-label="JSON completo de la ficha administrativa"></textarea>
        </section>
      }
    </div>
  `,
})
export class Readers {
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);
  private readonly route = inject(ActivatedRoute);

  readonly users = signal<AdminUser[]>([]);
  readonly detail = signal<string | null>(null);
  readonly loading = signal(false);
  readonly detailName = signal('');
  query = '';
  private requestedUserId: string | null = null;

  constructor() {
    this.route.queryParams.subscribe((params) => {
      this.requestedUserId = params['userId'] ?? null;
      void this.loadUsers();
    });
  }

  async loadUsers(): Promise<void> {
    await this.run(async () => {
      this.users.set(await this.api.listAdminUsers(this.query));
      this.detail.set(null);
      if (this.requestedUserId) {
        const listed = this.users().find((user) => user.id === this.requestedUserId);
        if (listed) {
          await this.showUser(listed);
        } else {
          const user = await this.api.getAdminUser(this.requestedUserId) as { email?: string; displayName?: string };
          this.detail.set(JSON.stringify(user, null, 2));
          this.detailName.set(user.displayName || user.email || 'Sin nombre');
        }
      }
    });
  }

  async showUser(user: AdminUser): Promise<void> {
    await this.run(async () => {
      this.detail.set(JSON.stringify(await this.api.getAdminUser(user.id), null, 2));
      this.detailName.set(user.displayName || user.email || 'Sin nombre');
    });
  }

  private async run(operation: () => Promise<void>): Promise<void> {
    this.loading.set(true);
    try {
      await operation();
    } catch (error) {
      this.toast.error(error instanceof Error ? error.message : 'La operación no pudo completarse.');
    } finally {
      this.loading.set(false);
    }
  }
}
