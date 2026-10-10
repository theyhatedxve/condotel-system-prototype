import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { RegisterDto } from '../auth/auth.dto';
import {
  normalizeEmail,
  normalizePhone,
} from '../security/contact-protection.service';

export class UpdateProfileDto {
  @ValidateIf((_, value) => value !== undefined)
  @IsEmail()
  @MaxLength(255)
  @Transform(({ value }) =>
    typeof value === 'string' ? normalizeEmail(value) : value,
  )
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  @Transform(({ value }) =>
    typeof value === 'string' ? normalizePhone(value) || null : value,
  )
  phone?: string | null;

  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  firstName?: string;

  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  lastName?: string;
}
export class CreateManagedUserDto extends RegisterDto {
  @IsOptional() @IsIn(['CUSTOMER', 'STAFF', 'ADMIN']) role?:
    'CUSTOMER' | 'STAFF' | 'ADMIN';
}
export class UpdateManagedUserDto extends UpdateProfileDto {
  @ValidateIf((_, value) => value !== undefined)
  @IsIn(['CUSTOMER', 'STAFF', 'ADMIN'])
  role?: 'CUSTOMER' | 'STAFF' | 'ADMIN';
  @ValidateIf((_, value) => value !== undefined)
  @IsIn(['ACTIVE', 'INACTIVE', 'SUSPENDED'])
  status?: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
}
export class ImportUsersDto {
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => CreateManagedUserDto)
  users: CreateManagedUserDto[];
}
