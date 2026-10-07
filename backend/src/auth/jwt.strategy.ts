// Verifies bearer-token signatures and expiration, then resolves the current request user.
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthService } from './auth.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly auth: AuthService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
      algorithms: ['HS256'],
    });
  }

  // Passport calls this after token verification; a signed payload still needs a usable subject.
  // AuthService reloads the account so deleted or inactive users cannot rely on an old token.
  validate(payload: { sub?: unknown }) {
    if (typeof payload.sub !== 'string' || !payload.sub)
      throw new UnauthorizedException();
    return this.auth.findAuthenticatedUser(payload.sub);
  }
}
