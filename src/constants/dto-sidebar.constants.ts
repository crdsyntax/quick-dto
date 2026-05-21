import { PropertyTemplate } from "../types/dto-sidebar.types";

export const CLASS_VALIDATOR_DECORATORS = [
  "IsDefined()",
  "IsOptional()",
  "IsString()",
  "IsNumber()",
  "IsInt()",
  "IsBoolean()",
  "IsDate()",
  "IsArray()",
  "ValidateNested()",
  "IsEnum()",
  "Length(1, 255)",
  "MinLength(1)",
  "MaxLength(255)",
  "Min(0)",
  "Max(100)",
  "Matches(/regex/)",
  "IsEmail()",
  "IsUUID()",
  "IsPhoneNumber(null)",
  "IsUrl()",
  "IsNotEmpty()",
  "IsPositive()",
  "IsNegative()",
  "IsEmpty()",
  "IsIn([])",
  "IsNotIn([])"
];

export const SWAGGER_DECORATORS = [
  "ApiProperty({ description: \"Description\", example: \"example\" })",
  "ApiPropertyOptional({ description: \"Description\", example: \"example\" })",
  "ApiHideProperty()"
];

export const CLASS_TRANSFORMER_DECORATORS = [
  "Expose()",
  "Exclude()",
  "Type(() => Type)",
  "Transform((value) => value)"
];

export const PROPERTY_TEMPLATES: PropertyTemplate[] = [
  {
    name: 'string optional',
    snippet: `@IsOptional()\n@IsString()\n@ApiPropertyOptional({ description: \"Example string\", example: \"text\" })\nmyProp?: string;\n`
  },
  {
    name: 'string required',
    snippet: `@IsString()\n@ApiProperty({ description: \"Example string\", example: \"text\" })\nmyProp: string;\n`
  },
  {
    name: 'number optional',
    snippet: `@IsOptional()\n@IsNumber()\n@ApiPropertyOptional({ description: \"Example number\", example: 1 })\nmyProp?: number;\n`
  },
  {
    name: 'boolean optional',
    snippet: `@IsOptional()\n@IsBoolean()\n@ApiPropertyOptional({ description: \"Example boolean\", example: true })\nmyProp?: boolean;\n`
  },
  {
    name: 'date optional',
    snippet: `@IsOptional()\n@IsDate()\n@ApiPropertyOptional({ description: \"Example date\", example: \"2020-01-01\" })\nmyProp?: Date;\n`
  },
  {
    name: 'array of strings',
    snippet: `@IsOptional()\n@IsArray()\n@IsString({ each: true })\n@ApiPropertyOptional({ isArray: true, example: [\"a\", \"b\"] })\nmyProp?: string[];\n`
  },
  {
    name: 'nested object',
    snippet: `@ValidateNested()\n@Type(() => NestedDto)\n@ApiProperty({ type: () => NestedDto })\nmyProp: NestedDto;\n`
  }
];
