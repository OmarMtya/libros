import { IsDefined, IsOptional, IsString, MaxLength } from 'class-validator';

export class SubmitAnswerDto {
  @IsDefined()
  response!: unknown;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  stimulusHash?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  idempotencyKey?: string;
}
