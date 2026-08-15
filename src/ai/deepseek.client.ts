import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';

const DEEPSEEK_BASE_URL = 'https://api.deepseek.com';
const DEEPSEEK_MODEL = 'deepseek-v4-flash';
const DEFAULT_MAX_TOKENS = 65536;

export type DeepseekChatJsonInput = {
  system: string;
  user: string;
  maxTokens?: number;
};

export type DeepseekChatTextInput = {
  system: string;
  user: string;
  maxTokens?: number;
};

export class DeepseekClient {
  constructor(private readonly apiKey: string) {}

  async chatJson({ system, user, maxTokens = DEFAULT_MAX_TOKENS }: DeepseekChatJsonInput): Promise<Record<string, unknown>> {
    if (!this.apiKey) {
      throw new ServiceUnavailableException('DEEPSEEK_API_KEY no está configurada. Agrega la llave al .env y reinicia el AppHost.');
    }
    for (let attempt = 1; attempt <= 2; attempt++) {
      const content = await this.complete({ system, user, maxTokens, responseFormat: 'json', reasoningEffort: 'high' });
      const parsed = this.tryParse(content);
      if (parsed !== null) return parsed;
    }
    throw new BadRequestException('La IA no devolvió un JSON válido. Inténtalo de nuevo.');
  }

  async chatText({ system, user, maxTokens }: DeepseekChatTextInput): Promise<string> {
    if (!this.apiKey) {
      throw new ServiceUnavailableException('DEEPSEEK_API_KEY no está configurada. Agrega la llave al .env y reinicia el AppHost.');
    }
    return this.complete({ system, user, maxTokens: maxTokens ?? DEFAULT_MAX_TOKENS, responseFormat: 'text', reasoningEffort: 'low' });
  }

  private async complete(input: { system: string; user: string; maxTokens: number; responseFormat: 'json' | 'text'; reasoningEffort: 'high' | 'low' }): Promise<string> {
    const response = await fetch(`${DEEPSEEK_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: DEEPSEEK_MODEL,
        messages: [
          { role: 'system', content: input.system },
          { role: 'user', content: input.user },
        ],
        reasoning_effort: input.reasoningEffort,
        response_format: input.responseFormat === 'json' ? { type: 'json_object' } : { type: 'text' },
        max_tokens: input.maxTokens,
      }),
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new ServiceUnavailableException(`Deepseek respondió ${response.status}: ${detail.slice(0, 300)}`);
    }
    const data = (await response.json()) as { choices?: Array<{ message?: { content?: string | null } }> };
    return data.choices?.[0]?.message?.content ?? '';
  }

  private tryParse(content: string): Record<string, unknown> | null {
    const cleaned = content.trim().replace(/^```(?:json)?/m, '').replace(/```$/m, '').trim();
    if (!cleaned) return null;
    try {
      const value = JSON.parse(cleaned) as unknown;
      if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>;
      return null;
    } catch {
      return null;
    }
  }
}
