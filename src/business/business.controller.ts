import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Request,
  UseGuards,
} from '@nestjs/common';
import { BusinessService } from './business.service';
import { JwtauthGuard } from 'src/auth/guards/JwtGuard.guard';
import { JwtPayload } from 'src/auth/models/token.model';
import CreateBusinessDto from './dto/CreateBusiness';
import CreatePuntoVentaDto from './dto/CreatePointSale.dto';
import { UpdatePuntoVentaDto } from './dto/UpdatePuntoVentaDto';

@UseGuards(JwtauthGuard)
@Controller('business')
export class BusinessController {
  constructor(private businessService: BusinessService) {}

  //BUSINESS

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

  @Delete(':id')
  deleteBusiness(@Param('id') id: string, @Request() req) {
    const info = req.user as JwtPayload;
    console.log(info);
    return this.businessService.deleteBusiness(+id, info.sub);
  }

  //POINT OF SALE

  @Post('point-sale')
  createPuntoVenta(@Request() req, @Body() newPuntoVenta: CreatePuntoVentaDto) {
    const info = req.user as JwtPayload;
    console.log(info);
    return this.businessService.createPuntoVenta(info.sub, newPuntoVenta);
  }

  @Get('/:id/point-sale')
  findPuntosVenta(@Param('id') id: string, @Request() req) {
    const info = req.user as JwtPayload;
    console.log(info);
    return this.businessService.findPuntosVentaByNegocio(+id, info.sub);
  }

  @Get('/:id/point-sale/:idPointSale')
  findPuntoVentaInfo(
    @Param('id') id: string,
    @Param('idPointSale') idPointSale: string,
    @Request() req,
  ) {
    const info = req.user as JwtPayload;
    console.log(info);
    return this.businessService.findPuntoVentaById(+id, +idPointSale, info.sub);
  }

  @Put('/:id/point-sale/:idPointSale')
  updatePuntoVenta(
    @Param('id') id: string,
    @Param('idPointSale') idPointSale: string,
    @Body() updatePuntoVentaDto: UpdatePuntoVentaDto,
    @Request() req,
  ) {
    const info = req.user as JwtPayload;
    console.log(info);
    return this.businessService.updatePuntoVenta(
      info.sub,
      +idPointSale,
      updatePuntoVentaDto,
    );
  }

  @Delete('point-sale/:id')
  deletePuntoVenta(@Param('id') id: string, @Request() req) {
    const info = req.user as JwtPayload;
    console.log(info);
    return this.businessService.deletePuntoVenta(+id, info.sub);
  }
}
