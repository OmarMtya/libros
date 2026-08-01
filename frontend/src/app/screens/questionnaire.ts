import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiService, BookResult, Question, Session, Tag } from '../api.service';
import { AuthService } from '../auth.service';
import { DISLIKED_BOOK_REASONS, LOVED_BOOK_ASPECTS, TAG_LABELS, TAG_TYPE_LABELS } from '../labels';
import { rankingDisabled, rankingPosition, toggleRankingSelection } from '../ranking-utils';
import { ToastService } from '../toast.service';

type TagGroup = 'liked' | 'curious' | 'notInterested';

const TOTAL_QUESTIONS = 16;

@Component({
  selector: 'app-questionnaire',
  imports: [FormsModule],
  template: `
    <div class="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      @if (alreadyCompleted()) {
        <section class="rounded-sm border border-[#cad7df] bg-white p-8 text-center">
          <p class="mb-2 font-mono text-xs uppercase tracking-[0.08em] text-[#567088]">Tu ficha de lectura</p>
          <h1 class="mb-3 font-display text-3xl font-bold tracking-[-0.04em] text-ink">Ya completaste tu cuestionario</h1>
          <p class="mx-auto mb-6 max-w-md text-[#536875]">
            Puedes volver a responder cuando quieras. Al hacerlo, tus respuestas anteriores se descartan y
            tu perfil se vuelve a calcular desde cero.
          </p>
          <button
            class="rounded-sm bg-coral px-6 py-3 text-sm font-bold text-white transition hover:bg-coral-deep disabled:cursor-wait disabled:opacity-60"
            type="button"
            (click)="redoQuestionnaire()"
            [disabled]="loading()">
            Quiero rehacerlo
          </button>
          <p class="mt-4"><a routerLink="/app" class="text-sm font-semibold text-ink underline hover:text-coral">Volver al inicio</a></p>
        </section>
      } @else if (question(); as current) {
        <section class="rounded-sm border border-[#cad7df] bg-white p-6 sm:p-10">
          <div class="mb-8">
            <div class="mb-2 flex items-center justify-between gap-4">
              <p class="font-mono text-xs uppercase tracking-[0.08em] text-[#567088]">Construyendo tu perfil</p>
              <p class="font-mono text-xs text-[#7d9ab0]">Pregunta {{ position() }} de {{ totalQuestions() }}</p>
            </div>
            <div class="h-1.5 w-full overflow-hidden rounded-full bg-mist/50" role="progressbar" [attr.aria-valuenow]="progress()" aria-valuemin="0" aria-valuemax="100">
              <div class="h-full rounded-full bg-coral transition-all duration-300" [style.width.%]="progress()"></div>
            </div>
          </div>

          <h1 class="mb-8 font-display text-2xl font-bold tracking-[-0.03em] text-ink sm:text-3xl">{{ current.text }}</h1>
          @if (!current.isRequired) {
            <p class="-mt-5 mb-8 text-xs font-semibold uppercase tracking-wider text-[#7d9ab0]">Opcional</p>
          }

          @if (current.questionKey === 'Q01_LOVED_BOOKS') {
            <div class="space-y-5">
              <div class="relative">
                <input
                  [(ngModel)]="lovedBookQuery"
                  (ngModelChange)="onBookQuery('loved')"
                  placeholder="Busca un título (ej. la sombra del viento)"
                  class="w-full rounded-sm border border-[#9eb2c1] bg-white px-3 py-2"
                  [disabled]="lovedBooks.length >= (current.validation?.maxItems ?? 20)">
                @if (lovedBookResults().length > 0 && lovedBookQuery && !lovedSearch().loading && !lovedSearch().error) {
                  <ul class="absolute z-10 mt-1 max-h-60 w-full overflow-y-auto rounded-sm border border-[#9eb2c1] bg-white">
                    @for (book of lovedBookResults(); track book.openLibraryId) {
                      <li>
                        <button type="button" (click)="addLovedBook(book)" class="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-[#eaf1f6]">
                          @if (book.coverUrl) { <img [src]="book.coverUrl" alt="" class="h-12 w-8 shrink-0 object-cover"> } @else {
                            <div class="flex h-12 w-8 shrink-0 items-center justify-center border border-[#cad7df] bg-[#f2f6f9]">
                              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-4 text-[#9eb2c1]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/></svg>
                            </div>
                          }
                          <span>
                            {{ book.title }}@if (book.authors.length) { — {{ book.authors.join(', ') }} }@if (book.firstPublishYear) { ({{ book.firstPublishYear }}) }
                          </span>
                        </button>
                      </li>
                    }
                  </ul>
                }
              </div>
              @if (lovedBookQuery && lovedSearch().loading) {
                <p class="mt-2 flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-[#7d9ab0]">
                  <svg class="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                  Buscando…
                </p>
              }
              @if (lovedBookQuery && lovedSearch().error) {
                <div class="mt-2 flex items-center justify-between gap-3 rounded-sm border-l-[3px] border-coral bg-[#fbe9e6] px-3 py-2">
                  <p class="text-sm text-[#7a2c1f]">{{ lovedSearch().error }}</p>
                  <button type="button" (click)="retryBookSearch('loved')" class="shrink-0 rounded-sm border border-[#7a2c1f] px-3 py-1 text-xs font-bold text-[#7a2c1f] transition hover:bg-[#f3d6cf]">Reintentar</button>
                </div>
              }

              <div class="space-y-4">
                @for (book of lovedBooks; track book.openLibraryId) {
                  <div id="loved-book-{{ book.openLibraryId }}" class="rounded-sm border border-[#cad7df] p-4">
                    <div class="flex items-start justify-between gap-3">
                      <div class="flex items-start gap-3">
                        @if (book.coverUrl) { <img [src]="book.coverUrl" alt="" class="h-14 w-10 object-cover"> } @else {
                          <div class="flex h-14 w-10 shrink-0 items-center justify-center border border-[#cad7df] bg-[#f2f6f9]">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-5 text-[#9eb2c1]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/></svg>
                          </div>
                        }
                        <div>
                          <p class="font-semibold text-ink">{{ book.title }}</p>
                          @if (book.authors.length) { <p class="text-sm text-[#536875]">{{ book.authors.join(', ') }}</p> }
                        </div>
                      </div>
                      <button type="button" (click)="removeLovedBook(book.openLibraryId)" class="text-lg leading-none text-[#7d9ab0] hover:text-coral" aria-label="Quitar {{ book.title }}">×</button>
                    </div>
                    <p class="mt-3 text-sm font-semibold text-ink">¿Qué te gustó de este libro?</p>
                    <div class="mt-2 flex flex-wrap gap-2">
                      @for (aspect of lovedBookAspectsList; track aspect.key) {
                        <button
                          type="button"
                          class="rounded-full border px-3 py-1 text-sm transition"
                          [class.bg-ink]="hasLovedBookAspect(book.openLibraryId, aspect.key)"
                          [class.text-white]="hasLovedBookAspect(book.openLibraryId, aspect.key)"
                          [class.border-ink]="hasLovedBookAspect(book.openLibraryId, aspect.key)"
                          [class.bg-white]="!hasLovedBookAspect(book.openLibraryId, aspect.key)"
                          [class.border-[#7d9ab0]]="!hasLovedBookAspect(book.openLibraryId, aspect.key)"
                          (click)="toggleLovedBookAspect(book.openLibraryId, aspect.key)">{{ aspect.label }}</button>
                      }
                    </div>
                  </div>
                }
              </div>
              <p class="text-sm text-[#7d9ab0]">{{ lovedBooks.length }} / {{ current.validation?.maxItems ?? 20 }} libros (mínimo {{ current.validation?.minItems ?? 3 }})</p>
            </div>
          } @else if (current.questionKey === 'Q02_DISLIKED_BOOK') {
            <div class="space-y-5">
              <div class="relative">
                <input
                  [(ngModel)]="dislikedBookQuery"
                  (ngModelChange)="onBookQuery('disliked')"
                  placeholder="Busca un título que no te haya gustado"
                  class="w-full rounded-sm border border-[#9eb2c1] bg-white px-3 py-2"
                  [disabled]="dislikedBooks.length >= (current.validation?.maxItems ?? 20)">
                @if (dislikedBookResults().length > 0 && dislikedBookQuery && !dislikedSearch().loading && !dislikedSearch().error) {
                  <ul class="absolute z-10 mt-1 max-h-60 w-full overflow-y-auto rounded-sm border border-[#9eb2c1] bg-white">
                    @for (book of dislikedBookResults(); track book.openLibraryId) {
                      <li>
                        <button type="button" (click)="addDislikedBook(book)" class="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-[#eaf1f6]">
                          @if (book.coverUrl) { <img [src]="book.coverUrl" alt="" class="h-12 w-8 shrink-0 object-cover"> } @else {
                            <div class="flex h-12 w-8 shrink-0 items-center justify-center border border-[#cad7df] bg-[#f2f6f9]">
                              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-4 text-[#9eb2c1]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/></svg>
                            </div>
                          }
                          <span>
                            {{ book.title }}@if (book.authors.length) { — {{ book.authors.join(', ') }} }@if (book.firstPublishYear) { ({{ book.firstPublishYear }}) }
                          </span>
                        </button>
                      </li>
                    }
                  </ul>
                }
              </div>
              @if (dislikedBookQuery && dislikedSearch().loading) {
                <p class="mt-2 flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-[#7d9ab0]">
                  <svg class="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                  Buscando…
                </p>
              }
              @if (dislikedBookQuery && dislikedSearch().error) {
                <div class="mt-2 flex items-center justify-between gap-3 rounded-sm border-l-[3px] border-coral bg-[#fbe9e6] px-3 py-2">
                  <p class="text-sm text-[#7a2c1f]">{{ dislikedSearch().error }}</p>
                  <button type="button" (click)="retryBookSearch('disliked')" class="shrink-0 rounded-sm border border-[#7a2c1f] px-3 py-1 text-xs font-bold text-[#7a2c1f] transition hover:bg-[#f3d6cf]">Reintentar</button>
                </div>
              }

              <div class="space-y-4">
                @for (book of dislikedBooks; track book.openLibraryId) {
                  <div id="disliked-book-{{ book.openLibraryId }}" class="rounded-sm border border-[#cad7df] p-4">
                    <div class="flex items-start justify-between gap-3">
                      <div class="flex items-start gap-3">
                        @if (book.coverUrl) { <img [src]="book.coverUrl" alt="" class="h-14 w-10 object-cover"> } @else {
                          <div class="flex h-14 w-10 shrink-0 items-center justify-center border border-[#cad7df] bg-[#f2f6f9]">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-5 text-[#9eb2c1]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/></svg>
                          </div>
                        }
                        <div>
                          <p class="font-semibold text-ink">{{ book.title }}</p>
                          @if (book.authors.length) { <p class="text-sm text-[#536875]">{{ book.authors.join(', ') }}</p> }
                        </div>
                      </div>
                      <button type="button" (click)="removeDislikedBook(book.openLibraryId)" class="text-lg leading-none text-[#7d9ab0] hover:text-coral" aria-label="Quitar {{ book.title }}">×</button>
                    </div>
                    <p class="mt-3 text-sm font-semibold text-ink">¿Qué no funcionó?</p>
                    <div class="mt-2 flex flex-wrap gap-2">
                      @for (reason of dislikedReasons; track reason.key) {
                        <button
                          type="button"
                          class="rounded-full border px-3 py-1 text-sm transition"
                          [class.bg-coral]="hasDislikedBookReason(book.openLibraryId, reason.key)"
                          [class.text-white]="hasDislikedBookReason(book.openLibraryId, reason.key)"
                          [class.border-coral]="hasDislikedBookReason(book.openLibraryId, reason.key)"
                          [class.bg-white]="!hasDislikedBookReason(book.openLibraryId, reason.key)"
                          [class.border-[#7d9ab0]]="!hasDislikedBookReason(book.openLibraryId, reason.key)"
                          (click)="toggleDislikedBookReason(book.openLibraryId, reason.key)">{{ reason.label }}</button>
                      }
                    </div>
                    <label class="mt-3 block">
                      <span class="text-sm font-semibold text-ink">Detalle opcional</span>
                      <input [(ngModel)]="dislikedBookReasonTexts[book.openLibraryId]" placeholder="Explica brevemente si quieres" class="mt-1 w-full rounded-sm border border-[#9eb2c1] bg-white px-3 py-2">
                    </label>
                  </div>
                }
              </div>
              <p class="text-sm text-[#7d9ab0]">{{ dislikedBooks.length }} / {{ current.validation?.maxItems ?? 20 }} libros (mínimo {{ current.validation?.minItems ?? 3 }})</p>
            </div>
          } @else if (current.responseType === 'scale') {
            <div class="flex gap-2 sm:gap-3">
              @for (value of [1, 2, 3, 4, 5]; track value) {
                <button
                  type="button"
                  class="h-14 flex-1 rounded-sm border text-lg font-bold transition"
                  [class.bg-coral]="scaleValue === value"
                  [class.border-coral]="scaleValue === value"
                  [class.text-white]="scaleValue === value"
                  [class.border-[#9eb2c1]]="scaleValue !== value"
                  [class.bg-white]="scaleValue !== value"
                  [class.text-ink]="scaleValue !== value"
                  [attr.aria-pressed]="scaleValue === value"
                  (click)="scaleValue = value">{{ value }}</button>
              }
            </div>
            <p class="mt-2 text-xs text-[#567088]">1 = Muy poco · 5 = Mucho</p>
          } @else if (current.questionKey === 'Q07_COMPLEXITY') {
            <div class="space-y-6">
              <div>
                <p class="mb-2 text-sm font-semibold text-ink">Lenguaje</p>
                <div class="flex gap-2 sm:gap-3">
                  @for (value of [1, 2, 3, 4, 5]; track value) {
                    <button type="button" class="h-12 flex-1 rounded-sm border text-sm font-bold transition"
                      [class.bg-coral]="complexity.linguistic === value" [class.border-coral]="complexity.linguistic === value" [class.text-white]="complexity.linguistic === value"
                      [class.border-[#9eb2c1]]="complexity.linguistic !== value" [class.bg-white]="complexity.linguistic !== value" [class.text-ink]="complexity.linguistic !== value"
                      (click)="complexity.linguistic = value">{{ value }}</button>
                  }
                </div>
              </div>
              <div>
                <p class="mb-2 text-sm font-semibold text-ink">Estructura</p>
                <div class="flex gap-2 sm:gap-3">
                  @for (value of [1, 2, 3, 4, 5]; track value) {
                    <button type="button" class="h-12 flex-1 rounded-sm border text-sm font-bold transition"
                      [class.bg-coral]="complexity.structural === value" [class.border-coral]="complexity.structural === value" [class.text-white]="complexity.structural === value"
                      [class.border-[#9eb2c1]]="complexity.structural !== value" [class.bg-white]="complexity.structural !== value" [class.text-ink]="complexity.structural !== value"
                      (click)="complexity.structural = value">{{ value }}</button>
                  }
                </div>
              </div>
              <p class="text-xs text-[#567088]">1 = Muy sencillo · 5 = Muy exigente</p>
            </div>
          } @else if (current.responseType === 'ranking') {
            <div class="space-y-3">
              @for (option of current.options; track option.key) {
                <button
                  type="button"
                  class="flex w-full items-center gap-3 rounded-sm border px-4 py-3 text-left transition disabled:cursor-not-allowed"
                  [class.border-coral]="isSelected(option.key)"
                  [class.bg-[#fdf3f0]]="isSelected(option.key)"
                  [class.border-[#9eb2c1]]="!isSelected(option.key)"
                  [class.bg-white]="!isSelected(option.key)"
                  [class.opacity-40]="rankingDisabled(option.key)"
                  [attr.aria-pressed]="isSelected(option.key)"
                  [attr.aria-label]="rankingAriaLabel(option)"
                  [disabled]="rankingDisabled(option.key)"
                  (click)="toggleRanking(option.key)">
                  <span class="flex h-7 w-7 shrink-0 items-center justify-center rounded-sm text-sm font-bold transition"
                    [class.bg-coral]="isSelected(option.key)"
                    [class.text-white]="isSelected(option.key)"
                    [class.border]="!isSelected(option.key)"
                    [class.border-[#9eb2c1]]="!isSelected(option.key)"
                    [class.text-[#7d9ab0]]="!isSelected(option.key)">
                    @if (rankingPosition(option.key) > 0) { {{ rankingPosition(option.key) }} }
                  </span>
                  <span class="font-medium text-ink">{{ option.label }}</span>
                </button>
              }
            </div>
            <div class="mt-5">
              <p class="mb-2 text-sm font-semibold text-ink">Tu orden</p>
              @if (selectedKeys.length === 0) {
                <p class="text-sm text-[#536875]">Ninguna seleccionada.</p>
              } @else {
                <div class="flex flex-wrap gap-2">
                  @for (selectedKey of selectedKeys; track selectedKey; let index = $index) {
                    <span class="inline-flex items-center gap-2 rounded-full border border-[#7d9ab0] bg-[#eef3f6] px-3 py-1 text-sm font-semibold text-ink">
                      <span class="flex h-5 w-5 items-center justify-center rounded-full bg-ink text-xs font-bold text-white">{{ index + 1 }}</span>
                      {{ rankingLabel(selectedKey) }}
                    </span>
                  }
                </div>
              }
            </div>
          } @else if (current.responseType === 'single_select' || current.responseType === 'multi_select') {
            <div class="space-y-3">
              @for (option of current.options; track option.key) {
                <button
                  type="button"
                  class="flex w-full items-center gap-3 rounded-sm border px-4 py-3 text-left transition disabled:cursor-not-allowed"
                  [class.border-coral]="isSelected(option.key)"
                  [class.bg-[#fdf3f0]]="isSelected(option.key)"
                  [class.border-[#9eb2c1]]="!isSelected(option.key)"
                  [class.bg-white]="!isSelected(option.key)"
                  [class.opacity-40]="selectionDisabled(option.key)"
                  [attr.aria-pressed]="isSelected(option.key)"
                  [disabled]="selectionDisabled(option.key)"
                  (click)="toggleSelection(option.key)">
                  <span class="flex h-5 w-5 shrink-0 items-center justify-center rounded-sm border"
                    [class.border-coral]="isSelected(option.key)" [class.bg-coral]="isSelected(option.key)"
                    [class.border-[#9eb2c1]]="!isSelected(option.key)">
                    @if (isSelected(option.key)) { <span class="text-xs text-white">✓</span> }
                  </span>
                  <span class="font-medium text-ink">{{ option.label }}</span>
                </button>
              }
            </div>
          } @else if (current.questionKey === 'Q11_GENRES_THEMES') {
            <div class="space-y-6">
              @for (group of tagGroups; track group.key) {
                <div>
                  <label class="block text-sm font-semibold text-ink">{{ group.label }}@if (group.max) { (hasta {{ group.max }}) }</label>
                  <input
                    [(ngModel)]="tagQueries[group.key]"
                    (focus)="activeTagGroup = group.key"
                    placeholder="Busca una etiqueta"
                    class="mt-1 w-full rounded-sm border border-[#9eb2c1] bg-white px-3 py-2">
                  @if (activeTagGroup === group.key && tagMatches(group.key).length > 0) {
                    <ul class="mt-1 max-h-48 overflow-y-auto rounded-sm border border-[#9eb2c1] bg-white">
                      @for (tag of tagMatches(group.key); track tag.tagKey) {
                        <li>
                          <button type="button" (click)="selectTag(group.key, tag)" class="block w-full px-3 py-2 text-left text-sm hover:bg-[#eaf1f6]">
                            {{ tagLabel(tag) }} <small class="text-[#7d9ab0]">({{ tagTypeLabel(tag) }})</small>
                          </button>
                        </li>
                      }
                    </ul>
                  }
                  @if (selectedTags(group.key).length > 0) {
                    <div class="mt-2 flex flex-wrap gap-2">
                      @for (tag of selectedTags(group.key); track tag.tagKey) {
                        <span class="inline-flex items-center gap-1 rounded-full bg-[#eef3f6] px-3 py-1 text-sm text-ink">
                          {{ tagLabel(tag) }}
                          <button type="button" class="text-[#52636f] hover:text-coral" aria-label="Quitar {{ tagLabel(tag) }}" (click)="removeTag(group.key, tag.tagKey)">×</button>
                        </span>
                      }
                    </div>
                  }
                </div>
              }
            </div>
          } @else if (current.questionKey === 'Q12_LENGTH_SERIES') {
            <div class="space-y-5">
              <div class="grid grid-cols-2 gap-4">
                <label class="block">
                  <span class="text-sm font-semibold text-ink">Páginas mínimas</span>
                  <input type="number" [(ngModel)]="lengthSeries.minPages" class="mt-1 w-full rounded-sm border border-[#9eb2c1] bg-white px-3 py-2">
                </label>
                <label class="block">
                  <span class="text-sm font-semibold text-ink">Páginas máximas</span>
                  <input type="number" [(ngModel)]="lengthSeries.maxPages" class="mt-1 w-full rounded-sm border border-[#9eb2c1] bg-white px-3 py-2">
                </label>
              </div>
              <p class="text-sm text-[#536875]">Un libro autoconclusivo cuenta una historia completa por sí solo. Una saga o serie reúne varios libros conectados.</p>
              <label class="block">
                <span class="text-sm font-semibold text-ink">Respecto a sagas o series</span>
                <select [(ngModel)]="lengthSeries.seriesPreference" class="mt-1 w-full rounded-sm border border-[#9eb2c1] bg-white px-3 py-2">
                  <option value="standalone_only">Solo libros autoconclusivos</option>
                  <option value="standalone_preferred">Prefiero autoconclusivos, pero acepto el primer libro de una saga</option>
                  <option value="no_preference">Me da igual</option>
                </select>
              </label>
            </div>
          } @else if (current.questionKey === 'Q13_FORMAT_LANGUAGE') {
            <div class="space-y-3">
              <p class="text-sm font-semibold text-ink">Idiomas</p>
              <div class="flex flex-wrap gap-3">
                <button type="button"
                  class="rounded-full border px-4 py-2 text-sm font-semibold transition"
                  [class.bg-ink]="languagePreferences.spanish" [class.text-white]="languagePreferences.spanish" [class.border-ink]="languagePreferences.spanish"
                  [class.bg-white]="!languagePreferences.spanish" [class.text-ink]="!languagePreferences.spanish" [class.border-[#7d9ab0]]="!languagePreferences.spanish"
                  (click)="languagePreferences.spanish = !languagePreferences.spanish">Español</button>
                <button type="button"
                  class="rounded-full border px-4 py-2 text-sm font-semibold transition"
                  [class.bg-ink]="languagePreferences.english" [class.text-white]="languagePreferences.english" [class.border-ink]="languagePreferences.english"
                  [class.bg-white]="!languagePreferences.english" [class.text-ink]="!languagePreferences.english" [class.border-[#7d9ab0]]="!languagePreferences.english"
                  (click)="languagePreferences.english = !languagePreferences.english">Inglés</button>
              </div>
            </div>
          } @else if (current.questionKey === 'Q15_ADDITIONAL_COMMENTS') {
            <label class="block">
              <span class="text-sm font-semibold text-ink">Cuéntanos</span>
              <textarea
                [(ngModel)]="structuredResponse['comment']"
                rows="5"
                maxlength="2000"
                placeholder="Ej. un tema que prefieres evitar o una ocasión especial…"
                class="mt-1 w-full rounded-sm border border-[#9eb2c1] bg-white px-3 py-2"></textarea>
            </label>
          } @else {
            <p class="text-sm text-[#536875]">No hay un control configurado para esta respuesta. Puedes omitirla si es opcional.</p>
          }

          <div class="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center">
            @if (history().length > 0) {
              <button
                class="w-full rounded-sm border border-[#7d9ab0] px-6 py-3 text-sm font-bold text-ink transition hover:bg-[#e6eef3] disabled:cursor-wait disabled:opacity-60 sm:w-auto"
                type="button"
                (click)="goBack()"
                [disabled]="loading()">
                Anterior
              </button>
            }
            <button
              class="w-full rounded-sm bg-ink px-6 py-3 text-sm font-bold text-white transition hover:bg-ink-soft disabled:cursor-wait disabled:opacity-60 sm:w-auto sm:flex-1"
              type="button"
              (click)="submitAnswer()"
              [disabled]="loading() || (current.responseType === 'ranking' && selectedKeys.length !== 3)">
              Guardar y continuar
            </button>
            @if (current.questionKey === 'Q01_LOVED_BOOKS') {
              <button
                class="w-full rounded-sm border border-[#7d9ab0] px-6 py-3 text-sm font-bold text-ink transition hover:bg-[#e6eef3] disabled:cursor-wait disabled:opacity-60 sm:w-auto"
                type="button"
                (click)="skipForNeverRead()"
                [disabled]="loading()">
                Nunca he leído
              </button>
            }
            @if (!current.isRequired && current.questionKey !== 'Q01_LOVED_BOOKS') {
              <button
                class="w-full rounded-sm border border-[#7d9ab0] px-6 py-3 text-sm font-bold text-ink transition hover:bg-[#e6eef3] disabled:cursor-wait disabled:opacity-60 sm:w-auto"
                type="button"
                (click)="skipQuestion()"
                [disabled]="loading()">
                Omitir
              </button>
            }
          </div>
        </section>
      } @else {
        <section class="rounded-sm border border-[#cad7df] bg-white p-10 text-center">
          <p class="font-mono text-xs uppercase tracking-[0.08em] text-[#567088]">Construyendo tu perfil</p>
          <h1 class="mt-3 font-display text-3xl font-bold tracking-[-0.04em] text-ink">Preparando tus preguntas…</h1>
        </section>
      }
    </div>
  `,
})
export class Questionnaire {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  readonly session = signal<Session | null>(null);
  readonly question = signal<Question | null>(null);
  readonly tags = signal<Tag[]>([]);
  readonly alreadyCompleted = signal(false);
  readonly loading = signal(false);
  readonly history = signal<string[]>([]);

