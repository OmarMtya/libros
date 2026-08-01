import { ArrayMaxSize, IsArray, IsIn, IsInt, IsNumber, IsObject, IsOptional, IsString, Max, MaxLength, Min, MinLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class AuthorInputDto {
  @IsString() @MinLength(1) @MaxLength(200) name!: string;
  @IsIn(['author', 'editor', 'contributor']) role!: 'author' | 'editor' | 'contributor';
  @IsInt() @Min(0) position!: number;
}

export class CreateBookDto {
  @IsString() @MinLength(1) @MaxLength(300) canonicalTitle!: string;
  @IsString() @MinLength(2) @MaxLength(8) originalLanguage!: string;
  @IsOptional() @IsString() @MaxLength(30) openLibraryEditionId?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(20) @ValidateNested({ each: true }) @Type(() => AuthorInputDto)
  authors?: AuthorInputDto[];
}

export class EditionContributorInputDto {
  @IsString() @MinLength(1) @MaxLength(200) authorName!: string;
  @IsIn(['translator', 'editor', 'narrator', 'contributor']) role!: 'translator' | 'editor' | 'narrator' | 'contributor';
  @IsInt() @Min(0) position!: number;
}

export class CreateEditionDto {
  @IsString() @MinLength(1) @MaxLength(300) title!: string;
  @IsOptional() @IsString() @MaxLength(20) isbn?: string;
  @IsString() @MinLength(2) @MaxLength(8) languageCode!: string;
  @IsOptional() @IsInt() @Min(1) pages?: number;
  @IsOptional() @IsString() @MaxLength(200) publisher?: string;
  @IsOptional() @IsInt() @Min(1000) @Max(4000) publicationYear?: number;
  @IsOptional() @IsArray() @ArrayMaxSize(20) @ValidateNested({ each: true }) @Type(() => EditionContributorInputDto)
  contributors?: EditionContributorInputDto[];
}

export class ClassificationFeatureInputDto {
  @IsString() featureKey!: string;
  @IsNumber() @Min(0) @Max(1) value!: number;
  @IsNumber() @Min(0) @Max(0.95) confidence!: number;
  @IsOptional() @IsString() @MaxLength(100) source?: string;
  @IsOptional() @IsObject() evidence?: Record<string, unknown>;
}

export class ClassificationTagInputDto {
  @IsString() tagKey!: string;
  @IsNumber() @Min(0) @Max(1) strength!: number;
  @IsNumber() @Min(0) @Max(0.95) confidence!: number;
}

export class CreateClassificationDto {
  @IsString() contentTypeKey!: string;
  @IsString() contentTypeSchemaVersion!: string;
  @IsString() featureSchemaVersion!: string;
  @IsString() tagTaxonomyVersion!: string;
  @IsOptional() @IsString() @MaxLength(30) classifierVersion?: string;
  @IsArray() @ValidateNested({ each: true }) @Type(() => ClassificationFeatureInputDto) features!: ClassificationFeatureInputDto[];
  @IsArray() @ValidateNested({ each: true }) @Type(() => ClassificationTagInputDto) tags!: ClassificationTagInputDto[];
}

export class CreateClassificationDraftDto {
  @IsString() contentTypeKey!: string;
  @IsString() contentTypeSchemaVersion!: string;
  @IsString() featureSchemaVersion!: string;
  @IsString() tagTaxonomyVersion!: string;
}

export class ManualFeatureInputDto {
  @IsString() featureKey!: string;
  @IsOptional() @IsNumber() @Min(0) @Max(1) value?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(0.95) confidence?: number;
  @IsOptional() @IsString() @MaxLength(2000) notes?: string;
}

export class ManualTagInputDto {
  @IsString() tagKey!: string;
  @IsNumber() @Min(0) @Max(1) strength!: number;
  @IsNumber() @Min(0) @Max(0.95) confidence!: number;
}

export class SaveClassificationDto {
  @IsString() contentTypeKey!: string;
  @IsString() contentTypeSchemaVersion!: string;
  @IsString() featureSchemaVersion!: string;
  @IsString() tagTaxonomyVersion!: string;
  @IsArray() @ValidateNested({ each: true }) @Type(() => ManualFeatureInputDto) features!: ManualFeatureInputDto[];
  @IsArray() @ValidateNested({ each: true }) @Type(() => ManualTagInputDto) tags!: ManualTagInputDto[];
}
