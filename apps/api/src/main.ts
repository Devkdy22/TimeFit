import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/http/http-exception.filter';
import { SafeLogger } from './common/logger/safe-logger.service';
import { AppConfigService } from './common/config/app-config.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  const logger = app.get(SafeLogger, { strict: false });
  if (logger) {
    app.useLogger(logger);
  }

  app.use(helmet());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());

  const appConfigService = app.get(AppConfigService);
  const corsOrigins = appConfigService.corsOrigins;
  const allowAllCors = !appConfigService.isProduction;

  app.enableCors({
    origin: allowAllCors ? true : corsOrigins,
    credentials: true,
  });

  await app.listen(appConfigService.port);
}

bootstrap();
