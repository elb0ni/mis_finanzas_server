import {
  IsNotEmpty,
  IsNumber,
  IsInt,
  IsString,
  IsOptional,
  IsBoolean,
  IsPositive,
  MaxLength,
  Min,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class createFixedCost {

  @IsNotEmpty({ message: 'El ID del negocio es requerido' })
  @IsInt({ message: 'El ID del negocio debe ser un número entero' })
  @IsPositive({ message: 'El ID del negocio debe ser un número positivo' })
  @Type(() => Number)
  negocio_id: number;

  @IsNotEmpty({ message: 'El ID de la categoría de egreso es requerido' })
  @IsInt({ message: 'El ID de la categoría de egreso debe ser un número entero' })
  @IsPositive({ message: 'El ID de la categoría de egreso debe ser un número positivo' })
  @Type(() => Number)
  categoria_egreso_id: number;

 
  @IsNotEmpty({ message: 'El monto mensual es requerido' })
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'El monto mensual debe ser un número válido con máximo 2 decimales' }
  )
  @IsPositive({ message: 'El monto mensual debe ser un número positivo' })
  @Min(0.01, { message: 'El monto mensual debe ser mayor a 0' })
  @Type(() => Number)
  monto_mensual: number;

  @IsOptional()
  @IsString({ message: 'La descripción debe ser una cadena de texto' })
  @MaxLength(200, { message: 'La descripción no puede exceder los 200 caracteres' })
  @Transform(({ value }) => value?.trim())
  descripcion?: string;

  @IsOptional()
  @IsBoolean({ message: 'El campo activo debe ser un valor booleano' })
  @Transform(({ value }) => {
    if (value === 'true' || value === true || value === 1) return true;
    if (value === 'false' || value === false || value === 0) return false;
    return value;
  })
  activo?: boolean = true;
}