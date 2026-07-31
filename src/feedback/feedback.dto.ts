import { ArrayMaxSize, IsArray, IsBoolean, IsIn, IsInt, IsObject, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';

export class SubmitFeedbackDto {
  @IsOptional()
  @IsUUID()
  bookId?: string;

  @IsOptional()
  @IsUUID()
  recommendationId?: string;

  @IsBoolean()
  started!: boolean;

  @IsOptional()
  @IsIn(['no_time', 'wrong_mood', 'read_something_else', 'format_or_size', 'did_not_attract_me', 'other'])
  notStartedReason?: string;

  @IsIn(['completed', 'in_progress', 'paused', 'abandoned', 'not_started'])
  readingStatus!: 'completed' | 'in_progress' | 'paused' | 'abandoned' | 'not_started';

  @IsInt()
  @Min(0)
  @Max(100)
  completionPercentage!: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  selectionFitRating?: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(3)
  @IsString({ each: true })
  positiveAspects?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(3)
  @IsString({ each: true })
  negativeAspects?: string[];

  @IsOptional()
  @IsIn(['mostly_book', 'mixed', 'mostly_timing', 'external_circumstance', 'no_problem'])
  outcomeAttribution?: string;

  @IsOptional()
  @IsObject()
  nextDirection?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  freeText?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  idempotencyKey?: string;
}