  readonly TOTAL_QUESTIONS = TOTAL_QUESTIONS;
  readonly lovedBookAspectsList = LOVED_BOOK_ASPECTS;
  readonly dislikedReasons = DISLIKED_BOOK_REASONS;

  readonly totalQuestions = computed(() => this.question()?.totalQuestions ?? TOTAL_QUESTIONS);

  readonly position = computed(() => this.question()?.position ?? Math.min(this.history().length + 1, TOTAL_QUESTIONS));

  readonly progress = computed(() => {
    const total = this.totalQuestions();
    if (total <= 0) return 0;
    return Math.min(100, Math.round((Math.max(1, this.position()) / total) * 100));
  });

  readonly tagGroups: Array<{ key: TagGroup; label: string; max: number | null }> = [
    { key: 'liked', label: 'Me gustan', max: 5 },
    { key: 'curious', label: 'Me dan curiosidad', max: 3 },
    { key: 'notInterested', label: 'No me interesan por ahora', max: null },
  ];

  scaleValue: number | null = null;
  selectedKeys: string[] = [];
  structuredResponse: Record<string, unknown> = {};
  tagQueries: Record<TagGroup, string> = { liked: '', curious: '', notInterested: '' };
  tagSelections: Record<TagGroup, string[]> = { liked: [], curious: [], notInterested: [] };
  activeTagGroup: TagGroup | null = null;
  lovedBookQuery = '';
  readonly lovedBookResults = signal<BookResult[]>([]);
  readonly lovedSearch = signal<{ loading: boolean; error: string | null }>({ loading: false, error: null });
  lovedBooks: BookResult[] = [];
  lovedBookAspects: Record<string, string[]> = {};
  dislikedBookQuery = '';
  readonly dislikedBookResults = signal<BookResult[]>([]);
  readonly dislikedSearch = signal<{ loading: boolean; error: string | null }>({ loading: false, error: null });
  dislikedBooks: BookResult[] = [];
  dislikedBookReasons: Record<string, string[]> = {};
  dislikedBookReasonTexts: Record<string, string> = {};
  complexity: { linguistic: number | null; structural: number | null } = { linguistic: null, structural: null };
  lengthSeries = { minPages: 100, maxPages: 400, seriesPreference: 'standalone_preferred' };
  languagePreferences = { spanish: true, english: false };
  private searchTimer?: ReturnType<typeof setTimeout>;
  private readonly searchSeq: Record<'loved' | 'disliked', number> = { loved: 0, disliked: 0 };

