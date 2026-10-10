import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { IsString, Matches } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt.strategy';
import type { AuthenticatedUser } from '../auth/auth.service';
import { PaymentsService } from './payments.service';
class ReconcileDto {
  @IsString() @Matches(/^cs_[a-zA-Z0-9]+$/) sessionId: string;
}
@Controller('payments')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}
  @Get() @UseGuards(JwtAuthGuard) list(
    @Req() req: { user: AuthenticatedUser },
  ) {
    return this.payments.list(req.user);
  }
  @Post('checkout/:reservationId') @UseGuards(JwtAuthGuard) checkout(
    @Req() req: { user: AuthenticatedUser },
    @Param('reservationId') id: string,
  ) {
    return this.payments.checkout(req.user, id);
  }
  @Post(':id/reconcile') @UseGuards(JwtAuthGuard) reconcile(
    @Req() req: { user: AuthenticatedUser },
    @Param('id') id: string,
    @Body() dto: ReconcileDto,
  ) {
    return this.payments.reconcile(req.user, id, dto.sessionId);
  }
  @Post('webhook/paymongo') webhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('paymongo-signature') signature?: string,
  ) {
    return this.payments.webhook(req.rawBody, signature);
  }
}
