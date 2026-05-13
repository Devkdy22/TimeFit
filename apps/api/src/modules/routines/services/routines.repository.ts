import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { RoutineEntity } from '../types/routine.types';

type CreateRoutineInput = Omit<
  RoutineEntity,
  'id' | 'active' | 'lastTriggeredAt' | 'createdAt' | 'updatedAt'
>;

@Injectable()
export class RoutinesRepository {
  private readonly store = new Map<string, RoutineEntity>();

  create(input: CreateRoutineInput): RoutineEntity {
    const now = new Date().toISOString();
    const entity: RoutineEntity = {
      id: randomUUID(),
      userId: input.userId,
      title: input.title,
      origin: input.origin,
      destination: input.destination,
      weekdays: [...new Set(input.weekdays)].sort((a, b) => a - b),
      arrivalTime: input.arrivalTime,
      savedRoute: input.savedRoute,
      expoPushToken: input.expoPushToken,
      active: true,
      createdAt: now,
      updatedAt: now,
    };

    this.store.set(entity.id, entity);
    return entity;
  }

  findByUser(userId: string): RoutineEntity[] {
    return [...this.store.values()].filter((routine) => routine.userId === userId);
  }

  findActive(): RoutineEntity[] {
    return [...this.store.values()].filter((routine) => routine.active);
  }

  findById(id: string): RoutineEntity {
    const routine = this.store.get(id);
    if (!routine) {
      throw new NotFoundException('Routine not found');
    }
    return routine;
  }

  markTriggered(id: string, triggeredAtIso: string): RoutineEntity {
    const routine = this.findById(id);
    const next: RoutineEntity = {
      ...routine,
      lastTriggeredAt: triggeredAtIso,
      updatedAt: triggeredAtIso,
    };
    this.store.set(id, next);
    return next;
  }
}
