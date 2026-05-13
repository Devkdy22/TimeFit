import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiResponse } from '../../common/http/api-response';
import { RecommendationRequestDto } from './dto/recommendation-request.dto';
import { RecommendationService } from './services/recommendation.service';
import { OdsayTransitClient } from './services/transit/OdsayTransitClient';

@Controller('recommendations')
export class RecommendationController {
  constructor(
    private readonly recommendationService: RecommendationService,
    private readonly odsayTransitClient: OdsayTransitClient,
  ) {}

  @Post('calculate')
  async calculate(@Body() body: RecommendationRequestDto) {
    const recommendation = await this.recommendationService.recommend(body);
    return ApiResponse.ok(recommendation);
  }

  @Get('odsay/usage')
  async getOdsayUsage(@Query('date') date?: string) {
    const usage = await this.odsayTransitClient.getDailyUsageSnapshot(date);
    return ApiResponse.ok(usage);
  }
}
