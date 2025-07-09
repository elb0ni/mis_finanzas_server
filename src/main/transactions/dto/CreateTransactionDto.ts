// create-transaction.dto.ts
import { IsEnum, IsNotEmpty, IsNumber, IsUUID, IsOptional, IsDateString, ValidateNested, IsArray, Min, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export enum TransactionType {
    INGRESO = 'ingreso',
    EGRESO = 'egreso',
}

export class TransactionDetailDto {
    @IsNotEmpty()
    @IsNumber()
    @Type(() => Number)
    producto_id: number;

    @IsNotEmpty()
    @IsNumber({ maxDecimalPlaces: 3 })
    @Min(0)
    @Type(() => Number)
    cantidad: number;
}

export class CreateTransactionDto {
    @IsNotEmpty()
    @IsNumber()
    @Type(() => Number)
    punto_venta_id: number;

    @IsNotEmpty()
    @IsEnum(TransactionType)
    tipo: TransactionType;

    @IsNotEmpty()
    @IsDateString()
    fecha: string;

    @IsOptional()
    @IsNumber()
    @Type(() => Number)
    categoria_id?: number;

    @IsOptional()
    @IsNumber({ maxDecimalPlaces: 2 })
    @Min(0)
    @Type(() => Number)
    monto_total?: number;

    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => TransactionDetailDto)
    detalles?: TransactionDetailDto[];

    @IsOptional()
    @IsString()
    concepto?: string
}