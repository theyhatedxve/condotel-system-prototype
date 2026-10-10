import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.strategy';
import type { AuthenticatedUser } from '../auth/auth.service';
import { UsersService } from './users.service';
import {
  CreateManagedUserDto,
  ImportUsersDto,
  UpdateManagedUserDto,
  UpdateProfileDto,
} from './users.dto';
type Request = { user: AuthenticatedUser };

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly users: UsersService) {}
  @Get() @Header('Cache-Control', 'no-store') list(
    @Req() req: Request,
    @Query('search') q?: string,
    @Query('page') page?: string,
  ) {
    return this.users.list(req.user, q, Number(page ?? 1));
  }
  @Post() create(@Req() req: Request, @Body() dto: CreateManagedUserDto) {
    return this.users.create(req.user, dto);
  }
  @Post('import') import(@Req() req: Request, @Body() dto: ImportUsersDto) {
    return this.users.import(req.user, dto.users);
  }
  @Patch(':id') update(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: UpdateManagedUserDto,
  ) {
    return this.users.update(req.user, id, dto);
  }
}
@Controller('guests')
@UseGuards(JwtAuthGuard)
export class GuestsController {
  constructor(private readonly users: UsersService) {}
  @Get() @Header('Cache-Control', 'no-store') list(
    @Req() req: Request,
    @Query('search') q?: string,
    @Query('page') page?: string,
  ) {
    return this.users.list(req.user, q, Number(page ?? 1), true);
  }
  @Post() create(@Req() req: Request, @Body() dto: CreateManagedUserDto) {
    return this.users.create(req.user, dto, true);
  }
  @Patch(':id') update(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: UpdateManagedUserDto,
  ) {
    return this.users.update(req.user, id, dto, true);
  }
}
@Controller('auth/me')
@UseGuards(JwtAuthGuard)
export class ProfileController {
  constructor(private readonly users: UsersService) {}
  @Patch() async update(@Req() req: Request, @Body() dto: UpdateProfileDto) {
    return { user: await this.users.updateOwn(req.user, dto) };
  }
}
