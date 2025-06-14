import {
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
} from 'class-validator';

export class UpdateFixedCostDto {
  @IsOptional()
  @IsNumber()
  categoria_egreso_id?: number;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  monto_mensual?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  descripcion?: string;
}
