import {
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  Req,
  UseGuards,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/jwt.strategy';
import type { AuthenticatedUser } from '../auth/auth.service';
import { requireActive } from '../security/access';
@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly prisma: PrismaService) {}
  @Get() list(@Req() req: { user: AuthenticatedUser }) {
    requireActive(req.user);
    return this.prisma.notification.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }
  @Patch(':id/read') async read(
    @Req() req: { user: AuthenticatedUser },
    @Param('id') id: string,
  ) {
    requireActive(req.user);
    const result = await this.prisma.notification.updateMany({
      where: { id, userId: req.user.id },
      data: { isRead: true },
    });
    if (!result.count) throw new NotFoundException('Notification not found.');
    return { success: true };
  }
}
