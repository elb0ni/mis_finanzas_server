import { IsNotEmpty, IsString, IsEmail, IsOptional, Length } from 'class-validator';

export default class CreateBusinessDto {
  @IsNotEmpty({ message: 'El nombre del negocio es requerido' })
  @IsString({ message: 'El nombre debe ser texto' })
  @Length(3, 100, { message: 'El nombre debe tener entre 3 y 100 caracteres' })
  nombre: string;

  @IsNotEmpty({ message: 'El NIT es requerido' })
  @IsString({ message: 'El NIT debe ser texto' })
  @Length(8, 20, { message: 'El NIT debe tener entre 8 y 20 caracteres' })
  nit: string;

  @IsOptional()
  @IsString({ message: 'La dirección debe ser texto' })
  @Length(5, 200, { message: 'La dirección debe tener entre 5 y 200 caracteres' })
  direccion?: string;

  @IsOptional()
  @IsString({ message: 'El teléfono debe ser texto' })
  @Length(7, 20, { message: 'El teléfono debe tener entre 7 y 20 caracteres' })
  telefono?: string;

  @IsOptional()
  @IsEmail({}, { message: 'Debe proporcionar un email válido' })
  @Length(5, 100, { message: 'El email debe tener entre 5 y 100 caracteres' })
  email?: string;
}