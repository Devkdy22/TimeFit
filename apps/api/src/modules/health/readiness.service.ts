import { Injectable } from '@nestjs/common';

type ReadinessDbClient = {
  $queryRaw(strings: TemplateStringsArray, ...values: unknown[]): Promise<unknown>;
};

@Injectable()
export class ReadinessService {
  private prisma: ReadinessDbClient | null = null;

  async checkDatabase(): Promise<void> {
    await (await this.getPrismaClient()).$queryRaw`SELECT 1`;
  }

  private async getPrismaClient(): Promise<ReadinessDbClient> {
    if (this.prisma) return this.prisma;
    const globalForPrisma = globalThis as unknown as { prisma?: ReadinessDbClient };
    const prismaModule = (await import('@prisma/client')) as unknown as {
      PrismaClient: new () => ReadinessDbClient;
    };
    this.prisma = globalForPrisma.prisma ?? new prismaModule.PrismaClient();
    if (!globalForPrisma.prisma) globalForPrisma.prisma = this.prisma;
    return this.prisma;
  }
}
