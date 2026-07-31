import { CurrencyPipe } from '@angular/common';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AdminUser, ApiService, BookResult, ProductPackage, Profile, Question, Session, ShippingAddress, Tag } from './api.service';
import { AuthService } from './auth.service';

type FeedbackStatus = 'completed' | 'in_progress' | 'paused' | 'abandoned' | 'not_started';
type TagGroup = 'liked' | 'curious' | 'notInterested';
type ProfileBook = { title?: string; work_id?: string; openLibraryId?: string; authors?: string[] };

const TAG_LABELS: Record<string, string> = {
  literary_fiction: 'Novela literaria', mystery: 'Misterio', thriller: 'Suspenso', horror: 'Terror', romance: 'Romance', erotica: 'Erótico',
  science_fiction: 'Ciencia ficción', fantasy: 'Fantasía', historical_fiction: 'Ficción histórica', adventure: 'Aventura',
  comedy: 'Comedia', speculative_fiction: 'Ficción especulativa', realistic_fiction: 'Ficción realista',
  narrative_nonfiction: 'No ficción narrativa', essay_memoir: 'Ensayo y memorias', short_story_collection: 'Cuentos',
  history: 'Historia', biography_memoir: 'Biografía y memorias', journalism: 'Periodismo y crónica', science: 'Ciencia',
  politics_society: 'Política y sociedad', philosophy: 'Filosofía', economics: 'Economía',
  cozy_mystery: 'Misterio acogedor', procedural: 'Procedural', noir: 'Noir', hardboiled: 'Hardboiled',
  psychological_thriller: 'Thriller psicológico', spy_thriller: 'Espionaje', techno_thriller: 'Tecno-thriller',
  legal_thriller: 'Judicial', cosmic_horror: 'Horror cósmico', psychological_horror: 'Horror psicológico', slasher: 'Slasher',
  gothic_horror: 'Gótico', space_opera: 'Space opera', hard_scifi: 'Ciencia ficción dura', cyberpunk: 'Cyberpunk',
  dystopia: 'Distopía', high_fantasy: 'Fantasía épica', urban_fantasy: 'Fantasía urbana', dark_fantasy: 'Fantasía oscura',
  magical_realism: 'Realismo mágico', alternate_history: 'Historia alternativa', slipstream: 'Slipstream',
  paranormal_romance: 'Romance paranormal', satire: 'Sátira',
  love: 'Amor', identity: 'Identidad', grief: 'Duelo', family: 'Familia', friendship: 'Amistad', betrayal: 'Traición',
  redemption: 'Redención', justice: 'Justicia', power: 'Poder', freedom: 'Libertad', war: 'Guerra', migration: 'Migración',
  memory: 'Memoria', loneliness: 'Soledad', ambition: 'Ambición', faith_doubt: 'Fe y duda',
  technology_society: 'Tecnología y sociedad', environment: 'Naturaleza y entorno', mental_health: 'Salud mental',
  addiction: 'Adicción', coming_of_age: 'Madurez', forgiveness: 'Perdón', mortality: 'Mortalidad', moral_dilemma: 'Dilema moral',
  urban: 'Urbano', rural: 'Rural', small_town: 'Pueblo pequeño', arctic: 'Ártico y polar', desert: 'Desierto', island: 'Isla',
  maritime: 'Marítimo', mountain: 'Montaña', war_zone: 'Zona de conflicto', dystopian_city: 'Ciudad distópica', village: 'Aldea',
  metropolis: 'Metrópolis',
  pre_1900: 'Anterior a 1900', early_20th_century: 'Primer tercio del siglo XX', mid_20th_century: 'Mediados del siglo XX',
  late_20th_century: 'Finales del siglo XX', contemporary: 'Contemporáneo', near_future: 'Futuro cercano',
  distant_future: 'Futuro lejano', mythic_past: 'Pasado mítico',
  latin_american: 'Latinoamericano', hispanic_mexico: 'México', anglo_united_states: 'Estados Unidos',
  anglo_united_kingdom: 'Reino Unido', european: 'Europeo', east_asian: 'Asiático oriental', south_asian: 'Asia del Sur',
  southeast_asian: 'Sudeste asiático', middle_eastern: 'Medio Oriente', african: 'Africano', indigenous: 'Indígena', diaspora: 'Diáspora',
  quest: 'Búsqueda', forbidden_love: 'Amor prohibido', chosen_one: 'Elegido', unreliable_narrator: 'Narrador no confiable',
  locked_room_mystery: 'Misterio de cuarto cerrado', time_loop: 'Bucle temporal', parallel_worlds: 'Mundos paralelos',
  found_family: 'Familia elegida', redemption_arc: 'Arco de redención', fall_of_hero: 'Caída del héroe',
  doppelganger: 'Dobles', secret_history: 'Historia secreta', last_survivor: 'Último superviviente', epistolary: 'Epistolar',
};

