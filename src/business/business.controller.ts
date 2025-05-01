import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { BusinessService } from './business.service';
import { JwtauthGuard } from 'src/auth/guards/JwtGuard.guard';
import { JwtPayload } from 'src/auth/models/token.model';
import { CreateBusinessDto } from './dto/CreateBusiness';
import { CreatePointSaleDto } from './dto/CreatePointSale.dto';

@UseGuards(JwtauthGuard)
@Controller('business')
export class BusinessController {
  constructor(private businessService: BusinessService) {}

  @Post()
  createBusiness(@Request() req, @Body() newBusiness: CreateBusinessDto) {
    const info = req.user as JwtPayload;
    console.log(info);

    return this.businessService.create(info.sub, newBusiness);
  }

  @Get()
  findUserBusinesses(@Request() req) {
    const info = req.user as JwtPayload;
    console.log(info);

    return this.businessService.findByUser(info.sub);
  }

  @Post('point-sale')
  createPuntoVenta(@Request() req, @Body() newPuntoVenta: CreatePointSaleDto) {
    const info = req.user as JwtPayload;
    console.log(info);

    return this.businessService.createPuntoVenta(info.sub, newPuntoVenta);
  }

  // Endpoint para obtener puntos de venta de un negocio
  @Get('/:id/point-sale')
  findPuntosVenta(@Param('id') id: string, @Request() req) {
    const info = req.user as JwtPayload;
    console.log(info);

    return this.businessService.findPuntosVentaByNegocio(+id, info.sub);
  }

  @Delete('point-sale/:id')
  deletePuntoVenta(@Param('id') id: string, @Request() req) {
    const info = req.user as JwtPayload;
    console.log(info);

    return this.businessService.deletePuntoVenta(+id, info.sub);
  }

  // Endpoint para eliminar un negocio
  @Delete(':id')
  deleteBusiness(@Param('id') id: string, @Request() req) {
    const info = req.user as JwtPayload;
    console.log(info);

    return this.businessService.deleteBusiness(+id, info.sub);
  }
 
}
