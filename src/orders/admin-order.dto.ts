import { IsIn, IsOptional, IsUUID } from 'class-validator';
import { ProductPackageKey } from '@prisma/client';

const ACTIVE_PACKAGE_KEYS: ProductPackageKey[] = ['libro_sorpresa_fisico'];

export class CreateAdminOrderDto {
  @IsUUID()
  userId!: string;

  @IsOptional()
  @IsIn(ACTIVE_PACKAGE_KEYS)
  packageKey?: ProductPackageKey;
}
