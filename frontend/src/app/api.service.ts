import { HttpClient } from '@angular/common/http';
import { HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AuthService } from './auth.service';

export type Question = {
  questionKey: string;
  version: number;
  text: string;
  responseType: 'scale' | 'single_select' | 'multi_select' | 'ranking' | 'structured' | 'book_search';
  isRequired: boolean;
  validation: { minItems?: number; maxItems?: number } | null;
  options: Array<{ key: string; label: string }>;
  position?: number;
  totalQuestions?: number;
};

export type BookResult = {
  openLibraryId: string;
  openLibraryEditionId: string | null;
  title: string;
  authors: string[];
  firstPublishYear: number | null;
  coverUrl: string | null;
  originalLanguage: string;
};

export type Tag = { tagKey: string; name: string; tagType: string };

export type Session = { id: string; userId: string; status: string };
export type SessionDetail = {
  id: string;
  userId: string;
  status: string;
  questionnaireVersion: string;
  startedAt: string;
  completedAt: string | null;
  answers: Array<{ id: string; questionKey: string; answeredAt: string }>;
};
export type ProfileAnswer = {
  id: string;
  questionKey: string;
  questionVersion: number;
  questionnaireVersion: string;
  rawResponse: unknown;
  normalizedResponse: unknown;
  answeredAt: string;
};
export type ProfileSession = {
  id: string;
  questionnaireVersion: string;
  status: string;
  startedAt: string;
  completedAt: string | null;
  answers: ProfileAnswer[];
};
export type Profile = {
  currentVersion: number;
  readyToRecommend: boolean;
  globalProfileCoverage: string;
  onboardingCoreCoverage: string;
  evidenceMaturity: string;
  dimensions: Array<{ dimensionKey: string; value: string | null; confidence: string; evidenceCount: number }>;
  tagPreferences?: Array<{ tagKey: string; tagType: string; affinity: string; confidence: string; evidenceCount: number }>;
  operationalConstraints: { preferredPagesMin: number | null; preferredPagesMax: number | null; seriesPreference: string | null; acceptedLanguagesJson: string[]; acceptedFormatsJson: string[]; formatSource: string | null } | null;
  conditionalRules?: Array<{ ruleKey: string; ruleJson: unknown }>;
  positiveTriggers?: Array<{ triggerKey: string; confidence: string; evidenceCount: number; totalEvidenceWeight: string }>;
  evidence?: Array<{ dimensionKey: string; observedValue: string; reasonCode: string; baseWeight: string; specificityFactor: string; finalWeight: string; status: string; createdAt: string }>;
  questionnaireSessions?: ProfileSession[];
};

export type ProductPackage = { key: 'libro_sorpresa_fisico'; name: string; description: string; priceCents: number; shippingCents: number; currency: string; includedFormats: string[] };
export type CurrentUser = { id: string; email: string | null; displayName: string | null; role: 'customer' | 'admin' };
export type AdminUser = { id: string; email: string | null; displayName: string | null; role: string; createdAt: string; readerProfile: { readyToRecommend: boolean; currentVersion: number; updatedAt: string } | null; _count: { orders: number; readingFeedback: number } };

export type OrderAddress = {
  recipientName: string;
  phone: string | null;
  street: string;
  exteriorNumber: string | null;
  interiorNumber: string | null;
  neighborhood: string | null;
  city: string;
  state: string;
  postalCode: string;
  country: string;
};

export type UserOrder = {
  id: string;
  packageKey: string;
  packageName: string;
  totalCents: number;
  currency: string;
  status: string;
  createdAt: string;
  paidAt: string | null;
  shippingAddress: OrderAddress | null;
  fulfillment: {
    status: string;
    bookTitle: string | null;
    bookAuthor: string | null;
    coverUrl: string | null;
    trackingNumber: string | null;
    shippedAt: string | null;
    deliveredAt: string | null;
    assignments: Array<{ id: string; feedbackCycleStatus: string }>;
  } | null;
  _count: { feedbacks: number };
};

