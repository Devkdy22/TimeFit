import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiResponse } from '../../common/http/api-response';
import { AuthAccessGuard, type AuthenticatedRequest } from '../auth/auth-access.guard';
import { CreateRoutineDto, UpdateRoutineDto } from './dto/create-routine.dto';
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
  async create(
    @Req() request: AuthenticatedRequest,
    @Body() body: CreateRoutineDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    const authUserId = request.authUserId;
    if (!authUserId) {
      throw new UnauthorizedException('Missing authenticated user');
    }

    const normalizedKey = this.validateIdempotencyKey(idempotencyKey);
    if (!normalizedKey) {
      return ApiResponse.ok(await this.routinesService.createRoutine(authUserId, body));
    }

    const idempotencyInput = {
      userId: authUserId,
      scope: 'routine:create',
      key: normalizedKey,
      payload: body,
    };

    const existing = await this.idempotencyStore.begin(idempotencyInput);
    if (existing.replayed && existing.response) {
      return existing.response;
    }

    try {
      const created = await this.routinesService.createRoutine(authUserId, body);
      const response = ApiResponse.ok(created);
      await this.idempotencyStore.complete(idempotencyInput, response);
      return response;
    } catch (error) {
      await this.idempotencyStore.clearPending(idempotencyInput);
      throw error;
    }
  }

  @Get()
  @UseGuards(AuthAccessGuard)
  async list(@Req() request: AuthenticatedRequest) {
    const userId = request.authUserId;
    if (!userId) {
      throw new UnauthorizedException('Missing authenticated user');
    }
    return ApiResponse.ok(await this.routinesService.listRoutines(userId));
  }

  @Patch(':id')
  @UseGuards(AuthAccessGuard)
  async update(
    @Req() request: AuthenticatedRequest,
    @Param('id') routineId: string,
    @Body() body: UpdateRoutineDto,
  ) {
    const userId = request.authUserId;
    if (!userId) {
      throw new UnauthorizedException('Missing authenticated user');
    }
    return ApiResponse.ok(await this.routinesService.updateRoutine(userId, routineId, body));
  }

  @Delete(':id')
  @UseGuards(AuthAccessGuard)
  async delete(@Req() request: AuthenticatedRequest, @Param('id') routineId: string) {
    const userId = request.authUserId;
    if (!userId) {
      throw new UnauthorizedException('Missing authenticated user');
    }
    await this.routinesService.deleteRoutine(userId, routineId);
    return ApiResponse.ok({ deleted: true });
  }

  @Post(':id/run')
  @UseGuards(AuthAccessGuard)
  async runNow(@Req() request: AuthenticatedRequest, @Param('id') routineId: string) {
    const userId = request.authUserId;
    if (!userId) {
      throw new UnauthorizedException('Missing authenticated user');
    }
    return ApiResponse.ok(await this.routinesService.runRoutineNow(userId, routineId));
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