  private bootstrapped = false;

  constructor() {
    effect(() => {
      if (!this.auth.session()) {
        this.bootstrapped = false;
        return;
      }
      void this.bootstrap();
    });
  }

  private async bootstrap(): Promise<void> {
    if (this.bootstrapped) return;
    this.bootstrapped = true;
    try {
      const sessions = await this.api.listSessions();
      if (sessions.some((session) => session.status === 'completed')) {
        this.alreadyCompleted.set(true);
        return;
      }
      const resumable = sessions.find((session) => session.status === 'started' || session.status === 'abandoned');
      if (resumable) {
        this.history.set(resumable.answers.map((answer) => answer.questionKey));
      }
      await this.startQuestionnaire();
    } catch (error) {
      this.toast.error(error instanceof Error ? error.message : 'No pudimos cargar tu cuestionario.');
    }
  }

  async startQuestionnaire(): Promise<void> {
    await this.run(async () => {
      const session = await this.api.createSession();
      this.session.set(session);
      this.tags.set(await this.api.listTags());
      await this.loadNextQuestion();
    });
  }

  async redoQuestionnaire(): Promise<void> {
    await this.run(async () => {
      await this.api.resetQuestionnaire();
      this.alreadyCompleted.set(false);
      this.history.set([]);
      this.toast.success('Empecemos desde cero.');
      await this.startQuestionnaire();
    });
  }

