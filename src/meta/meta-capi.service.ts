import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'crypto';

const DEFAULT_GRAPH_VERSION = 'v23.0';
const MEXICO_COUNTRY_CODE = '52';
const MAX_FBC_LENGTH = 200;

export function decodeFbcFromClientReference(encoded: string): string | null {
  if (!encoded || !/^[A-Za-z0-9_-]+$/.test(encoded)) return null;
  try {
    const fbc = Buffer.from(encoded, 'base64url').toString('utf8');
    return fbc.startsWith('fb.1.') && fbc.length <= MAX_FBC_LENGTH ? fbc : null;
  } catch {
    return null;
  }
}

export type MetaUserData = {
  email?: string | null;
  phone?: string | null;
  externalId?: string | null;
  clientIpAddress?: string | null;
  clientUserAgent?: string | null;
  fbp?: string | null;
  fbc?: string | null;
};

export type MetaCapiEvent = {
  eventName: string;
  eventId?: string | null;
  eventTime?: number;
  actionSource?: 'website' | 'system_generated' | 'email' | 'other';
  userData?: MetaUserData;
  customData?: Record<string, unknown>;
};

@Injectable()
export class MetaCapiService {
  private readonly logger = new Logger(MetaCapiService.name);

  get configured(): boolean {
    return process.env.NODE_ENV === 'production' && Boolean(process.env.META_PIXEL_ID && process.env.META_CAPI_ACCESS_TOKEN);
  }

  async sendEvents(events: MetaCapiEvent[]): Promise<void> {
    if (events.length === 0) return;
    if (process.env.NODE_ENV !== 'production') return;
    const pixelId = process.env.META_PIXEL_ID;
    const accessToken = process.env.META_CAPI_ACCESS_TOKEN;
    if (!pixelId || !accessToken) return;
    const version = process.env.META_CAPI_GRAPH_VERSION ?? DEFAULT_GRAPH_VERSION;
    const url = new URL(`https://graph.facebook.com/${version}/${pixelId}/events`);
    url.searchParams.set('access_token', accessToken);
    const testEventCode = process.env.META_CAPI_TEST_EVENT_CODE ?? null;
    if (testEventCode) url.searchParams.set('test_event_code', testEventCode);

    const batch = events.map((event) => this.buildEvent(event, testEventCode));
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: batch }),
      });
      const body = (await response.json().catch(() => null)) as
        | { events_received?: number; messages?: string[]; error?: { message?: string } }
        | null;
      if (!response.ok || body?.events_received !== batch.length) {
        this.logger.warn(
          `Meta CAPI ${events.map((event) => event.eventName).join(', ')} no entregado (HTTP ${response.status}): ${JSON.stringify(body).slice(0, 500)}`,
        );
      }
    } catch (error) {
      this.logger.warn(`Meta CAPI: error enviando ${events.length} evento(s): ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  sendEvent(event: MetaCapiEvent): Promise<void> {
    return this.sendEvents([event]);
  }

  private buildEvent(event: MetaCapiEvent, testEventCode: string | null): Record<string, unknown> {
    const payload: Record<string, unknown> = {
      event_name: event.eventName,
      event_time: event.eventTime ?? Math.floor(Date.now() / 1000),
      action_source: event.actionSource ?? 'website',
    };
    if (event.eventId) payload.event_id = event.eventId;
    if (testEventCode) payload.test_event_code = testEventCode;
    const userData = this.buildUserData(event.userData);
    if (userData) payload.user_data = userData;
    if (event.customData) payload.custom_data = event.customData;
    return payload;
  }

  private buildUserData(data?: MetaUserData): Record<string, unknown> | null {
    if (!data) return null;
    const userData: Record<string, unknown> = {};
    if (data.email) userData.em = this.sha256(data.email);
    if (data.phone) userData.ph = this.sha256(this.normalizePhone(data.phone));
    if (data.externalId) userData.external_id = this.sha256(data.externalId);
    if (data.clientIpAddress) userData.client_ip_address = data.clientIpAddress;
    if (data.clientUserAgent) userData.client_user_agent = data.clientUserAgent;
    if (data.fbp) userData.fbp = data.fbp;
    if (data.fbc) userData.fbc = data.fbc;
    return Object.keys(userData).length > 0 ? userData : null;
  }

  private sha256(value: string): string {
    return createHash('sha256').update(value.trim().toLowerCase()).digest('hex');
  }

  private normalizePhone(phone: string): string {
    let digits = phone.replace(/\D/g, '');
    if (digits.length === 10) digits = `${MEXICO_COUNTRY_CODE}${digits}`;
    else if (digits.length === 11 && digits.startsWith('1')) digits = `${MEXICO_COUNTRY_CODE}${digits.slice(1)}`;
    return digits;
  }
}
