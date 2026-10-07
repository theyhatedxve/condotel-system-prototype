import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Header,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/auth.service';
import { JwtAuthGuard } from '../auth/jwt.strategy';
import { RegisterDeviceDto } from './devices.dto';
import { DevicesService } from './devices.service';

@Controller('devices')
@UseGuards(JwtAuthGuard)
export class DevicesController {
  constructor(private readonly devices: DevicesService) {}

  private requireAdmin(user: AuthenticatedUser) {
    if (user.role !== 'ADMIN' || user.mustChangePassword) {
      throw new ForbiddenException(
        'An administrator with an up-to-date password is required.',
      );
    }
  }

  @Get()
  @Header('Cache-Control', 'no-store')
  list(@Req() request: { user: AuthenticatedUser }) {
    this.requireAdmin(request.user);
    return this.devices.list();
  }

  @Post()
  @Header('Cache-Control', 'no-store')
  register(
    @Req() request: { user: AuthenticatedUser },
    @Body() dto: RegisterDeviceDto,
  ) {
    this.requireAdmin(request.user);
    return this.devices.register(dto.deviceName);
  }
}
