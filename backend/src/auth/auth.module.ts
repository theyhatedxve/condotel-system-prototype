// Wires credential handling and Passport JWT verification, exporting the guard for other modules.
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { JwtStrategy } from './jwt.strategy';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      inject: [ConfigService],
      // Resolve signing configuration through dependency injection and fail startup if it is invalid.
      useFactory: (config: ConfigService) => {
        const secret = config.get<string>('JWT_SECRET');
        const expiresIn = Number(
          config.get<string>('JWT_EXPIRES_IN_SECONDS') ?? '3600',
        );
        if (!secret)
          throw new Error('JWT_SECRET is missing from the .env file.');
        if (!Number.isSafeInteger(expiresIn) || expiresIn <= 0) {
          throw new Error('JWT_EXPIRES_IN_SECONDS must be a positive integer.');
        }
        return {
          secret,
          signOptions: { expiresIn, algorithm: 'HS256' as const },
        };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, JwtAuthGuard],
  exports: [JwtAuthGuard],
})
export class AuthModule {}
