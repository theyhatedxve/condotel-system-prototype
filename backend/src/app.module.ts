// Composes authentication, encryption and shared database infrastructure.
// Global configuration makes environment-backed settings available to injected services.
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { PrismaModule } from './prisma/prisma.module';
import { SecurityModule } from './security/security.module';
import { PrivacyReadinessService } from './security/privacy-readiness.service';
import { BusinessModule } from './business.module';
import { APP_FILTER } from '@nestjs/core';
import { DatabaseErrorFilter } from './security/database-error.filter';

@Module({
  providers: [
    PrivacyReadinessService,
    { provide: APP_FILTER, useClass: DatabaseErrorFilter },
  ],
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    SecurityModule,
    BusinessModule,
  ],
})
export class AppModule {}