export type AdminOrder = {
  id: string;
  packageKey: string;
  packageName: string;
  subtotalCents: number;
  shippingCents: number;
  totalCents: number;
  currency: string;
  status: string;
  createdAt: string;
  paidAt: string | null;
  user: { id: string; email: string | null; displayName: string | null };
  shippingAddress: OrderAddress | null;
  payment: { status: string; amountCents: number; externalSessionId: string } | null;
  fulfillment: { id: string; status: string; trackingNumber: string | null; shippedAt: string | null; deliveredAt: string | null } | null;
  activeAssignment: { id: string; feedbackCycleStatus: string } | null;
  _count: { feedbacks: number };
};

export function orderIsActive(order: { fulfillment: { status: string } | null }): boolean {
  return Boolean(order.fulfillment && order.fulfillment.status !== 'canceled');
}

export function orderFeedbackDone(order: { _count: { feedbacks: number }; fulfillment: { assignments: Array<{ feedbackCycleStatus: string }> } | null }): boolean {
  if (order._count.feedbacks > 0) return true;
  return order.fulfillment?.assignments.some(
    (assignment) => assignment.feedbackCycleStatus === 'final_received' || assignment.feedbackCycleStatus === 'closed_without_feedback',
  ) ?? false;
}

export type AdminAuthorRef = { position: number; role: string; author: { id: string; canonicalName: string } };
export type AdminClassification = {
  id: string;
  revision: number;
  status: 'draft' | 'approved' | 'superseded';
  classifierVersion: string;
  contentTypeKey: string;
  features: Array<{ featureKey: string; value: string; confidence: string }>;
  tags: Array<{ tagKey: string; strength: string; confidence: string }>;
};
export type AdminEdition = {
  id: string;
  title: string;
  languageCode: string;
  isbn: string | null;
  pages: number | null;
  publisher: string | null;
  publicationYear: number | null;
  contributors: AdminAuthorRef[];
  classifications: AdminClassification[];
};
export type AdminBook = {
  id: string;
  canonicalTitle: string;
  originalLanguage: string;
  authors: AdminAuthorRef[];
  editions: AdminEdition[];
};
export type AdminAssignment = {
  id: string;
  status: 'active' | 'replaced' | 'canceled';
  feedbackCycleStatus: string;
  notes: string | null;
  fulfillment: { id: string; status: string; order: { userId: string; status: string } };
  edition: { id: string; title: string; languageCode: string };
  classification: { id: string; revision: number; status: string; classifierVersion: string };
  recommendationCandidate: { id: string; rankPosition: number | null; finalScore: string | null; recommendationEvidenceCoverage: string | null } | null;
  invitations: Array<{ id: string; status: string; expiresAt: string | null }>;
  feedbacks: Array<{ id: string; learningStatus: string; isFinal: boolean; submittedAt: string; selectionFitRating: number | null }>;
};
export type AdminFulfillment = {
  id: string;
  status: string;
  order: {
    id: string;
    userId: string;
    packageKey: string;
    packageName: string;
    status: string;
    createdAt: string;
    shippingAddress: { recipientName: string; city: string; state: string } | null;
    user: { displayName: string | null; email: string | null };
  };
  assignments: Array<{ id: string; feedbackCycleStatus: string }>;
};
export type AdminCandidateExplanation = {
  reasons: Array<{ dimensionKey: string; reader: number; book: number; compatible: number; effectiveWeight: number }>;
  tagMatches: Array<{ tagKey: string; affinity: number; strength: number }>;
  risk: Record<string, unknown>;
};
export type AdminCandidate = {
  candidateId: string;
  rankPosition: number | null;
  bookEditionId: string;
  classificationVersionId: string;
  title: string;
  editionTitle: string;
  pages: number | null;
  reviewStatus: string;
  blockReason: string | null;
  finalScore: number | null;
  numericFitScore: number | null;
  tagFitScore: number | null;
  contextFitScore: number | null;
  discoveryFitScore: number | null;
  riskPenalty: number | null;
  recommendationEvidenceCoverage: number | null;
  explanation: AdminCandidateExplanation;
};
export type AdminScoreResult = {
  recommendation: { id: string; revision: number; profileVersion: number; packageKey: string };
  candidates: AdminCandidate[];
};
export type ClassificationDiagnostics = {
  missingRequired: string[];
  optionalMissing: string[];
  notApplicable: string[];
  configurationErrors: string[];
  featureCoverageRatio: number | null;
  tags: { genre: number; theme: number; subgenre: number; subgenreApplicable: boolean };
  passes: boolean;
};