  async submitAnswer(): Promise<void> {
    const session = this.session();
    const question = this.question();
    if (!session || !question) return;
    const validation = this.validate(question);
    if (validation) {
      this.toast.error(validation);
      return;
    }
    await this.run(async () => {
      await this.api.submitAnswer(session.id, question.questionKey, this.responseFor(question));
      this.history.update((items) => [...items, question.questionKey]);
      this.resetAnswer();
      await this.loadNextQuestion();
    });
  }

  async skipQuestion(): Promise<void> {
    const session = this.session();
    const question = this.question();
    if (!session || !question || question.isRequired) return;
    await this.run(async () => {
      await this.api.submitAnswer(session.id, question.questionKey, { skipped: true });
      this.history.update((items) => [...items, question.questionKey]);
      this.resetAnswer();
      await this.loadNextQuestion();
    });
  }

  async skipForNeverRead(): Promise<void> {
    const session = this.session();
    const question = this.question();
    if (!session || !question || question.questionKey !== 'Q01_LOVED_BOOKS') return;
    await this.run(async () => {
      await this.api.submitAnswer(session.id, 'Q01_LOVED_BOOKS', { skipped: true });
      await this.api.submitAnswer(session.id, 'Q02_DISLIKED_BOOK', { skipped: true });
      this.history.update((items) => [...items, 'Q01_LOVED_BOOKS', 'Q02_DISLIKED_BOOK']);
      this.resetAnswer();
      await this.loadNextQuestion();
    });
  }

