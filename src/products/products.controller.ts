import {
  Body,
  Controller,
  Post,
  Request,
  Get,
  Put,
  Delete,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ProductsService } from './products.service';
import CreateProductDto from './dto/CreateProductDto';
import { JwtPayload } from 'src/auth/models/token.model';
import { JwtauthGuard } from 'src/auth/guards/JwtGuard.guard';
import UpdateProductDto from './dto/UpdateProductDto ';


@Controller('products')
@UseGuards(JwtauthGuard)
export class ProductsController {
  constructor(private productsService: ProductsService) {}

  @Post()
  createProduct(@Request() req, @Body() newProduct: CreateProductDto) {
    const info = req.user as JwtPayload;
    console.log(info);
    return this.productsService.createProduct(info.sub, newProduct);
  }

  @Get('/business/:id')
  findProductsByBusiness(@Param('id') id: string, @Request() req) {
    const info = req.user as JwtPayload;
    console.log(info);
    return this.productsService.findProductsByBusiness(+id, info.sub);
  }

  @Get('/business/:id/product/:productId')
  findProductById(
    @Param('id') id: string,
    @Param('productId') productId: string,
    @Request() req,
  ) {
    const info = req.user as JwtPayload;
    console.log(info);
    return this.productsService.findProductById(+id, +productId, info.sub);
  }

  @Put(':id')
  updateProduct(
    @Param('id') id: string,
    @Body() updateProductDto: UpdateProductDto,
    @Request() req,
  ) {
    const info = req.user as JwtPayload;
    console.log(info);
    return this.productsService.updateProduct(
      info.sub,
      +id,
      updateProductDto,
    );
  }

  @Delete(':id')
  deleteProduct(@Param('id') id: string, @Request() req) {
    const info = req.user as JwtPayload;
    console.log(info);
    return this.productsService.deleteProduct(+id, info.sub);
  }
}