export type EditorFeature = {
  featureKey: string;
  scope: string;
  requirement: 'required' | 'optional' | 'not_applicable';
  label: string;
  description: string;
  meaningZero: string;
  meaningOne: string;
  value: number | null;
  confidence: number | null;
  notes: string | null;
};

export type EditorTag = {
  tagKey: string;
  name: string;
  tagType: string;
  strength: number | null;
  confidence: number | null;
};

export type ClassificationEditor = {
  id: string;
  bookEditionId: string;
  editionTitle: string;
  revision: number;
  status: 'draft' | 'approved' | 'superseded';
  contentTypeKey: string;
  contentTypeSchemaVersion: string;
  featureSchemaVersion: string;
  tagTaxonomyVersion: string;
  classifierVersion: string;
  features: EditorFeature[];
  tags: EditorTag[];
  tagsAvailable: Tag[];
};

export type FeatureTemplateItem = {
  featureKey: string;
  scope: string;
  requirement: 'required' | 'optional' | 'not_applicable';
  label: string;
  description: string;
  meaningZero: string;
  meaningOne: string;
};

export type SaveClassificationResult = {
  classification: ClassificationEditor;
  diagnostics: ClassificationDiagnostics;
};

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly auth = inject(AuthService);
  private readonly baseUrl = window.LIBROS_CONFIG?.apiUrl ?? 'http://localhost:3000/v1';

  constructor(private readonly http: HttpClient) {}

  createSession(): Promise<Session> {
    return firstValueFrom(this.http.post<Session>(`${this.baseUrl}/questionnaire-sessions`, {}, this.options()));
  }

  listSessions(): Promise<SessionDetail[]> {
    return firstValueFrom(this.http.get<SessionDetail[]>(`${this.baseUrl}/questionnaire-sessions`, this.options()));
  }

  resetQuestionnaire(): Promise<unknown> {
    return firstValueFrom(this.http.post(`${this.baseUrl}/questionnaire-sessions/reset`, {}, this.options()));
  }

  nextQuestion(sessionId: string): Promise<Question | null> {
    return firstValueFrom(this.http.get<Question | null>(`${this.baseUrl}/questionnaire-sessions/${sessionId}/next-question`, this.options()));
  }

  getQuestionWithResponse(sessionId: string, questionKey: string): Promise<Question & { response: unknown }> {
    return firstValueFrom(this.http.get<Question & { response: unknown }>(`${this.baseUrl}/questionnaire-sessions/${sessionId}/questions/${questionKey}`, this.options()));
  }

  submitAnswer(sessionId: string, questionKey: string, response: unknown): Promise<unknown> {
    return firstValueFrom(this.http.post(`${this.baseUrl}/questionnaire-sessions/${sessionId}/answers/${questionKey}`, { response, idempotencyKey: crypto.randomUUID() }, this.options()));
  }

  completeSession(sessionId: string): Promise<unknown> {
    return firstValueFrom(this.http.post(`${this.baseUrl}/questionnaire-sessions/${sessionId}/complete`, {}, this.options()));
  }

  getProfile(): Promise<Profile> {
    return firstValueFrom(this.http.get<Profile>(`${this.baseUrl}/me/reader-profile`, this.options()));
  }

  submitFeedback(body: Record<string, unknown>): Promise<unknown> {
    return firstValueFrom(this.http.post(`${this.baseUrl}/me/reading-feedback`, { ...body, idempotencyKey: crypto.randomUUID() }, this.options()));
  }

  searchBooks(q: string, limit = 8): Promise<BookResult[]> {
    return firstValueFrom(this.http.get<{ results: BookResult[] }>(`${this.baseUrl}/books/search`, { ...this.options(), params: { q, limit } })).then((r) => r.results ?? []);
  }

  listTags(): Promise<Tag[]> {
    return firstValueFrom(this.http.get<{ tags: Tag[] }>(`${this.baseUrl}/tags`, this.options())).then((r) => r.tags ?? []);
  }

  listPackages(): Promise<ProductPackage[]> {
    return firstValueFrom(this.http.get<ProductPackage[]>(`${this.baseUrl}/packages`, this.options()));
  }

  listOrders(): Promise<UserOrder[]> {
    return firstValueFrom(this.http.get<UserOrder[]>(`${this.baseUrl}/orders`, this.options()));
  }

  listAdminOrders(query = '', status = ''): Promise<AdminOrder[]> {
    const params: Record<string, string> = {};
    if (query) params['q'] = query;
    if (status) params['status'] = status;
    return firstValueFrom(this.http.get<AdminOrder[]>(`${this.baseUrl}/admin/orders`, { ...this.options(), params }));
  }

  getMe(): Promise<CurrentUser> {
    return firstValueFrom(this.http.get<CurrentUser>(`${this.baseUrl}/me`, this.options()));
  }

  listAdminUsers(query = ''): Promise<AdminUser[]> {
    return firstValueFrom(this.http.get<AdminUser[]>(`${this.baseUrl}/admin/users`, { ...this.options(), params: query ? { q: query } : {} }));
  }

  getAdminUser(userId: string): Promise<unknown> {
    return firstValueFrom(this.http.get(`${this.baseUrl}/admin/users/${userId}`, this.options()));
  }

  listAdminBooks(query = ''): Promise<AdminBook[]> {
    return firstValueFrom(this.http.get<{ results?: unknown }>(`${this.baseUrl}/admin/books`, { ...this.options(), params: query ? { q: query } : {} })).then((r) => (Array.isArray(r) ? r as AdminBook[] : (r as { items?: AdminBook[] }).items ?? (r as AdminBook[])));
  }

  createAdminBook(body: { canonicalTitle: string; originalLanguage: string; openLibraryEditionId?: string; authors?: Array<{ name: string; role: string; position: number }> }): Promise<AdminBook> {
    return firstValueFrom(this.http.post<AdminBook>(`${this.baseUrl}/admin/books`, body, this.options()));
  }

  getAdminBook(id: string): Promise<AdminBook> {
    return firstValueFrom(this.http.get<AdminBook>(`${this.baseUrl}/admin/books/${id}`, this.options()));
  }

  deleteAdminBook(id: string): Promise<{ deleted: boolean; bookId: string }> {
    return firstValueFrom(this.http.delete<{ deleted: boolean; bookId: string }>(`${this.baseUrl}/admin/books/${id}`, this.options()));
  }

  createAdminEdition(bookId: string, body: Record<string, unknown>): Promise<unknown> {
    return firstValueFrom(this.http.post(`${this.baseUrl}/admin/books/${bookId}/editions`, body, this.options()));
  }

  createAdminClassification(editionId: string, body: Record<string, unknown>): Promise<AdminClassification> {
    return firstValueFrom(this.http.post<AdminClassification>(`${this.baseUrl}/admin/editions/${editionId}/classifications`, body, this.options()));
  }

  createAdminClassificationDraft(editionId: string, body: { contentTypeKey: string; contentTypeSchemaVersion: string; featureSchemaVersion: string; tagTaxonomyVersion: string }): Promise<ClassificationEditor> {
    return firstValueFrom(this.http.post<ClassificationEditor>(`${this.baseUrl}/admin/editions/${editionId}/classifications/draft`, body, this.options()));
  }

  getAdminClassificationEditor(id: string): Promise<ClassificationEditor> {
    return firstValueFrom(this.http.get<ClassificationEditor>(`${this.baseUrl}/admin/classifications/${id}/editor`, this.options()));
  }

  getClassificationFeatureTemplate(contentTypeKey: string, contentTypeSchemaVersion: string, featureSchemaVersion: string): Promise<{ contentTypeKey: string; features: FeatureTemplateItem[] }> {
    return firstValueFrom(this.http.get<{ contentTypeKey: string; features: FeatureTemplateItem[] }>(`${this.baseUrl}/admin/catalog/features`, {
      ...this.options(),
      params: { contentTypeKey, contentTypeSchemaVersion, featureSchemaVersion },
    }));
  }

  saveAdminClassification(id: string, body: { contentTypeKey: string; contentTypeSchemaVersion: string; featureSchemaVersion: string; tagTaxonomyVersion: string; features: Array<{ featureKey: string; value?: number | null; confidence?: number | null; notes?: string | null }>; tags: Array<{ tagKey: string; strength: number; confidence: number }> }): Promise<SaveClassificationResult> {
    return firstValueFrom(this.http.put<SaveClassificationResult>(`${this.baseUrl}/admin/classifications/${id}`, body, this.options()));
  }

  correctAdminClassification(id: string): Promise<ClassificationEditor> {
    return firstValueFrom(this.http.post<ClassificationEditor>(`${this.baseUrl}/admin/classifications/${id}/correct`, {}, this.options()));
  }

  getAdminClassificationDiagnostics(id: string): Promise<ClassificationDiagnostics> {
    return firstValueFrom(this.http.get<ClassificationDiagnostics>(`${this.baseUrl}/admin/classifications/${id}/diagnostics`, this.options()));
  }

  approveAdminClassification(id: string): Promise<AdminClassification> {
    return firstValueFrom(this.http.post<AdminClassification>(`${this.baseUrl}/admin/classifications/${id}/approve`, {}, this.options()));
  }

  listAdminAssignments(): Promise<AdminAssignment[]> {
    return firstValueFrom(this.http.get<AdminAssignment[]>(`${this.baseUrl}/admin/assignments`, this.options()));
  }

  listAdminFulfillments(status?: string): Promise<AdminFulfillment[]> {
    return firstValueFrom(this.http.get<AdminFulfillment[]>(`${this.baseUrl}/admin/fulfillments`, { ...this.options(), params: status ? { status } : {} }));
  }

  scoreFulfillment(fulfillmentId: string): Promise<AdminScoreResult> {
    return firstValueFrom(this.http.post<AdminScoreResult>(`${this.baseUrl}/admin/fulfillments/${fulfillmentId}/score`, {}, this.options()));
  }

  adminAssign(fulfillmentId: string, body: { bookEditionId: string; classificationVersionId: string; candidateId?: string; notes?: string; reason?: string }): Promise<unknown> {
    return firstValueFrom(this.http.post(`${this.baseUrl}/admin/fulfillments/${fulfillmentId}/assignments`, body, this.options()));
  }

  adminReplace(assignmentId: string, body: { bookEditionId: string; classificationVersionId: string; candidateId?: string; notes?: string; reason?: string }): Promise<unknown> {
    return firstValueFrom(this.http.post(`${this.baseUrl}/admin/assignments/${assignmentId}/replace`, body, this.options()));
  }

  adminAction(action: 'pack' | 'ship' | 'in-delivery' | 'delivered' | 'close-without-feedback' | 'reissue-invitation' | 'unpack' | 'unship' | 'undo-in-delivery' | 'undo-delivered', assignmentId: string): Promise<{ plainToken?: string; url?: string }> {
    return firstValueFrom(this.http.post<{ plainToken?: string; url?: string }>(`${this.baseUrl}/admin/assignments/${assignmentId}/${action}`, {}, this.options()));
  }

  adminReopenLearning(assignmentId: string, reason: string): Promise<{ plainToken: string; url: string }> {
    return firstValueFrom(this.http.post<{ plainToken: string; url: string }>(`${this.baseUrl}/admin/assignments/${assignmentId}/reopen-learning`, { reason }, this.options()));
  }

  getFeedbackInvitation(token: string): Promise<{ received: boolean; book: { title: string; editionTitle: string; languageCode: string; authors: string[]; contributors: string[] } }> {
    return firstValueFrom(this.http.get<{ received: boolean; book: { title: string; editionTitle: string; languageCode: string; authors: string[]; contributors: string[] } }>(`${this.baseUrl}/feedback/${encodeURIComponent(token)}`, this.options()));
  }

  submitFeedbackByToken(token: string, body: Record<string, unknown>): Promise<unknown> {
    return firstValueFrom(this.http.post(`${this.baseUrl}/feedback/${encodeURIComponent(token)}`, body, this.options()));
  }

  private options() {
    const token = this.auth.accessToken;
    return token ? { headers: new HttpHeaders({ Authorization: `Bearer ${token}` }) } : {};
  }
}
