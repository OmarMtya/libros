import { UserRole } from '@prisma/client';

export type AuthenticatedUser = {
  id: string;
  email: string | null;
  displayName: string | null;
  role: UserRole;
};

export type SupabaseJwtClaims = {
  sub: string;
  aud: string | string[];
  email?: string;
  user_metadata?: { full_name?: string; name?: string };
};
