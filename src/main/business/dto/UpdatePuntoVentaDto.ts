import { IsOptional, IsString, IsNumber, IsBoolean, IsInt, Length, IsNotEmpty } from 'class-validator';

export class UpdatePuntoVentaDto {
  @IsOptional()
  @IsInt()
  negocio_id?: number;

  @IsOptional()
  @IsString()
  @Length(1, 255)
  nombre?: string;

  @IsOptional()
  @IsString()
  @Length(1, 255)
  ubicacion?: string;
  

  @IsOptional()
  @IsString()
  @Length(1, 100)
  responsable?: string;

  @IsOptional()
  @IsString()
  @Length(1, 15)
  telefono?: string;

  @IsOptional()
  activo?: number;

  @IsOptional()
  @IsString()
  nota?: string;

  @IsOptional()
  @IsInt()
  departamento?: number;

  @IsOptional()
  @IsInt()
  municipio?: number;
}
export class UpdatePuntoVentaStatusDto {
  @IsBoolean()
  @IsNotEmpty()
  activo: boolean;
}
