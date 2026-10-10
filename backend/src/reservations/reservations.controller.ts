import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.strategy';
import type { AuthenticatedUser } from '../auth/auth.service';
import { ReservationsService } from './reservations.service';
import {
  CreateReservationDto,
  CreateRoomDto,
  UpdateReservationDto,
  UpdateRoomDto,
} from './reservations.dto';
type Request = { user: AuthenticatedUser };
@Controller('reservations')
@UseGuards(JwtAuthGuard)
export class ReservationsController {
  constructor(private readonly reservations: ReservationsService) {}
  @Get() list(
    @Req() req: Request,
    @Query('status') status?: string,
    @Query('page') page?: string,
  ) {
    return this.reservations.list(req.user, status, Number(page ?? 1));
  }
  @Get(':id') get(@Req() req: Request, @Param('id') id: string) {
    return this.reservations.get(req.user, id);
  }
  @Post() create(@Req() req: Request, @Body() dto: CreateReservationDto) {
    return this.reservations.create(req.user, dto);
  }
  @Patch(':id') update(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: UpdateReservationDto,
  ) {
    return this.reservations.update(req.user, id, dto);
  }
}
@Controller('rooms')
@UseGuards(JwtAuthGuard)
export class RoomsController {
  constructor(private readonly reservations: ReservationsService) {}
  @Get() list(@Req() req: Request) {
    return this.reservations.rooms(req.user);
  }
  @Post() create(@Req() req: Request, @Body() dto: CreateRoomDto) {
    return this.reservations.createRoom(req.user, dto);
  }
  @Patch(':id') update(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: UpdateRoomDto,
  ) {
    return this.reservations.updateRoom(req.user, id, dto);
  }
}
@Controller('dashboard')
@UseGuards(JwtAuthGuard)
export class DashboardController {
  constructor(private readonly reservations: ReservationsService) {}
  @Get() get(@Req() req: Request) {
    return this.reservations.dashboard(req.user);
  }
}