  async goBack(): Promise<void> {
    const session = this.session();
    const previousKey = this.history().at(-1);
    if (!session || !previousKey) return;
    await this.run(async () => {
      const previous = await this.api.getQuestionWithResponse(session.id, previousKey);
      this.applySavedResponse(previous, previous.response);
      this.question.set(previous);
      this.history.update((items) => items.slice(0, -1));
    });
  }

  async completeQuestionnaire(): Promise<void> {
    const session = this.session();
    if (!session) return;
    await this.api.completeSession(session.id);
    this.question.set(null);
    await this.router.navigate(['/app']);
  }

  toggleSelection(key: string): void {
    const question = this.question();
    if (!question) return;
    if (question.responseType === 'single_select') {
      this.selectedKeys = this.selectedKeys.includes(key) ? [] : [key];
      return;
    }
    const max = question.validation?.maxItems ?? Number.MAX_SAFE_INTEGER;
    if (this.selectedKeys.includes(key)) {
      this.selectedKeys = this.selectedKeys.filter((selected) => selected !== key);
    } else if (this.selectedKeys.length < max) {
      this.selectedKeys = [...this.selectedKeys, key];
    }
  }

  isSingleSelect(): boolean {
    return this.question()?.responseType === 'single_select';
  }

  selectionDisabled(key: string): boolean {
    const question = this.question();
    if (!question) return false;
    if (this.isSelected(key)) return false;
    if (question.responseType === 'single_select') return this.selectedKeys.length > 0;
    const max = question.validation?.maxItems ?? Number.MAX_SAFE_INTEGER;
    return this.selectedKeys.length >= max;
  }

