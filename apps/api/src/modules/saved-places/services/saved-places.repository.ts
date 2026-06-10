import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { SavedPlaceEntity } from '../types/saved-place.types';

type SavedPlaceDbClient = {
  savedPlace: {
    findMany(args: {
      where: { userId: string };
      orderBy: { updatedAt: 'desc' | 'asc' };
    }): Promise<
      Array<{
        id: string;
        userId: string;
        label: string;
        normalizedLabel: string;
        address: string;
        lat: number;
        lng: number;
        createdAt: Date;
        updatedAt: Date;
      }>
    >;
    findUnique(args: {
      where: { id: string };
      select: { id: true; userId: true };
    }): Promise<{ id: string; userId: string } | null>;
    upsert(args: {
      where: { userId_normalizedLabel: { userId: string; normalizedLabel: string } };
      update: { label: string; address: string; lat: number; lng: number };
      create: {
        userId: string;
        label: string;
        normalizedLabel: string;
        address: string;
        lat: number;
        lng: number;
      };
    }): Promise<{
      id: string;
      userId: string;
      label: string;
      normalizedLabel: string;
      address: string;
      lat: number;
      lng: number;
      createdAt: Date;
      updatedAt: Date;
    }>;
    delete(args: { where: { id: string } }): Promise<void>;
  };
};

@Injectable()
export class SavedPlacesRepository {
  private prisma: SavedPlaceDbClient | null = null;

  async findByUser(userId: string): Promise<SavedPlaceEntity[]> {
    const prisma = await this.getPrismaClient();
    const places = await prisma.savedPlace.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
    });
    return places.map((place) => this.toEntity(place));
  }

  async createOrUpdateByLabel(input: {
    userId: string;
    label: string;
    normalizedLabel: string;
    address: string;
    lat: number;
    lng: number;
  }): Promise<SavedPlaceEntity> {
    const prisma = await this.getPrismaClient();
    const row = await prisma.savedPlace.upsert({
      where: {
        userId_normalizedLabel: {
          userId: input.userId,
          normalizedLabel: input.normalizedLabel,
        },
      },
      update: {
        label: input.label,
        address: input.address,
        lat: input.lat,
        lng: input.lng,
      },
      create: {
        userId: input.userId,
        label: input.label,
        normalizedLabel: input.normalizedLabel,
        address: input.address,
        lat: input.lat,
        lng: input.lng,
      },
    });
    return this.toEntity(row);
  }

  async deleteOwned(userId: string, id: string): Promise<void> {
    const prisma = await this.getPrismaClient();
    const place = await prisma.savedPlace.findUnique({
      where: { id },
      select: { id: true, userId: true },
    });

    if (!place) {
      throw new NotFoundException({
        code: 'SAVED_PLACE_NOT_FOUND',
        message: 'Saved place not found',
      });
    }

    if (place.userId !== userId) {
      throw new ForbiddenException({
        code: 'SAVED_PLACE_FORBIDDEN',
        message: 'You do not have access to this saved place',
      });
    }

    await prisma.savedPlace.delete({ where: { id } });
  }

  private async getPrismaClient(): Promise<SavedPlaceDbClient> {
    if (this.prisma) {
      return this.prisma;
    }

    const globalForPrisma = globalThis as unknown as { prisma?: SavedPlaceDbClient };
    const prismaModule = (await import('@prisma/client')) as unknown as {
      PrismaClient: new () => SavedPlaceDbClient;
    };

    this.prisma = globalForPrisma.prisma ?? new prismaModule.PrismaClient();
    if (!globalForPrisma.prisma) {
      globalForPrisma.prisma = this.prisma;
    }

    return this.prisma;
  }

  private toEntity(place: {
    id: string;
    userId: string;
    label: string;
    normalizedLabel: string;
    address: string;
    lat: number;
    lng: number;
    createdAt: Date;
    updatedAt: Date;
  }): SavedPlaceEntity {
    return {
      id: place.id,
      userId: place.userId,
      label: place.label,
      address: place.address,
      lat: place.lat,
      lng: place.lng,
      createdAt: place.createdAt.toISOString(),
      updatedAt: place.updatedAt.toISOString(),
    };
  }
}
