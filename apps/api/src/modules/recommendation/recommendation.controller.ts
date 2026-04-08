import { Body, Controller, Post } from '@nestjs/common';
import { ApiResponse } from '../../common/http/api-response';
import { RecommendationRequestDto } from './dto/recommendation-request.dto';
import { RecommendationService } from './services/recommendation.service';

@Controller('recommendations')
export class RecommendationController {
  constructor(private readonly recommendationService: RecommendationService) {}

  @Post('calculate')
  async calculate(@Body() body: RecommendationRequestDto) {
    const recommendation = await this.recommendationService.recommend(body);
    return ApiResponse.ok(recommendation);
  }
}