const TAG_TYPE_LABELS: Record<string, string> = {
  genre: 'género', subgenre: 'subgénero', theme: 'tema', setting: 'ambientación', period: 'período',
  cultural_context: 'contexto cultural', narrative_motif: 'motivo narrativo',
};

@Component({
  selector: 'app-root',
  imports: [FormsModule, CurrencyPipe],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  private readonly api = inject(ApiService);
  readonly auth = inject(AuthService);

  readonly userId = computed(() => this.auth.userId ?? '');
  readonly authenticated = computed(() => Boolean(this.auth.userId));
  readonly session = signal<Session | null>(null);
  readonly question = signal<Question | null>(null);
  readonly profile = signal<Profile | null>(null);
  readonly profileJson = computed(() => JSON.stringify(this.profile(), null, 2));
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly message = signal<string | null>(null);
  readonly packages = signal<ProductPackage[]>([]);
  readonly isAdmin = signal(false);
  readonly adminUsers = signal<AdminUser[]>([]);
  readonly adminUserJson = signal('');
  adminQuery = '';
  selectedPackage: ProductPackage['key'] | null = null;
  shippingAddress: ShippingAddress = { recipientName: '', phone: '', street: '', exteriorNumber: '', neighborhood: '', city: '', state: '', postalCode: '' };

  scaleValue = 3;
  selectedKeys: string[] = [];
  structuredResponse: Record<string, unknown> = {};
  readonly tags = signal<Tag[]>([]);
  readonly tagGroups: Array<{ key: TagGroup; label: string; max: number | null }> = [
    { key: 'liked', label: 'Me gustan', max: 5 },
    { key: 'curious', label: 'Me dan curiosidad', max: 3 },
    { key: 'notInterested', label: 'No me interesan por ahora', max: null },
  ];
  tagQueries: Record<TagGroup, string> = { liked: '', curious: '', notInterested: '' };
  tagSelections: Record<TagGroup, string[]> = { liked: [], curious: [], notInterested: [] };
  activeTagGroup: TagGroup | null = null;
  lovedBookQuery = '';
  readonly lovedBookResults = signal<BookResult[]>([]);
  lovedBooks: BookResult[] = [];
  lovedBookAspects: Record<string, string[]> = {};
  dislikedBookQuery = '';
  readonly dislikedBookResults = signal<BookResult[]>([]);
  dislikedBook: BookResult | null = null;
  dislikedBookReason = '';
  dislikedReasonCodes: string[] = [];
  private searchTimer?: ReturnType<typeof setTimeout>;
  complexity = { linguistic: 3, structural: 3 };
  lengthSeries = { minPages: 100, maxPages: 400, seriesPreference: 'standalone_preferred' };
  languagePreferences = { spanish: true, english: false };
  feedback = {
    started: true,
    notStartedReason: 'no_time',
    readingStatus: 'completed' as FeedbackStatus,
    completionPercentage: 100,
    selectionFitRating: 4,
    positiveAspects: [] as string[],
    negativeAspects: [] as string[],
    outcomeAttribution: 'no_problem',
    freeText: '',
  };

  constructor() {
    effect(() => {
      if (!this.auth.session()) {
        this.isAdmin.set(false);
        return;
      }
      void this.api.getMe().then((user) => this.isAdmin.set(user.role === 'admin')).catch(() => this.isAdmin.set(false));
    });
  }

  async signIn(): Promise<void> { await this.run(() => this.auth.signInWithGoogle()); }
  async signOut(): Promise<void> { await this.run(() => this.auth.signOut()); this.session.set(null); this.profile.set(null); }

  readerName(): string {
    const user = this.auth.session()?.user;
    const name = user?.user_metadata?.['full_name'];
    return typeof name === 'string' && name.trim() ? name : user?.email ?? 'lector';
  }

  async startQuestionnaire(): Promise<void> {
    await this.run(async () => {
      const session = await this.api.createSession();
      this.session.set(session);
      this.tags.set(await this.api.listTags());
      await this.loadNextQuestion();
      this.message.set('Sesión de cuestionario iniciada.');
    });
  }

  async submitAnswer(): Promise<void> {
    const session = this.session();
    const question = this.question();
    if (!session || !question) return;
    await this.run(async () => {
      await this.api.submitAnswer(session.id, question.questionKey, this.responseFor(question));
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
      this.resetAnswer();
      await this.loadNextQuestion();
    });
  }

  async completeQuestionnaire(): Promise<void> {
    const session = this.session();
    if (!session) return;
    await this.run(async () => {
      await this.api.completeSession(session.id);
      this.question.set(null);
      await this.loadProfile();
      this.message.set('Onboarding completado.');
    });
  }

  async loadProfile(): Promise<void> {
    await this.run(async () => this.profile.set(await this.api.getProfile()));
  }

  async copyProfileJson(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.profileJson());
      this.message.set('JSON del perfil copiado.');
    } catch {
      this.error.set('No se pudo copiar automaticamente. Selecciona el contenido del area de texto.');
    }
  }

  async submitFeedback(): Promise<void> {
    await this.run(async () => {
      const body = {
        ...this.feedback,
        positiveAspects: this.feedback.positiveAspects,
        negativeAspects: this.feedback.negativeAspects,
        nextDirection: {},
      };
      await this.api.submitFeedback(body);
      await this.loadProfile();
      this.message.set('Feedback guardado y perfil recalculado.');
    });
  }

  async loadPackages(): Promise<void> {
    await this.run(async () => this.packages.set(await this.api.listPackages()));
  }

  async checkout(): Promise<void> {
    if (!this.selectedPackage) return;
    await this.run(async () => {
      const { checkoutUrl } = await this.api.createCheckout(this.selectedPackage!, this.shippingAddress);
      window.location.assign(checkoutUrl);
    });
  }

  async loadAdminUsers(): Promise<void> {
    await this.run(async () => this.adminUsers.set(await this.api.listAdminUsers(this.adminQuery)));
  }

  async showAdminUser(user: AdminUser): Promise<void> {
    await this.run(async () => this.adminUserJson.set(JSON.stringify(await this.api.getAdminUser(user.id), null, 2)));
  }

  toggleSelection(key: string): void {
    const max = this.question()?.validation?.maxItems ?? (this.question()?.responseType === 'ranking' ? 3 : Number.MAX_SAFE_INTEGER);
    if (this.selectedKeys.includes(key)) {
      this.selectedKeys = this.selectedKeys.filter((selected) => selected !== key);
    } else if (this.selectedKeys.length < max) {
      this.selectedKeys = [...this.selectedKeys, key];
    }
  }

  toggleFeedbackAspect(kind: 'positiveAspects' | 'negativeAspects', key: string): void {
    const values = this.feedback[kind];
    this.feedback[kind] = values.includes(key) ? values.filter((item) => item !== key) : [...values, key].slice(0, 3);
  }

  syncFeedbackStart(): void {
    if (!this.feedback.started) {
      this.feedback.readingStatus = 'not_started';
      this.feedback.completionPercentage = 0;
    }
  }

  onBookQuery(kind: 'loved' | 'disliked'): void {
    if (this.searchTimer) clearTimeout(this.searchTimer);
    const query = kind === 'loved' ? this.lovedBookQuery : this.dislikedBookQuery;
    if (!query.trim()) {
      if (kind === 'loved') this.lovedBookResults.set([]);
      else this.dislikedBookResults.set([]);
      return;
    }
    this.searchTimer = setTimeout(() => {
      this.api.searchBooks(query).then((results) => {
        if (kind === 'loved') this.lovedBookResults.set(results);
        else this.dislikedBookResults.set(results);
      }).catch(() => {
        if (kind === 'loved') this.lovedBookResults.set([]);
        else this.dislikedBookResults.set([]);
      });
    }, 300);
  }

  addLovedBook(book: BookResult): void {
    if (this.lovedBooks.some((b) => b.openLibraryId === book.openLibraryId)) return;
    const max = this.question()?.validation?.maxItems ?? 3;
    if (this.lovedBooks.length >= max) return;
    this.lovedBooks = [...this.lovedBooks, book];
    this.lovedBookAspects[book.openLibraryId] = [];
    this.lovedBookQuery = '';
    this.lovedBookResults.set([]);
  }

  removeLovedBook(openLibraryId: string): void {
    this.lovedBooks = this.lovedBooks.filter((b) => b.openLibraryId !== openLibraryId);
    delete this.lovedBookAspects[openLibraryId];
  }

  selectDislikedBook(book: BookResult): void {
    this.dislikedBook = book;
    this.dislikedBookQuery = '';
    this.dislikedBookResults.set([]);
  }

  clearDislikedBook(): void {
    this.dislikedBook = null;
  }

  isSelected(key: string): boolean {
    return this.selectedKeys.includes(key);
  }

  toggleLovedBookAspect(bookId: string, aspect: string): void {
    const selected = this.lovedBookAspects[bookId] ?? [];
    this.lovedBookAspects[bookId] = selected.includes(aspect) ? selected.filter((item) => item !== aspect) : [...selected, aspect];
  }

  hasLovedBookAspect(bookId: string, aspect: string): boolean {
    return (this.lovedBookAspects[bookId] ?? []).includes(aspect);
  }

  toggleDislikedReason(code: string): void {
    this.dislikedReasonCodes = this.dislikedReasonCodes.includes(code) ? this.dislikedReasonCodes.filter((item) => item !== code) : [...this.dislikedReasonCodes, code];
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

  profileTagLabel(tagKey: string): string {
    return TAG_LABELS[tagKey] ?? tagKey;
  }

  categoryPreferences(kind: 'positive' | 'curious' | 'negative') {
    return (this.profile()?.tagPreferences ?? []).filter((preference) => kind === 'positive'
      ? Number(preference.affinity) >= 0.8
      : kind === 'curious'
        ? Number(preference.affinity) > 0
        : Number(preference.affinity) < 0) ?? [];
  }

  profileBooks(questionKey: 'Q01_LOVED_BOOKS' | 'Q02_DISLIKED_BOOK'): ProfileBook[] {
    return (this.profile()?.questionnaireSessions ?? [])
      .flatMap((session) => session.answers)
      .filter((answer) => answer.questionKey === questionKey)
      .flatMap((answer) => this.booksFromResponse(answer.rawResponse)) ?? [];
  }

  bookLabel(book: ProfileBook): string {
    const title = book.title ?? book.work_id ?? book.openLibraryId ?? 'Libro sin titulo';
    return book.authors?.length ? `${title} - ${book.authors.join(', ')}` : title;
  }

  answerJson(value: unknown): string {
    return JSON.stringify(value, null, 2);
  }

  private booksFromResponse(value: unknown): ProfileBook[] {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
    const books = (value as { books?: unknown }).books;
    return Array.isArray(books) ? books.filter((book): book is ProfileBook => Boolean(book) && typeof book === 'object' && !Array.isArray(book)) : [];
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

  private searchText(value: string): string {
    return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  }

  private async loadNextQuestion(): Promise<void> {
    const session = this.session();
    if (!session) return;
    this.question.set(await this.api.nextQuestion(session.id));
  }

  private responseFor(question: Question): unknown {
    if (question.responseType === 'scale') return this.scaleValue;
    if (question.responseType === 'single_select') return this.selectedKeys[0];
    if (question.responseType === 'multi_select' || question.responseType === 'ranking') return this.selectedKeys;
    if (question.questionKey === 'Q01_LOVED_BOOKS') return {
      books: this.lovedBooks.map((book) => ({ work_id: book.openLibraryId, edition_id: book.openLibraryEditionId, title: book.title, liked_aspects: this.lovedBookAspects[book.openLibraryId] ?? [], free_text: null })),
    };
    if (question.questionKey === 'Q02_DISLIKED_BOOK') return {
      books: this.dislikedBook ? [{ work_id: this.dislikedBook.openLibraryId, edition_id: this.dislikedBook.openLibraryEditionId, title: this.dislikedBook.title, reason_codes: this.dislikedReasonCodes, free_text: this.dislikedBookReason.trim() || null }] : [],
    };
    if (question.questionKey === 'Q07_COMPLEXITY') return this.complexity;
    if (question.questionKey === 'Q11_GENRES_THEMES') return {
      liked: this.tagSelections.liked, curious: this.tagSelections.curious, notInterested: this.tagSelections.notInterested,
    };
    if (question.questionKey === 'Q12_LENGTH_SERIES') return this.lengthSeries;
    if (question.questionKey === 'Q13_FORMAT_LANGUAGE') return {
      languages: Object.entries(this.languagePreferences).filter(([, selected]) => selected).map(([language]) => language),
    };
    return this.structuredResponse;
  }

  private resetAnswer(): void {
    this.scaleValue = 3;
    this.selectedKeys = [];
    this.structuredResponse = {};
    this.lovedBookQuery = '';
    this.lovedBookResults.set([]);
    this.lovedBooks = [];
    this.lovedBookAspects = {};
    this.dislikedBookQuery = '';
    this.dislikedBookResults.set([]);
    this.dislikedBook = null;
    this.dislikedBookReason = '';
    this.dislikedReasonCodes = [];
    this.tagQueries = { liked: '', curious: '', notInterested: '' };
    this.tagSelections = { liked: [], curious: [], notInterested: [] };
    this.activeTagGroup = null;
  }

  private async run(operation: () => Promise<void>): Promise<void> {
    this.error.set(null);
    this.message.set(null);
    this.loading.set(true);
    try {
      await operation();
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'La operación no pudo completarse.');
    } finally {
      this.loading.set(false);
    }
  }
}
