import { IsDateString, IsNotEmpty, IsOptional } from 'class-validator';

export class TransactionDateDto {
  @IsDateString()
  @IsNotEmpty()
  fecha: string;
}