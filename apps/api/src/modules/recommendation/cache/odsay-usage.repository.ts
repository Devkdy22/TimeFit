import { Injectable } from '@nestjs/common';
import type { OdsayUsageSnapshot } from '../types/transit';

let dbUnavailableLogged = false;

@Injectable()
export class OdsayUsageRepository {
  private prisma: any;

  async increment(date: string, timezone: string, deltas: Partial<Record<keyof Omit<OdsayUsageSnapshot, 'date' | 'timezone'>, number>>) {
    const prisma = this.getPrismaClient();
    const payload = this.normalizeDeltas(deltas);

    try {
      await prisma.odsayUsageDaily.upsert({
        where: { date },
        create: {
          date,
          timezone,
          ...payload,
        },
        update: {
          totalRequests: { increment: payload.totalRequests },
          externalApiCalls: { increment: payload.externalApiCalls },
          cacheHits: { increment: payload.cacheHits },
          staleFallbackHits: { increment: payload.staleFallbackHits },
          deduplicatedRequests: { increment: payload.deduplicatedRequests },
          successResponses: { increment: payload.successResponses },
          failedResponses: { increment: payload.failedResponses },
        },
      });
    } catch (error) {
      if (this.isDbConnectionError(error)) {
        if (!dbUnavailableLogged) {
          dbUnavailableLogged = true;
          console.warn('[OdsayUsageRepository] database unavailable; suppressing usage persistence logs', {
            reason: this.extractErrorReason(error),
          });
        }
        return;
      }
      throw error;
    }
  }

  async findByDate(date: string): Promise<OdsayUsageSnapshot | null> {
    const prisma = this.getPrismaClient();
    const found = await prisma.odsayUsageDaily.findUnique({ where: { date } });
    if (!found) {
      return null;
    }

    return {
      date: found.date,
      timezone: found.timezone,
      totalRequests: found.totalRequests,
      externalApiCalls: found.externalApiCalls,
      cacheHits: found.cacheHits,
      staleFallbackHits: found.staleFallbackHits,
      deduplicatedRequests: found.deduplicatedRequests,
      successResponses: found.successResponses,
      failedResponses: found.failedResponses,
    };
  }

  private normalizeDeltas(deltas: Partial<Record<string, number>>) {
    return {
      totalRequests: Math.max(0, deltas.totalRequests ?? 0),
      externalApiCalls: Math.max(0, deltas.externalApiCalls ?? 0),
      cacheHits: Math.max(0, deltas.cacheHits ?? 0),
      staleFallbackHits: Math.max(0, deltas.staleFallbackHits ?? 0),
      deduplicatedRequests: Math.max(0, deltas.deduplicatedRequests ?? 0),
      successResponses: Math.max(0, deltas.successResponses ?? 0),
      failedResponses: Math.max(0, deltas.failedResponses ?? 0),
    };
  }

  private getPrismaClient() {
    if (this.prisma) {
      return this.prisma;
    }

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { PrismaClient } = require('@prisma/client');
    const globalForPrisma = globalThis as unknown as { prisma?: any };
    this.prisma = globalForPrisma.prisma ?? new PrismaClient();
    if (!globalForPrisma.prisma) {
      globalForPrisma.prisma = this.prisma;
    }
    return this.prisma;
  }

  private isDbConnectionError(error: unknown): boolean {
    const err = error as {
      code?: string;
      message?: string;
      cause?: { code?: string; message?: string };
    };
    const code = String(err?.code ?? '').toUpperCase();
    const causeCode = String(err?.cause?.code ?? '').toUpperCase();
    const message = String(err?.message ?? '').toLowerCase();
    const causeMessage = String(err?.cause?.message ?? '').toLowerCase();

    if (code === 'P1001' || causeCode === 'P1001') {
      return true;
    }
    if (code === 'ECONNREFUSED' || causeCode === 'ECONNREFUSED') {
      return true;
    }

    return (
      message.includes("can't reach database server") ||
      message.includes('connect econnrefused') ||
      causeMessage.includes("can't reach database server") ||
      causeMessage.includes('connect econnrefused')
    );
  }

  private extractErrorReason(error: unknown): string {
    if (error instanceof Error && error.message) {
      return error.message;
    }
    return 'unknown_error';
  }
}
