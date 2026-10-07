// Creates the NestJS application and applies shared HTTP settings before accepting requests.
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  app.setGlobalPrefix('api');
  // Allow the configured frontend origin to read responses through browser CORS checks.
  app.enableCors({
    origin: config.get<string>('FRONTEND_URL') || 'http://localhost:5173',
  });
  // Transform request bodies into DTO instances and reject properties without validation decorators.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  await app.listen(config.get<string>('PORT') || 3000);
}
void bootstrap();
