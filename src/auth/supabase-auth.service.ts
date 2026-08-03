import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser, SupabaseJwtClaims } from './auth.types';

@Injectable()
export class SupabaseAuthService {
  private readonly issuer = process.env.SUPABASE_JWT_ISSUER;
  private readonly audience = process.env.SUPABASE_JWT_AUDIENCE ?? 'authenticated';
  private readonly jwks = this.issuer
    ? createRemoteJWKSet(new URL(process.env.SUPABASE_JWKS_URL ?? `${this.issuer}/.well-known/jwks.json`))
    : null;

  constructor(private readonly prisma: PrismaService) {}

  async authenticate(token: string): Promise<AuthenticatedUser> {
    if (!this.issuer || !this.jwks) throw new UnauthorizedException('La autenticación no está configurada.');
    try {
      const { payload } = await jwtVerify(token, this.jwks, { issuer: this.issuer, audience: this.audience });
      const claims = payload as SupabaseJwtClaims;
      if (!claims.sub) throw new UnauthorizedException('La sesión no contiene una identidad válida.');
      return this.synchronizeUser(claims);
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      throw new UnauthorizedException('Tu sesión no es válida o ya venció. Inicia sesión nuevamente.');
    }
  }

  async tryAuthenticate(token: string | undefined): Promise<AuthenticatedUser | null> {
    if (!token || !this.issuer || !this.jwks) return null;
    try {
      const { payload } = await jwtVerify(token, this.jwks, { issuer: this.issuer, audience: this.audience });
      const claims = payload as SupabaseJwtClaims;
      if (!claims.sub) return null;
      return this.synchronizeUser(claims);
    } catch {
      return null;
    }
  }

  private async synchronizeUser(claims: SupabaseJwtClaims): Promise<AuthenticatedUser> {
    const email = claims.email?.trim().toLowerCase() || null;
    const displayName = claims.user_metadata?.full_name?.trim() || claims.user_metadata?.name?.trim() || null;
    const adminEmails = new Set((process.env.ADMIN_EMAILS ?? '').split(',').map((value) => value.trim().toLowerCase()).filter(Boolean));
    const role = email && adminEmails.has(email) ? UserRole.admin : UserRole.customer;
    const data = { email, displayName, role, lastSignedInAt: new Date() };
    const bySub = await this.prisma.user.findUnique({ where: { id: claims.sub } });
    if (bySub) {
      const user = await this.prisma.user.update({ where: { id: bySub.id }, data });
      return { id: user.id, email: user.email, displayName: user.displayName, role: user.role };
    }
    const byEmail = email ? await this.prisma.user.findUnique({ where: { email } }) : null;
    if (byEmail) {
      const user = await this.prisma.user.update({ where: { id: byEmail.id }, data: { id: claims.sub, ...data } });
      return { id: user.id, email: user.email, displayName: user.displayName, role: user.role };
    }
    const user = await this.prisma.user.create({ data: { id: claims.sub, ...data } });
    return { id: user.id, email: user.email, displayName: user.displayName, role: user.role };
  }
}
