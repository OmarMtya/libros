import { Type } from 'class-transformer';
import { IsEnum, IsNotEmpty, IsOptional, IsString, Matches, MaxLength, ValidateNested } from 'class-validator';
import { ProductPackageKey } from '@prisma/client';

export class ShippingAddressDto {
  @IsString() @IsNotEmpty() @MaxLength(160) recipientName!: string;
  @IsString() @Matches(/^[0-9+()\-\s]{8,30}$/) phone!: string;
  @IsString() @IsNotEmpty() @MaxLength(160) street!: string;
  @IsString() @IsNotEmpty() @MaxLength(30) exteriorNumber!: string;
  @IsOptional() @IsString() @MaxLength(30) interiorNumber?: string;
  @IsString() @IsNotEmpty() @MaxLength(120) neighborhood!: string;
  @IsString() @IsNotEmpty() @MaxLength(120) city!: string;
  @IsString() @IsNotEmpty() @MaxLength(120) state!: string;
  @IsString() @Matches(/^\d{5}$/) postalCode!: string;
  @IsOptional() @IsString() @MaxLength(500) references?: string;
}

export class CreateCheckoutDto {
  @IsEnum(ProductPackageKey)
  packageKey!: ProductPackageKey;

  @ValidateNested()
  @Type(() => ShippingAddressDto)
  shippingAddress!: ShippingAddressDto;
}