  toggleRanking(key: string): void {
    this.selectedKeys = toggleRankingSelection(this.selectedKeys, key, this.question()?.validation?.maxItems ?? 3);
  }

  rankingPosition(key: string): number {
    return rankingPosition(this.selectedKeys, key);
  }

  rankingDisabled(key: string): boolean {
    return rankingDisabled(this.selectedKeys, key, this.question()?.validation?.maxItems ?? 3);
  }

  rankingAriaLabel(option: { key: string; label: string }): string {
    const position = this.rankingPosition(option.key);
    const state = position > 0 ? `Seleccionado, posición ${position}` : 'No seleccionado';
    const disabled = this.rankingDisabled(option.key) ? ' Límite de tres alcanzado, deshabilitado' : '';
    return `${option.label}. ${state}.${disabled}`;
  }

  rankingLabel(key: string): string {
    return this.question()?.options.find((option) => option.key === key)?.label ?? key;
  }

  isSelected(key: string): boolean {
    return this.selectedKeys.includes(key);
  }

  onBookQuery(kind: 'loved' | 'disliked'): void {
    if (this.searchTimer) clearTimeout(this.searchTimer);
    const query = kind === 'loved' ? this.lovedBookQuery : this.dislikedBookQuery;
    const state = kind === 'loved' ? this.lovedSearch : this.dislikedSearch;
    if (!query.trim()) {
      this.searchSeq[kind]++;
      if (kind === 'loved') this.lovedBookResults.set([]);
      else this.dislikedBookResults.set([]);
      state.set({ loading: false, error: null });
      return;
    }
    this.searchTimer = setTimeout(() => this.runBookSearch(kind, query), 300);
  }

  private runBookSearch(kind: 'loved' | 'disliked', query: string): void {
    const state = kind === 'loved' ? this.lovedSearch : this.dislikedSearch;
    const seq = ++this.searchSeq[kind];
    state.set({ loading: true, error: null });
    this.api.searchBooks(query).then((results) => {
      if (seq !== this.searchSeq[kind]) return;
      if (kind === 'loved') this.lovedBookResults.set(results);
      else this.dislikedBookResults.set(results);
      state.set({ loading: false, error: null });
    }).catch(() => {
      if (seq !== this.searchSeq[kind]) return;
      if (kind === 'loved') this.lovedBookResults.set([]);
      else this.dislikedBookResults.set([]);
      state.set({ loading: false, error: 'No pudimos buscar libros. Revisa tu conexión.' });
    });
  }

  retryBookSearch(kind: 'loved' | 'disliked'): void {
    const query = kind === 'loved' ? this.lovedBookQuery : this.dislikedBookQuery;
    if (!query.trim()) return;
    this.runBookSearch(kind, query);
  }

