import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class CreateRoomDto {
  @IsString()
  @MinLength(1)
  @MaxLength(30)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  roomNumber: string;
  @IsString() @MinLength(1) @MaxLength(100) roomType: string;
  @IsOptional() @IsInt() @Min(-10) @Max(200) floor?: number;
  @IsInt() @Min(1) @Max(50) capacity: number;
  @IsInt() @Min(100) @Max(5000000) ratePerNightCentavos: number;
}
export class UpdateRoomDto {
  @ValidateIf((_, v) => v !== undefined) @IsBoolean() isActive?: boolean;
  @ValidateIf((_, v) => v !== undefined)
  @IsIn(['AVAILABLE', 'MAINTENANCE'])
  status?: string;
  @ValidateIf((_, v) => v !== undefined)
  @IsInt()
  @Min(100)
  @Max(5000000)
  ratePerNightCentavos?: number;
}
export class CreateReservationDto {
  @IsString() @MinLength(1) @MaxLength(100) roomId: string;
  @IsOptional() @IsString() @MaxLength(100) guestId?: string;
  @IsString() @Matches(/^\d{4}-\d{2}-\d{2}$/) checkIn: string;
  @IsString() @Matches(/^\d{4}-\d{2}-\d{2}$/) checkOut: string;
  @IsInt() @Min(1) @Max(50) adults: number;
  @IsOptional() @IsInt() @Min(0) @Max(50) children?: number;
  @IsOptional() @IsString() @MaxLength(5000) specialRequests?: string | null;
  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  estimatedArrival?: string;
}
export class UpdateReservationDto {
  @IsOptional() @IsString() @MaxLength(5000) specialRequests?: string | null;
  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  estimatedArrival?: string;
  @ValidateIf((_, v) => v !== undefined)
  @IsIn(['CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT', 'CANCELLED'])
  status?: string;
}
