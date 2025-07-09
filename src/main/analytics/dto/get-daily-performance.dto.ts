import { Transform } from "class-transformer";
import { IsNotEmpty, IsNumberString, IsString, Matches } from "class-validator";

export class GetDailyPerformanceParamsDto {
  @IsNumberString({}, { message: 'businessId debe ser un número válido' })
  @IsNotEmpty({ message: 'businessId es requerido' })
  businessId: string;
}

export class GetDailyPerformanceQueryDto {
   @IsString()
  @IsNotEmpty()
  fecha: string;

}