  addLovedBook(book: BookResult): void {
    const max = this.question()?.validation?.maxItems ?? 20;
    if (this.lovedBooks.length >= max || this.lovedBooks.some((item) => item.openLibraryId === book.openLibraryId)) return;
    this.lovedBooks = [...this.lovedBooks, book];
    this.lovedBookAspects[book.openLibraryId] = [];
    this.lovedBookQuery = '';
    this.lovedBookResults.set([]);
    this.lovedSearch.set({ loading: false, error: null });
    this.searchSeq.loved++;
    setTimeout(() => document.getElementById(`loved-book-${book.openLibraryId}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 0);
  }

  removeLovedBook(openLibraryId: string): void {
    this.lovedBooks = this.lovedBooks.filter((book) => book.openLibraryId !== openLibraryId);
    delete this.lovedBookAspects[openLibraryId];
  }

  toggleLovedBookAspect(bookId: string, aspect: string): void {
    const selected = this.lovedBookAspects[bookId] ?? [];
    this.lovedBookAspects[bookId] = selected.includes(aspect) ? selected.filter((item) => item !== aspect) : [...selected, aspect];
  }

  hasLovedBookAspect(bookId: string, aspect: string): boolean {
    return (this.lovedBookAspects[bookId] ?? []).includes(aspect);
  }

  addDislikedBook(book: BookResult): void {
    const max = this.question()?.validation?.maxItems ?? 20;
    if (this.dislikedBooks.length >= max || this.dislikedBooks.some((item) => item.openLibraryId === book.openLibraryId)) return;
    this.dislikedBooks = [...this.dislikedBooks, book];
    this.dislikedBookReasons[book.openLibraryId] = [];
    this.dislikedBookReasonTexts[book.openLibraryId] = '';
    this.dislikedBookQuery = '';
    this.dislikedBookResults.set([]);
    this.dislikedSearch.set({ loading: false, error: null });
    this.searchSeq.disliked++;
    setTimeout(() => document.getElementById(`disliked-book-${book.openLibraryId}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 0);
  }

  removeDislikedBook(openLibraryId: string): void {
    this.dislikedBooks = this.dislikedBooks.filter((book) => book.openLibraryId !== openLibraryId);
    delete this.dislikedBookReasons[openLibraryId];
    delete this.dislikedBookReasonTexts[openLibraryId];
  }

  toggleDislikedBookReason(bookId: string, code: string): void {
    const selected = this.dislikedBookReasons[bookId] ?? [];
    this.dislikedBookReasons[bookId] = selected.includes(code) ? selected.filter((item) => item !== code) : [...selected, code];
  }

  hasDislikedBookReason(bookId: string, code: string): boolean {
    return (this.dislikedBookReasons[bookId] ?? []).includes(code);
  }

  tagMatches(group: TagGroup): Tag[] {
    const query = this.searchText(this.tagQueries[group]);
    const selected = new Set(Object.values(this.tagSelections).flat());
    return this.tags().filter((tag) => !selected.has(tag.tagKey) && this.searchText(`${this.tagLabel(tag)} ${tag.name} ${tag.tagKey}`).includes(query));
  }

  tagLabel(tag: Tag): string {
    return TAG_LABELS[tag.tagKey] ?? tag.name;
  }

  tagTypeLabel(tag: Tag): string {
    return TAG_TYPE_LABELS[tag.tagType] ?? tag.tagType;
  }

  selectTag(group: TagGroup, tag: Tag): void {
    const max = group === 'liked' ? 5 : group === 'curious' ? 3 : Number.MAX_SAFE_INTEGER;
    if (this.tagSelections[group].length >= max) return;
    this.tagSelections[group] = [...this.tagSelections[group], tag.tagKey];
    this.tagQueries[group] = '';
  }

  removeTag(group: TagGroup, tagKey: string): void {
    this.tagSelections[group] = this.tagSelections[group].filter((selected) => selected !== tagKey);
  }

  selectedTags(group: TagGroup): Tag[] {
    return this.tagSelections[group].flatMap((tagKey) => this.tags().filter((tag) => tag.tagKey === tagKey));
  }

  private validate(question: Question): string | null {
    if (question.questionKey === 'Q01_LOVED_BOOKS') {
      if (this.lovedBooks.length < (question.validation?.minItems ?? 3)) return `Agrega al menos ${question.validation?.minItems ?? 3} libros que te hayan gustado.`;
      const missingAspects = this.lovedBooks.find((book) => (this.lovedBookAspects[book.openLibraryId] ?? []).length === 0);
      return missingAspects ? `Selecciona qué te gustó de «${missingAspects.title}».` : null;
    }
    if (question.questionKey === 'Q02_DISLIKED_BOOK') {
      if (this.dislikedBooks.length < (question.validation?.minItems ?? 3)) return `Agrega al menos ${question.validation?.minItems ?? 3} libros que no te hayan gustado.`;
      const missingReasons = this.dislikedBooks.find((book) => (this.dislikedBookReasons[book.openLibraryId] ?? []).length === 0);
      return missingReasons ? `Selecciona el motivo de «${missingReasons.title}».` : null;
    }
    if (question.questionKey === 'Q11_GENRES_THEMES') {
      const total = this.tagSelections.liked.length + this.tagSelections.curious.length + this.tagSelections.notInterested.length;
      return total === 0 ? 'Elige al menos una etiqueta.' : null;
    }
    if (question.questionKey === 'Q12_LENGTH_SERIES') {
      if (this.lengthSeries.minPages <= 0 || this.lengthSeries.maxPages <= 0 || this.lengthSeries.minPages > this.lengthSeries.maxPages) return 'Revisa los límites de páginas.';
      return null;
    }
    if (question.questionKey === 'Q13_FORMAT_LANGUAGE') {
      return !this.languagePreferences.spanish && !this.languagePreferences.english ? 'Elige al menos un idioma.' : null;
    }
    if (question.questionKey === 'Q07_COMPLEXITY') {
      if (this.complexity.linguistic === null || this.complexity.structural === null) return 'Completa ambas escalas de complejidad.';
      return null;
    }
    if (question.responseType === 'scale' && this.scaleValue === null) return 'Elige una opción.';
    if (question.responseType === 'single_select' && this.selectedKeys.length !== 1) return 'Elige una opción.';
    if (question.responseType === 'ranking' && this.selectedKeys.length !== 3) return 'Selecciona tres opciones en orden de preferencia.';
    if (question.responseType === 'multi_select' && this.selectedKeys.length === 0) return 'Elige al menos una opción.';
    return null;
  }

  private responseFor(question: Question): unknown {
    if (question.responseType === 'scale') return this.scaleValue;
    if (question.responseType === 'single_select') return this.selectedKeys[0];
    if (question.responseType === 'multi_select') return this.selectedKeys;
    if (question.responseType === 'ranking') return { ranking: this.selectedKeys };
    if (question.questionKey === 'Q01_LOVED_BOOKS') return {
      books: this.lovedBooks.map((book) => ({ work_id: book.openLibraryId, edition_id: book.openLibraryEditionId, title: book.title, liked_aspects: this.lovedBookAspects[book.openLibraryId] ?? [], free_text: null })),
    };
    if (question.questionKey === 'Q02_DISLIKED_BOOK') return {
      books: this.dislikedBooks.map((book) => ({
        work_id: book.openLibraryId,
        edition_id: book.openLibraryEditionId,
        title: book.title,
        reason_codes: this.dislikedBookReasons[book.openLibraryId] ?? [],
        free_text: (this.dislikedBookReasonTexts[book.openLibraryId] ?? '').trim() || null,
      })),
    };
    if (question.questionKey === 'Q07_COMPLEXITY') return this.complexity;
    if (question.questionKey === 'Q11_GENRES_THEMES') return {
      liked: this.tagSelections.liked, curious: this.tagSelections.curious, notInterested: this.tagSelections.notInterested,
    };
    if (question.questionKey === 'Q12_LENGTH_SERIES') return this.lengthSeries;
    if (question.questionKey === 'Q13_FORMAT_LANGUAGE') return {
      languages: Object.entries(this.languagePreferences).filter(([, selected]) => selected).map(([language]) => language),
    };
    if (question.questionKey === 'Q15_ADDITIONAL_COMMENTS') {
      const comment = typeof this.structuredResponse['comment'] === 'string' ? this.structuredResponse['comment'].trim() : '';
      return comment ? { comment } : { skipped: true };
    }
    return this.structuredResponse;
  }

  private resetAnswer(): void {
    this.scaleValue = null;
    this.selectedKeys = [];
    this.structuredResponse = {};
    this.lovedBookQuery = '';
    this.lovedBookResults.set([]);
    this.lovedSearch.set({ loading: false, error: null });
    this.lovedBooks = [];
    this.lovedBookAspects = {};
    this.dislikedBookQuery = '';
    this.dislikedBookResults.set([]);
    this.dislikedSearch.set({ loading: false, error: null });
    this.dislikedBooks = [];
    this.dislikedBookReasons = {};
    this.dislikedBookReasonTexts = {};
    this.tagQueries = { liked: '', curious: '', notInterested: '' };
    this.tagSelections = { liked: [], curious: [], notInterested: [] };
    this.activeTagGroup = null;
  }

  private applySavedResponse(question: Question, response: unknown): void {
    this.resetAnswer();
    if (response === null || (response && typeof response === 'object' && (response as Record<string, unknown>)['skipped'] === true)) return;
    const value = (property: string): unknown => response && typeof response === 'object' ? (response as Record<string, unknown>)[property] : undefined;
    if (question.responseType === 'scale' && typeof response === 'number') { this.scaleValue = Math.min(5, Math.max(1, Math.round(response))); return; }
    if (question.responseType === 'single_select' && typeof response === 'string') { this.selectedKeys = [response]; return; }
    if (question.responseType === 'multi_select' && Array.isArray(response)) { this.selectedKeys = [...response]; return; }
    if (question.responseType === 'ranking') {
      const ranking = Array.isArray(response) ? response : Array.isArray((response as Record<string, unknown> | null)?.['ranking']) ? (response as { ranking: unknown[] })['ranking'] : null;
      if (Array.isArray(ranking)) this.selectedKeys = [...ranking];
      return;
    }
    if (question.questionKey === 'Q01_LOVED_BOOKS') {
      const books = Array.isArray(value('books')) ? value('books') as Array<Record<string, unknown>> : [];
      this.lovedBooks = books.map((book) => ({ openLibraryId: String(book['work_id']), openLibraryEditionId: typeof book['edition_id'] === 'string' ? book['edition_id'] : null, title: String(book['title'] ?? ''), authors: [], firstPublishYear: null, coverUrl: null, originalLanguage: 'es' }));
      for (const book of books) this.lovedBookAspects[String(book['work_id'])] = Array.isArray(book['liked_aspects']) ? (book['liked_aspects'] as string[]) : [];
      return;
    }
    if (question.questionKey === 'Q02_DISLIKED_BOOK') {
      const books = Array.isArray(value('books')) ? value('books') as Array<Record<string, unknown>> : [];
      this.dislikedBooks = books.map((book) => ({ openLibraryId: String(book['work_id']), openLibraryEditionId: typeof book['edition_id'] === 'string' ? book['edition_id'] : null, title: String(book['title'] ?? ''), authors: [], firstPublishYear: null, coverUrl: null, originalLanguage: 'es' }));
      for (const book of books) {
        this.dislikedBookReasons[String(book['work_id'])] = Array.isArray(book['reason_codes']) ? (book['reason_codes'] as string[]) : [];
        this.dislikedBookReasonTexts[String(book['work_id'])] = typeof book['free_text'] === 'string' ? book['free_text'] : '';
      }
      return;
    }
    if (question.questionKey === 'Q07_COMPLEXITY') {
      const linguistic = value('linguistic'); const structural = value('structural');
      this.complexity = { linguistic: typeof linguistic === 'number' ? linguistic : null, structural: typeof structural === 'number' ? structural : null };
      return;
    }
    if (question.questionKey === 'Q11_GENRES_THEMES') {
      this.tagSelections = {
        liked: Array.isArray(value('liked')) ? value('liked') as string[] : [],
        curious: Array.isArray(value('curious')) ? value('curious') as string[] : [],
        notInterested: Array.isArray(value('notInterested')) ? value('notInterested') as string[] : [],
      };
      return;
    }
    if (question.questionKey === 'Q12_LENGTH_SERIES') {
      const minPages = value('minPages'); const maxPages = value('maxPages'); const seriesPreference = value('seriesPreference');
      this.lengthSeries = {
        minPages: typeof minPages === 'number' ? minPages : 100,
        maxPages: typeof maxPages === 'number' ? maxPages : 400,
        seriesPreference: typeof seriesPreference === 'string' ? seriesPreference : 'standalone_preferred',
      };
      return;
    }
    if (question.questionKey === 'Q13_FORMAT_LANGUAGE') {
      const languages = Array.isArray(value('languages')) ? value('languages') as string[] : [];
      this.languagePreferences = { spanish: languages.includes('es'), english: languages.includes('en') };
      return;
    }
    if (question.questionKey === 'Q15_ADDITIONAL_COMMENTS') {
      const comment = value('comment');
      this.structuredResponse = { comment: typeof comment === 'string' ? comment : '' };
    }
  }

  private searchText(value: string): string {
    return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  }

  private async loadNextQuestion(): Promise<void> {
    const session = this.session();
    if (!session) return;
    const question = await this.api.nextQuestion(session.id);
    this.question.set(question);
    if (!question) await this.completeQuestionnaire();
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
