import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Headers,
  HttpCode,
  Param,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiResponse } from '../../common/http/api-response';
import { SafeLogger } from '../../common/logger/safe-logger.service';
import { AuthAccessGuard, type AuthenticatedRequest } from '../auth/auth-access.guard';
import { CreateSavedPlaceDto } from './dto/create-saved-place.dto';
import { SavedPlaceIdempotencyStore } from './services/saved-place-idempotency.store';
import { SavedPlacesMetrics } from './services/saved-places.metrics';
import { SavedPlacesService } from './services/saved-places.service';

@Controller('me/places')
@UseGuards(AuthAccessGuard)
export class SavedPlacesController {
  constructor(
    private readonly savedPlacesService: SavedPlacesService,
    private readonly idempotencyStore: SavedPlaceIdempotencyStore,
    private readonly metrics: SavedPlacesMetrics,
    private readonly logger: SafeLogger,
  ) {}

  @Get()
  async list(@Req() request: AuthenticatedRequest) {
    const authUserId = request.authUserId;
    if (!authUserId) {
      throw new UnauthorizedException('Missing authenticated user');
    }

    return ApiResponse.ok(await this.savedPlacesService.list(authUserId));
  }

  @Post()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async create(
    @Req() request: AuthenticatedRequest,
    @Body() body: CreateSavedPlaceDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    const authUserId = request.authUserId;
    if (!authUserId) {
      throw new UnauthorizedException('Missing authenticated user');
    }

    const normalizedKey = this.validateIdempotencyKey(idempotencyKey);
    if (!normalizedKey) {
      const created = await this.savedPlacesService.create(authUserId, body);
      return ApiResponse.ok(created);
    }

    const idempotencyInput = {
      userId: authUserId,
      scope: 'saved-place:create',
      key: normalizedKey,
      payload: body,
    };

    const existing = await this.idempotencyStore.begin(idempotencyInput);
    if (existing.replayed && existing.response) {
      this.metrics.increment('saved_place_idempotency_hit_total', {
        authUserId,
        idempotencyKey: normalizedKey,
      });
      this.logger.log(
        {
          event: 'saved_places.create.idempotency_hit',
          authUserId,
          idempotencyKey: normalizedKey,
        },
        SavedPlacesController.name,
      );
      return existing.response;
    }

    try {
      const created = await this.savedPlacesService.create(authUserId, body);
      const response = ApiResponse.ok(created);
      await this.idempotencyStore.complete(idempotencyInput, response);
      this.metrics.increment('saved_place_create_total', {
        authUserId,
        placeId: created.id,
        idempotencyKey: normalizedKey,
      });
      this.logger.log(
        {
          event: 'saved_places.create.success',
          authUserId,
          placeId: created.id,
          idempotencyKey: normalizedKey,
        },
        SavedPlacesController.name,
      );
      return response;
    } catch (error) {
      await this.idempotencyStore.clearPending(idempotencyInput);
      this.metrics.increment('saved_place_create_failed_total', {
        authUserId,
        idempotencyKey: normalizedKey,
      });
      this.logger.warn(
        {
          event: 'saved_places.create.failed',
          authUserId,
          idempotencyKey: normalizedKey,
          reason: error instanceof Error ? error.message : 'unknown_error',
        },
        SavedPlacesController.name,
      );
      throw error;
    }
  }

  @Delete(':id')
  @HttpCode(200)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async remove(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    const authUserId = request.authUserId;
    if (!authUserId) {
      throw new UnauthorizedException('Missing authenticated user');
    }

    try {
      await this.savedPlacesService.delete(authUserId, id);
      this.metrics.increment('saved_place_delete_total', {
        authUserId,
        placeId: id,
      });
      this.logger.log(
        {
          event: 'saved_places.delete.success',
          authUserId,
          placeId: id,
        },
        SavedPlacesController.name,
      );
      return ApiResponse.ok({ id });
    } catch (error) {
      if (error instanceof ForbiddenException) {
        this.metrics.increment('saved_place_forbidden_total', {
          authUserId,
          placeId: id,
        });
      }
      this.logger.warn(
        {
          event: 'saved_places.delete.failed',
          authUserId,
          placeId: id,
          reason: error instanceof Error ? error.message : 'unknown_error',
        },
        SavedPlacesController.name,
      );
      throw error;
    }
  }

  private validateIdempotencyKey(key: string | undefined): string | null {
    if (!key?.trim()) {
      return null;
    }

    const normalized = key.trim();
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidPattern.test(normalized)) {
      throw new BadRequestException({
        code: 'IDEMPOTENCY_KEY_INVALID',
        message: 'Idempotency-Key must be a valid UUID',
      });
    }

    return normalized;
  }
}
