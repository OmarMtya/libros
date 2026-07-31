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
  validation: { maxItems?: number } | null;
  options: Array<{ key: string; label: string }>;
};

export type BookResult = {
  openLibraryId: string;
  openLibraryEditionId: string | null;
  title: string;
  authors: string[];
  firstPublishYear: number | null;
  coverUrl: string | null;
};

export type Tag = { tagKey: string; name: string; tagType: string };

export type Session = { id: string; userId: string; status: string };
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

export type ProductPackage = { key: 'libro_sorpresa_fisico' | 'libro_sorpresa_completo'; name: string; description: string; priceCents: number; shippingCents: number; currency: string; includedFormats: string[] };
export type ShippingAddress = { recipientName: string; phone: string; street: string; exteriorNumber: string; interiorNumber?: string; neighborhood: string; city: string; state: string; postalCode: string; references?: string };
export type CurrentUser = { id: string; email: string | null; displayName: string | null; role: 'customer' | 'admin' };
export type AdminUser = { id: string; email: string | null; displayName: string | null; role: string; createdAt: string; readerProfile: { readyToRecommend: boolean; currentVersion: number; updatedAt: string } | null; _count: { orders: number; readingFeedback: number } };

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly auth = inject(AuthService);
  private readonly baseUrl = window.LIBROS_CONFIG?.apiUrl ?? 'http://localhost:3000/v1';

  constructor(private readonly http: HttpClient) {}

  createSession(): Promise<Session> {
    return firstValueFrom(this.http.post<Session>(`${this.baseUrl}/questionnaire-sessions`, {}, this.options()));
  }

  nextQuestion(sessionId: string): Promise<Question | null> {
    return firstValueFrom(this.http.get<Question | null>(`${this.baseUrl}/questionnaire-sessions/${sessionId}/next-question`, this.options()));
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

  createCheckout(packageKey: ProductPackage['key'], shippingAddress: ShippingAddress): Promise<{ orderId: string; checkoutUrl: string }> {
    return firstValueFrom(this.http.post<{ orderId: string; checkoutUrl: string }>(`${this.baseUrl}/orders/checkout`, { packageKey, shippingAddress }, this.options()));
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

  private options() {
    const token = this.auth.accessToken;
    return token ? { headers: new HttpHeaders({ Authorization: `Bearer ${token}` }) } : {};
  }
}
