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

@Injectable()
export class TrafficSnapshotRepository {
  // NOTE: DB 캐시 어댑터 자리. 현재는 Redis 없이 동작하도록 in-process table 형태로 유지.
  // Prisma 연결 시 TrafficSnapshot 모델로 교체하면 된다.
  private readonly table = new Map<string, TrafficSnapshotRow>();

  async findValidByKey(
    key: string,
  ): Promise<{ congestionIndex: number; ttlSeconds: number; freshnessScore: number } | null> {
    const snapshot = this.table.get(key);
    if (!snapshot) {
      return null;
    }

    if (snapshot.expiresAt <= new Date()) {
      this.table.delete(key);
      return null;
    }

    return {
      congestionIndex: snapshot.congestionIndex,
      ttlSeconds: snapshot.ttlSeconds,
      freshnessScore: Math.max(
        0,
        Math.min(
          1,
          1 -
            (Date.now() - snapshot.createdAt.getTime()) /
              Math.max(1, snapshot.ttlSeconds * 1000),
        ),
      ),
    };
  }

  async upsert(payload: TrafficSnapshotPayload): Promise<void> {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + payload.ttlSeconds * 1000);

    this.table.set(payload.key, {
      key: payload.key,
      congestionIndex: payload.congestionIndex,
      ttlSeconds: payload.ttlSeconds,
      expiresAt,
      createdAt: now,
    });
  }
}
