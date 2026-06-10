import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiResponse } from '../../common/http/api-response';
import { AuthAccessGuard, type AuthenticatedRequest } from '../auth/auth-access.guard';
import { CreateRoutineDto } from './dto/create-routine.dto';
import { RoutineIdempotencyStore } from './services/routine-idempotency.store';
import { RoutinesService } from './services/routines.service';

@Controller('routines')
export class RoutinesController {
  constructor(
    private readonly routinesService: RoutinesService,
    private readonly idempotencyStore: RoutineIdempotencyStore,
  ) {}

  @Post()
  @UseGuards(AuthAccessGuard)
  create(
    @Req() request: AuthenticatedRequest,
    @Body() body: CreateRoutineDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    const authUserId = request.authUserId;
    if (!authUserId) {
      throw new UnauthorizedException('Missing authenticated user');
    }
    const normalizedKey = this.validateIdempotencyKey(idempotencyKey);
    const scopeKey = `${authUserId}:POST:/routines:${normalizedKey}`;
    const payload = body;

    const existing = this.idempotencyStore.begin(scopeKey, payload);
    if (existing.replayed && existing.response) {
      return existing.response;
    }

    try {
      const created = this.routinesService.createRoutine(authUserId, body);
      const response = ApiResponse.ok(created);
      this.idempotencyStore.complete(scopeKey, payload, response);
      return response;
    } catch (error) {
      this.idempotencyStore.clearPending(scopeKey);
      throw error;
    }
  }

  @Get()
  @UseGuards(AuthAccessGuard)
  list(@Req() request: AuthenticatedRequest) {
    const userId = request.authUserId;
    if (!userId) {
      throw new UnauthorizedException('Missing authenticated user');
    }
    return ApiResponse.ok(this.routinesService.listRoutines(userId));
  }

  @Post(':id/run')
  @UseGuards(AuthAccessGuard)
  runNow(@Req() request: AuthenticatedRequest, @Param('id') routineId: string) {
    const userId = request.authUserId;
    if (!userId) {
      throw new UnauthorizedException('Missing authenticated user');
    }
    return ApiResponse.ok(this.routinesService.runRoutineNow(userId, routineId));
  }

  private validateIdempotencyKey(key: string | undefined): string {
    if (!key?.trim()) {
      throw new BadRequestException({
        code: 'IDEMPOTENCY_KEY_REQUIRED',
        message: 'Idempotency-Key header is required',
      });
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
