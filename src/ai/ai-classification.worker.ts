import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { AiClassificationJobsService } from './ai-classification-jobs.service';

@Injectable()
export class AiClassificationWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AiClassificationWorker.name);
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(private readonly jobs: AiClassificationJobsService) {}

  async onModuleInit(): Promise<void> {
    if (process.env.NODE_ENV === 'test' || process.env.AI_WORKER_DISABLED === 'true') return;
    try {
      const recovered = await this.jobs.recoverStuck();
      if (recovered > 0) this.logger.log(`Reanudados ${recovered} análisis de IA que quedaron pendientes tras un reinicio.`);
    } catch (error) {
      this.logger.warn('No se pudieron recuperar análisis de IA pendientes.', error as Error);
    }
    const ms = Math.max(1000, Number(process.env.AI_WORKER_POLL_MS ?? 2000));
    this.timer = setInterval(
      () => void this.jobs.tick().catch((error) => this.logger.error('Falló el worker de clasificación IA.', error as Error)),
      ms,
    );
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }
}
