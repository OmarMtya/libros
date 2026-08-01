import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class AssignDto {
  @IsUUID() bookEditionId!: string;
  @IsUUID() classificationVersionId!: string;
  @IsOptional() @IsUUID() candidateId?: string;
  @IsOptional() @IsString() @MaxLength(500) notes?: string;
  @IsOptional() @IsString() @MaxLength(500) reason?: string;
}

export class ReplaceDto {
  @IsUUID() bookEditionId!: string;
  @IsUUID() classificationVersionId!: string;
  @IsOptional() @IsUUID() candidateId?: string;
  @IsOptional() @IsString() @MaxLength(500) notes?: string;
  @IsOptional() @IsString() @MaxLength(500) reason?: string;
}

export class ReopenLearningDto {
  @IsOptional() @IsString() @MaxLength(500) reason?: string;
}
