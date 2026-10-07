// Defines the request validation and normalization used by the global ValidationPipe.
// Identity fields are normalized, while passwords retain their exact submitted characters.
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @IsEmail()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  email: string;

  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(30)
  @Matches(/^[a-z0-9._-]+$/, {
    message:
      'Username may only contain letters, numbers, dots, underscores, and hyphens.',
  })
  @Transform(({ value }) => {
    if (typeof value !== 'string') {
      return value;
    }

    const username = value.trim().toLowerCase();

    return username === '' ? undefined : username;
  })
  username?: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  firstName: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  lastName: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  @Transform(({ value }) => {
    if (typeof value !== 'string') {
      return value;
    }

    const phone = value.trim();

    return phone === '' ? undefined : phone;
  })
  phone?: string;
}
export class LoginDto {
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  identifier: string;

  @IsString()
  @MinLength(1)
  @MaxLength(128)
  password: string;
}
export class ChangePasswordDto {
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  currentPassword: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  newPassword: string;
}
