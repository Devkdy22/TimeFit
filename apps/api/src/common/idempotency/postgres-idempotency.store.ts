import { ConflictException, Injectable } from '@nestjs/common';
import { createHash } from 'crypto';

type IdempotencyStatus = 'PENDING' | 'COMPLETED' | 'FAILED';

type IdempotencyRow = {
  id: string;
  userId: string;
  scope: string;
  key: string;
  payloadHash: string;
  status: IdempotencyStatus;
  responseSnapshot: unknown | null;
  expiresAt: Date;
};

type IdempotencyDbClient = {
  idempotencyKey: {
    create(args: {
      data: {
        userId: string;
        scope: string;
        key: string;
        payloadHash: string;
        status: IdempotencyStatus;
        expiresAt: Date;
      };
    }): Promise<IdempotencyRow>;
    findUnique(args: {
      where: { userId_scope_key: { userId: string; scope: string; key: string } };
    }): Promise<IdempotencyRow | null>;
    update(args: {
      where: { userId_scope_key: { userId: string; scope: string; key: string } };
      data: {
        status: IdempotencyStatus;
        responseSnapshot?: unknown;
        expiresAt?: Date;
      };
    }): Promise<IdempotencyRow>;
    deleteMany(args: {
      where: {
        userId?: string;
        scope?: string;
        key?: string;
        expiresAt?: { lte: Date };
        status?: IdempotencyStatus;
      };
    }): Promise<{ count: number }>;
  };
};

export interface IdempotencyBeginInput {
  userId: string;
  scope: string;
  key: string;
  payload: unknown;
}

export interface IdempotencyReplay<TResponse> {
  replayed: boolean;
  response?: TResponse;
}

const TTL_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class PostgresIdempotencyStore {
  private prisma: IdempotencyDbClient | null = null;

  async begin<TResponse>(
    input: IdempotencyBeginInput,
  ): Promise<IdempotencyReplay<TResponse>> {
    const prisma = await this.getPrismaClient();
    const payloadHash = hashPayload(input.payload);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + TTL_MS);

    await prisma.idempotencyKey.deleteMany({
      where: {
        userId: input.userId,
        scope: input.scope,
        key: input.key,
        expiresAt: { lte: now },
      },
    });

    try {
      await prisma.idempotencyKey.create({
        data: {
          userId: input.userId,
          scope: input.scope,
          key: input.key,
          payloadHash,
          status: 'PENDING',
          expiresAt,
        },
      });
      return { replayed: false };
    } catch (error) {
      if (!isUniqueConflict(error)) {
        throw error;
      }
    }

    const existing = await prisma.idempotencyKey.findUnique({
      where: {
        userId_scope_key: {
          userId: input.userId,
          scope: input.scope,
          key: input.key,
        },
      },
    });

    if (!existing) {
      return this.begin(input);
    }

    if (existing.payloadHash !== payloadHash) {
      throw new ConflictException({
        code: 'IDEMPOTENCY_CONFLICT',
        message: 'Idempotency key was reused with different payload',
      });
    }

    if (existing.status === 'PENDING') {
      throw new ConflictException({
        code: 'IDEMPOTENCY_PENDING',
        message: 'Request with this idempotency key is already in progress',
      });
    }

    if (existing.status === 'FAILED') {
      throw new ConflictException({
        code: 'IDEMPOTENCY_FAILED',
        message: 'Previous request with this idempotency key failed',
      });
    }

    return { replayed: true, response: existing.responseSnapshot as TResponse };
  }

  async complete(input: IdempotencyBeginInput, responseSnapshot: unknown): Promise<void> {
    const prisma = await this.getPrismaClient();
    await prisma.idempotencyKey.update({
      where: {
        userId_scope_key: {
          userId: input.userId,
          scope: input.scope,
          key: input.key,
        },
      },
      data: {
        status: 'COMPLETED',
        responseSnapshot,
        expiresAt: new Date(Date.now() + TTL_MS),
      },
    });
  }

  async clearPending(input: Pick<IdempotencyBeginInput, 'userId' | 'scope' | 'key'>): Promise<void> {
    const prisma = await this.getPrismaClient();
    await prisma.idempotencyKey.deleteMany({
      where: {
        userId: input.userId,
        scope: input.scope,
        key: input.key,
        status: 'PENDING',
      },
    });
  }

  async cleanupExpired(now = new Date()): Promise<number> {
    const prisma = await this.getPrismaClient();
    const result = await prisma.idempotencyKey.deleteMany({
      where: { expiresAt: { lte: now } },
    });
    return result.count;
  }

  private async getPrismaClient(): Promise<IdempotencyDbClient> {
    if (this.prisma) {
      return this.prisma;
    }

    const globalForPrisma = globalThis as unknown as { prisma?: IdempotencyDbClient };
    const prismaModule = (await import('@prisma/client')) as unknown as {
      PrismaClient: new () => IdempotencyDbClient;
    };

    this.prisma = globalForPrisma.prisma ?? new prismaModule.PrismaClient();
    if (!globalForPrisma.prisma) {
      globalForPrisma.prisma = this.prisma;
    }

    return this.prisma;
  }
}

function hashPayload(payload: unknown): string {
  return createHash('sha256').update(stableStringify(payload)).digest('hex');
}

function stableStringify(input: unknown): string {
  if (input === null || typeof input !== 'object') {
    return JSON.stringify(input);
  }

  if (Array.isArray(input)) {
    return `[${input.map((item) => stableStringify(item)).join(',')}]`;
  }

  const obj = input as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  const pairs = keys.map((key) => `${JSON.stringify(key)}:${stableStringify(obj[key])}`);
  return `{${pairs.join(',')}}`;
}

function isUniqueConflict(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === 'P2002'
  );
}
