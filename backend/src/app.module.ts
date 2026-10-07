// Composes authentication, encryption and shared database infrastructure.
// Global configuration makes environment-backed settings available to injected services.
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DevicesModule } from './devices/devices.module';
import { AuthModule } from './auth/auth.module';
import { PrismaModule } from './prisma/prisma.module';
import { SecurityModule } from './security/security.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    SecurityModule,
    DevicesModule,
  ],
})
export class AppModule {}
