import { Injectable } from '@nestjs/common';

interface TrafficSnapshotPayload {
  key: string;
  congestionIndex: number;
  ttlSeconds: number;
}

interface TrafficSnapshotRow {
  key: string;
  congestionIndex: number;
  ttlSeconds: number;
  expiresAt: Date;
  createdAt: Date;
}

type TrafficSnapshotDbClient = {
  trafficSnapshot: {
    findFirst(args: {
      where: { key: string; expiresAt: { gt: Date } };
      orderBy: { createdAt: 'desc' };
    }): Promise<{ id: string; congestionIndex: number; ttlSeconds: number; expiresAt: Date; createdAt: Date } | null>;
    update(args: {
      where: { id: string };
      data: { congestionIndex: number; ttlSeconds: number; expiresAt: Date; createdAt: Date };
    }): Promise<unknown>;
    create(args: {
      data: { key: string; congestionIndex: number; ttlSeconds: number; expiresAt: Date };
    }): Promise<unknown>;
  };
};

let dbUnavailableLogged = false;

@Injectable()
export class TrafficSnapshotRepository {
  // Keep a local fallback for development/test runs where PostgreSQL is not
  // available. Production uses the shared Prisma table below.
  private readonly table = new Map<string, TrafficSnapshotRow>();
  private prisma: TrafficSnapshotDbClient | null = null;

  async findValidByKey(
    key: string,
  ): Promise<{ congestionIndex: number; ttlSeconds: number; freshnessScore: number } | null> {
    const now = new Date();
    try {
      const snapshot = await (await this.getPrismaClient()).trafficSnapshot.findFirst({
        where: { key, expiresAt: { gt: now } },
        orderBy: { createdAt: 'desc' },
      });
      return snapshot ? this.toFreshness(snapshot) : null;
    } catch (error) {
      if (!this.isDbConnectionError(error)) throw error;
      this.logDbFallback(error);
      return this.findMemorySnapshot(key, now);
    }
  }

  async upsert(payload: TrafficSnapshotPayload): Promise<void> {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + payload.ttlSeconds * 1000);
    try {
      const prisma = await this.getPrismaClient();
      const existing = await prisma.trafficSnapshot.findFirst({
        where: { key: payload.key, expiresAt: { gt: now } },
        orderBy: { createdAt: 'desc' },
      });
      if (existing) {
        await prisma.trafficSnapshot.update({
          where: { id: existing.id },
          data: {
            congestionIndex: payload.congestionIndex,
            ttlSeconds: payload.ttlSeconds,
            expiresAt,
            createdAt: now,
          },
        });
      } else {
        await prisma.trafficSnapshot.create({
          data: {
            key: payload.key,
            congestionIndex: payload.congestionIndex,
            ttlSeconds: payload.ttlSeconds,
            expiresAt,
          },
        });
      }
    } catch (error) {
      if (!this.isDbConnectionError(error)) throw error;
      this.logDbFallback(error);
      this.table.set(payload.key, {
        key: payload.key,
        congestionIndex: payload.congestionIndex,
        ttlSeconds: payload.ttlSeconds,
        expiresAt,
        createdAt: now,
      });
    }
  }

  private findMemorySnapshot(key: string, now: Date) {
    const snapshot = this.table.get(key);
    if (!snapshot || snapshot.expiresAt <= now) {
      if (snapshot) this.table.delete(key);
      return null;
    }
    return this.toFreshness(snapshot);
  }

  private toFreshness(snapshot: { congestionIndex: number; ttlSeconds: number; expiresAt: Date; createdAt: Date }) {
    return {
      congestionIndex: snapshot.congestionIndex,
      ttlSeconds: snapshot.ttlSeconds,
      freshnessScore: Math.max(
        0,
        Math.min(1, 1 - (Date.now() - snapshot.createdAt.getTime()) / Math.max(1, snapshot.ttlSeconds * 1000)),
      ),
    };
  }

  private async getPrismaClient(): Promise<TrafficSnapshotDbClient> {
    if (this.prisma) return this.prisma;
    const globalForPrisma = globalThis as unknown as { prisma?: TrafficSnapshotDbClient };
    const prismaModule = (await import('@prisma/client')) as unknown as {
      PrismaClient: new () => TrafficSnapshotDbClient;
    };
    this.prisma = globalForPrisma.prisma ?? new prismaModule.PrismaClient();
    if (!globalForPrisma.prisma) globalForPrisma.prisma = this.prisma;
    return this.prisma;
  }

  private isDbConnectionError(error: unknown): boolean {
    const value = error as { code?: string; message?: string; cause?: { code?: string; message?: string } };
    const code = `${value?.code ?? ''} ${value?.cause?.code ?? ''}`.toUpperCase();
    const message = `${value?.message ?? ''} ${value?.cause?.message ?? ''}`.toLowerCase();
    return (
      code.includes('P1001') ||
      code.includes('ECONNREFUSED') ||
      message.includes("can't reach database server") ||
      message.includes('connect econnrefused')
    );
  }

  private logDbFallback(error: unknown): void {
    if (dbUnavailableLogged) return;
    dbUnavailableLogged = true;
    // eslint-disable-next-line no-console
    console.warn('[TrafficSnapshotRepository] database unavailable; using in-process cache fallback', {
      reason: error instanceof Error ? error.message : 'unknown_error',
    });
  }
}
