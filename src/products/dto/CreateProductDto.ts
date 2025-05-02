import {
    IsNotEmpty,
    IsString,
    IsNumber,
    IsBoolean,
    IsOptional
} from "class-validator";

export default class CreateProductDto {
    @IsNotEmpty({ message: 'El ID del negocio es obligatorio' })
    @IsNumber({}, { message: 'El ID del negocio debe ser un número' })
    negocio_id: number;
    
    @IsNotEmpty({ message: 'El nombre es obligatorio' })
    @IsString({ message: 'El nombre debe ser una cadena de texto' })
    nombre: string;
    
    @IsOptional()
    @IsString({ message: 'La descripción debe ser una cadena de texto' })
    descripcion?: string;
    
    @IsOptional()
    @IsString({ message: 'El código interno debe ser una cadena de texto' })
    codigo_interno?: string;
    
    @IsNotEmpty({ message: 'El estado activo es obligatorio' })
    @IsBoolean({ message: 'El estado activo debe ser un valor booleano' })
    activo: boolean;
    
    @IsNotEmpty({ message: 'El precio unitario es obligatorio' })
    @IsNumber({}, { message: 'El precio unitario debe ser un número' })
    precio_unitario: number;
    
    @IsNotEmpty({ message: 'El costo unitario es obligatorio' })
    @IsNumber({}, { message: 'El costo unitario debe ser un número' })
    costo_unitario: number;
    
    @IsOptional()
    @IsString({ message: 'La unidad de medida debe ser una cadena de texto' })
    unidad_medida?: string;
}