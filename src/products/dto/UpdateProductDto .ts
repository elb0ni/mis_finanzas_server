import {
    IsString,
    IsNumber,
    IsBoolean,
    IsOptional,
  } from 'class-validator';
  
  export default class UpdateProductDto {
    @IsOptional()
    @IsNumber({}, { message: 'El ID del negocio debe ser un número' })
    negocio_id?: number;
  
    @IsOptional()
    @IsString({ message: 'El nombre debe ser una cadena de texto' })
    nombre?: string;
  
    @IsOptional()
    @IsString({ message: 'La descripción debe ser una cadena de texto' })
    descripcion?: string;
  
    @IsOptional()
    @IsString({ message: 'El código interno debe ser una cadena de texto' })
    codigo_interno?: string;
  
    @IsOptional()
    @IsBoolean({ message: 'El estado activo debe ser un valor booleano' })
    activo?: boolean;
  
    @IsOptional()
    @IsNumber({}, { message: 'El precio unitario debe ser un número' })
    precio_unitario?: number;
  
    @IsOptional()
    @IsNumber({}, { message: 'El costo unitario debe ser un número' })
    costo_unitario?: number;
  
    @IsOptional()
    @IsString({ message: 'La unidad de medida debe ser una cadena de texto' })
    unidad_medida?: string;
  }