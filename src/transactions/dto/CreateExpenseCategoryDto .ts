
// src/transactions/dto/create-expense-category.dto.ts
import { IsBoolean, IsEnum, IsInt, IsNotEmpty, IsOptional, IsPositive, IsString, Length, MaxLength } from 'class-validator';

export class CreateExpenseCategoryDto {
  @IsNotEmpty({ message: 'El ID del negocio es requerido' })
  @IsInt({ message: 'El ID del negocio debe ser un número entero' })
  @IsPositive({ message: 'El ID del negocio debe ser un número positivo' })
  negocio_id: number;

  @IsNotEmpty({ message: 'El nombre de la categoría es requerido' })
  @IsString({ message: 'El nombre debe ser una cadena de texto' })
  @Length(2, 100, { message: 'El nombre debe tener entre 2 y 100 caracteres' })
  nombre: string;

  @IsOptional()
  @IsString({ message: 'La descripción debe ser una cadena de texto' })
  @MaxLength(200, { message: 'La descripción no puede exceder los 200 caracteres' })
  descripcion?: string;

  @IsOptional()
  @IsEnum(['fijo', 'variable'], { message: 'El tipo de costo debe ser "fijo" o "variable"' })
  tipo_costo: 'fijo' | 'variable' = 'variable';

  @IsOptional()
  @IsBoolean({ message: 'El campo activo debe ser un valor booleano' })
  activo?: boolean = true;
}