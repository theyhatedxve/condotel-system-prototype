import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { SecurityModule } from './security/security.module';
import { UsersService } from './users/users.service';
import {
  GuestsController,
  ProfileController,
  UsersController,
} from './users/users.controller';
import { ReservationsService } from './reservations/reservations.service';
import {
  DashboardController,
  ReservationsController,
  RoomsController,
} from './reservations/reservations.controller';
import { NotificationsController } from './notifications/notifications.controller';
import { PaymentsController } from './payments/payments.controller';
import { PaymentsService } from './payments/payments.service';
import { PaymongoService } from './payments/paymongo.service';
@Module({
  imports: [AuthModule, SecurityModule],
  providers: [
    UsersService,
    ReservationsService,
    PaymentsService,
    PaymongoService,
  ],
  controllers: [
    UsersController,
    GuestsController,
    ProfileController,
    ReservationsController,
    RoomsController,
    DashboardController,
    NotificationsController,
    PaymentsController,
  ],
})
export class BusinessModule {}
