import { ForbiddenException } from '@nestjs/common';

export interface Actor {
  id: string;
  role: string;
  status: string;
  mustChangePassword: boolean;
}
export function requireActive(actor: Actor) {
  if (actor.status !== 'ACTIVE' || actor.mustChangePassword)
    throw new ForbiddenException(
      'An active account with an updated password is required.',
    );
}
export function requireStaff(actor: Actor) {
  requireActive(actor);
  if (!['ADMIN', 'STAFF'].includes(actor.role))
    throw new ForbiddenException('Staff access required.');
}
export function requireAdmin(actor: Actor) {
  requireActive(actor);
  if (actor.role !== 'ADMIN')
    throw new ForbiddenException('Administrator access required.');
}
export function requireOwnerOrStaff(actor: Actor, ownerId: string) {
  requireActive(actor);
  if (actor.id !== ownerId) requireStaff(actor);
}
