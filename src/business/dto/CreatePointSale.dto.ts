import { IsNotEmpty, IsString, IsNumber, IsOptional, Length, IsDecimal, IsBoolean } from 'class-validator';

export class CreatePointSaleDto {
  @IsNotEmpty({ message: 'El ID del negocio es requerido' })
  @IsNumber({}, { message: 'El ID del negocio debe ser un número' })
  negocio_id: number;

  @IsNotEmpty({ message: 'El nombre del punto de venta es requerido' })
  @IsString({ message: 'El nombre debe ser texto' })
  @Length(3, 100, { message: 'El nombre debe tener entre 3 y 100 caracteres' })
  nombre: string;

  @IsOptional()
  @IsString({ message: 'La ubicación debe ser texto' })
  @Length(5, 200, { message: 'La ubicación debe tener entre 5 y 200 caracteres' })
  ubicacion?: string;

  @IsOptional()
  @IsDecimal({}, { message: 'La latitud debe ser un valor decimal' })
  latitud?: number;

  @IsOptional()
  @IsDecimal({}, { message: 'La longitud debe ser un valor decimal' })
  longitud?: number;

  @IsOptional()
  @IsString({ message: 'El responsable debe ser texto' })
  @Length(3, 100, { message: 'El responsable debe tener entre 3 y 100 caracteres' })
  responsable?: string;

  @IsOptional()
  @IsString({ message: 'El teléfono debe ser texto' })
  @Length(7, 20, { message: 'El teléfono debe tener entre 7 y 20 caracteres' })
  telefono?: string;

  @IsOptional()
  @IsBoolean({ message: 'El estado activo debe ser un valor booleano' })
  activo?: boolean;
}