import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class ReadinessService {
  private readonly prisma = new PrismaClient();

  async checkDatabase(): Promise<void> {
    await this.prisma.$queryRaw`SELECT 1`;
  }
}
