import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { RouteCandidate } from '../../recommendation/types/recommendation.types';
import type { RoutineEntity } from '../types/routine.types';

type RoutineRow = {
  id: string;
  userId: string;
  title: string;
  originName: string;
  originLat: number;
  originLng: number;
  destinationName: string;
  destinationLat: number;
  destinationLng: number;
  weekdays: number[];
  arrivalTime: string;
  notificationEnabled: boolean;
  notificationMinutesBefore: number;
  favorite: boolean;
  active: boolean;
  savedRoute: unknown | null;
  expoPushToken: string | null;
  lastTriggeredAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type CreateRoutineInput = Omit<
  RoutineEntity,
  'id' | 'active' | 'lastTriggeredAt' | 'createdAt' | 'updatedAt'
> & {
  active?: boolean;
};

type UpdateRoutineInput = Partial<
  Pick<
    RoutineEntity,
    | 'title'
    | 'origin'
    | 'destination'
    | 'weekdays'
    | 'arrivalTime'
    | 'notificationEnabled'
    | 'notificationMinutesBefore'
    | 'favorite'
    | 'active'
    | 'savedRoute'
    | 'expoPushToken'
  >
>;

type RoutineDbClient = {
  routine: {
    create(args: { data: Record<string, unknown> }): Promise<RoutineRow>;
    findMany(args: {
      where: { userId?: string; active?: boolean };
      orderBy: { updatedAt: 'desc' | 'asc' };
    }): Promise<RoutineRow[]>;
    findUnique(args: {
      where: { id: string };
      select?: { id: true; userId: true };
    }): Promise<RoutineRow | { id: string; userId: string } | null>;
    update(args: { where: { id: string }; data: Record<string, unknown> }): Promise<RoutineRow>;
    delete(args: { where: { id: string } }): Promise<void>;
  };
};

@Injectable()
export class RoutinesRepository {
  private prisma: RoutineDbClient | null = null;

  async create(input: CreateRoutineInput): Promise<RoutineEntity> {
    const prisma = await this.getPrismaClient();
    const row = await prisma.routine.create({
      data: {
        userId: input.userId,
        title: input.title,
        originName: input.origin.name,
        originLat: input.origin.lat,
        originLng: input.origin.lng,
        destinationName: input.destination.name,
        destinationLat: input.destination.lat,
        destinationLng: input.destination.lng,
        weekdays: this.normalizeWeekdays(input.weekdays),
        arrivalTime: input.arrivalTime,
        notificationEnabled: input.notificationEnabled,
        notificationMinutesBefore: input.notificationMinutesBefore,
        favorite: input.favorite,
        active: input.active ?? true,
        savedRoute: input.savedRoute ?? undefined,
        expoPushToken: input.expoPushToken,
      },
    });
    return this.toEntity(row);
  }

  async findByUser(userId: string): Promise<RoutineEntity[]> {
    const prisma = await this.getPrismaClient();
    const rows = await prisma.routine.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
    });
    return rows.map((row) => this.toEntity(row));
  }

  async findActive(): Promise<RoutineEntity[]> {
    const prisma = await this.getPrismaClient();
    const rows = await prisma.routine.findMany({
      where: { active: true },
      orderBy: { updatedAt: 'desc' },
    });
    return rows.map((row) => this.toEntity(row));
  }

  async findOwned(userId: string, id: string): Promise<RoutineEntity> {
    const row = await this.findById(id);
    if (row.userId !== userId) {
      throw new ForbiddenException('You do not have access to this routine');
    }
    return row;
  }

  async updateOwned(
    userId: string,
    id: string,
    input: UpdateRoutineInput,
  ): Promise<RoutineEntity> {
    await this.assertOwned(userId, id);
    const prisma = await this.getPrismaClient();
    const row = await prisma.routine.update({
      where: { id },
      data: this.toUpdateData(input),
    });
    return this.toEntity(row);
  }

  async deleteOwned(userId: string, id: string): Promise<void> {
    await this.assertOwned(userId, id);
    const prisma = await this.getPrismaClient();
    await prisma.routine.delete({ where: { id } });
  }

  async markTriggered(id: string, triggeredAtIso: string): Promise<RoutineEntity> {
    const prisma = await this.getPrismaClient();
    const row = await prisma.routine.update({
      where: { id },
      data: {
        lastTriggeredAt: new Date(triggeredAtIso),
      },
    });
    return this.toEntity(row);
  }

  private async findById(id: string): Promise<RoutineEntity> {
    const prisma = await this.getPrismaClient();
    const row = (await prisma.routine.findUnique({ where: { id } })) as RoutineRow | null;
    if (!row) {
      throw new NotFoundException('Routine not found');
    }
    return this.toEntity(row);
  }

  private async assertOwned(userId: string, id: string): Promise<void> {
    const prisma = await this.getPrismaClient();
    const row = (await prisma.routine.findUnique({
      where: { id },
      select: { id: true, userId: true },
    })) as { id: string; userId: string } | null;
    if (!row) {
      throw new NotFoundException('Routine not found');
    }
    if (row.userId !== userId) {
      throw new ForbiddenException('You do not have access to this routine');
    }
  }

  private toUpdateData(input: UpdateRoutineInput): Record<string, unknown> {
    const data: Record<string, unknown> = {};
    if (input.title !== undefined) {
      data.title = input.title;
    }
    if (input.origin !== undefined) {
      data.originName = input.origin.name;
      data.originLat = input.origin.lat;
      data.originLng = input.origin.lng;
    }
    if (input.destination !== undefined) {
      data.destinationName = input.destination.name;
      data.destinationLat = input.destination.lat;
      data.destinationLng = input.destination.lng;
    }
    if (input.weekdays !== undefined) {
      data.weekdays = this.normalizeWeekdays(input.weekdays);
    }
    if (input.arrivalTime !== undefined) {
      data.arrivalTime = input.arrivalTime;
    }
    if (input.notificationEnabled !== undefined) {
      data.notificationEnabled = input.notificationEnabled;
    }
    if (input.notificationMinutesBefore !== undefined) {
      data.notificationMinutesBefore = input.notificationMinutesBefore;
    }
    if (input.favorite !== undefined) {
      data.favorite = input.favorite;
    }
    if (input.active !== undefined) {
      data.active = input.active;
    }
    if (input.savedRoute !== undefined) {
      data.savedRoute = input.savedRoute;
    }
    if (input.expoPushToken !== undefined) {
      data.expoPushToken = input.expoPushToken;
    }
    return data;
  }

  private normalizeWeekdays(weekdays: number[]): number[] {
    return [...new Set(weekdays)].sort((a, b) => a - b);
  }

  private async getPrismaClient(): Promise<RoutineDbClient> {
    if (this.prisma) {
      return this.prisma;
    }

    const globalForPrisma = globalThis as unknown as { prisma?: RoutineDbClient };
    const prismaModule = (await import('@prisma/client')) as unknown as {
      PrismaClient: new () => RoutineDbClient;
    };

    this.prisma = globalForPrisma.prisma ?? new prismaModule.PrismaClient();
    if (!globalForPrisma.prisma) {
      globalForPrisma.prisma = this.prisma;
    }

    return this.prisma;
  }

  private toEntity(row: RoutineRow): RoutineEntity {
    return {
      id: row.id,
      userId: row.userId,
      title: row.title,
      origin: {
        name: row.originName,
        lat: row.originLat,
        lng: row.originLng,
      },
      destination: {
        name: row.destinationName,
        lat: row.destinationLat,
        lng: row.destinationLng,
      },
      weekdays: row.weekdays,
      arrivalTime: row.arrivalTime,
      notificationEnabled: row.notificationEnabled,
      notificationMinutesBefore: row.notificationMinutesBefore,
      favorite: row.favorite,
      savedRoute: (row.savedRoute ?? undefined) as RouteCandidate | undefined,
      expoPushToken: row.expoPushToken ?? undefined,
      active: row.active,
      lastTriggeredAt: row.lastTriggeredAt?.toISOString(),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
