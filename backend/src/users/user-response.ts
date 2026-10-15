import type { Prisma } from '../generated/prisma/client';

// Internal database projection: encrypted contacts are needed for authorized reads.
// Account endpoints use userResponse below; reservation endpoints use their own allowlist.
export const contactUserSelect = {
  id: true,
  emailCiphertext: true,
  emailIv: true,
  emailAuthTag: true,
  emailBlindIndex: true,
  username: true,
  firstName: true,
  lastName: true,
  phoneCiphertext: true,
  phoneIv: true,
  phoneAuthTag: true,
  phoneBlindIndex: true,
  role: true,
  status: true,
  mustChangePassword: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

export type ContactUser = Prisma.UserGetPayload<{
  select: typeof contactUserSelect;
}>;
export type AuthenticatedUser = Omit<
  ContactUser,
  | 'emailCiphertext'
  | 'emailIv'
  | 'emailAuthTag'
  | 'emailBlindIndex'
  | 'phoneCiphertext'
  | 'phoneIv'
  | 'phoneAuthTag'
  | 'phoneBlindIndex'
> & {
  email: string;
  phone: string | null;
};

// An explicit allowlist prevents ciphertext, indexes, legacy columns and hashes escaping.
export function userResponse(
  user: ContactUser,
  contact: { email: string; phone: string | null },
): AuthenticatedUser {
  return {
    id: user.id,
    username: user.username,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
    status: user.status,
    mustChangePassword: user.mustChangePassword,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    ...contact,
  };
}
