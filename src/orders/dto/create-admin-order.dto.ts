import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { ProductPackageKey } from '@prisma/client';

export class CreateAdminOrderDto {
  @IsUUID()
  userId!: string;

  @IsOptional()
  @IsEnum(ProductPackageKey)
  packageKey: ProductPackageKey = ProductPackageKey.libro_sorpresa_fisico;
}
