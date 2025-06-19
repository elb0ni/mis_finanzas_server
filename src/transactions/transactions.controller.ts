import {
  Body,
  Controller,
  Delete,
  Get,
  HttpException,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { JwtauthGuard } from 'src/auth/guards/JwtGuard.guard';
import { JwtPayload } from 'src/auth/models/token.model';
import { CreateExpenseCategoryDto } from './dto/CreateExpenseCategoryDto';
import { CreateTransactionDto } from './dto/CreateTransactionDto';
import { TransactionDateDto } from './dto/TransactionDateDto ';

@UseGuards(JwtauthGuard)
@Controller('transactions')
export class TransactionsController {
  constructor(private transactionsService: TransactionsService) {}

  // Create a new expense category
  @Post('expense-categories')
  createExpenseCategory(
    @Request() req,
    @Body() newCategory: CreateExpenseCategoryDto,
  ) {
    const info = req.user as JwtPayload;
    console.log(info);

    return this.transactionsService.createExpenseCategory(
      info.sub,
      newCategory,
    );
  }

  // Get all expense categories for a business
  @Get('business/:id/expense-categories')
  findExpenseCategories(
    @Param('id') id: string,
    @Query('tipo_costo') tipoCosto: string,
    @Request() req,
  ) {
    const info = req.user as JwtPayload;
    console.log(info);

    // Validar que el tipo_costo sea válido
    if (tipoCosto && !['fijo', 'variable'].includes(tipoCosto.toLowerCase())) {
      throw new HttpException(
        'El tipo de costo debe ser "fijo" o "variable"',
        HttpStatus.BAD_REQUEST,
      );
    }

    return this.transactionsService.findExpenseCategoriesByBusiness(
      +id,
      info.sub,
      tipoCosto?.toLowerCase(),
    );
  }

  // Get a specific expense category by ID
  @Get('expense-categories/:id')
  findExpenseCategoryById(@Param('id') id: string, @Request() req) {
    const info = req.user as JwtPayload;
    console.log(info);

    return this.transactionsService.findExpenseCategoryById(+id, info.sub);
  }

  // Update an expense category
  @Put('expense-categories/:id')
  updateExpenseCategory(
    @Param('id') id: string,
    @Request() req,
    @Body() updateData: Partial<CreateExpenseCategoryDto>,
  ) {
    const info = req.user as JwtPayload;
    console.log(info);

    return this.transactionsService.updateExpenseCategory(
      +id,
      info.sub,
      updateData,
    );
  }

  // Delete an expense category
  @Delete('expense-categories/:id')
  deleteExpenseCategory(@Param('id') id: string, @Request() req) {
    const info = req.user as JwtPayload;
    console.log(info);

    return this.transactionsService.deleteExpenseCategory(+id, info.sub);
  }

  //transactions section

  @Post()
  createTransaction(
    @Body() newTransaction: CreateTransactionDto,
    @Request() req,
  ) {
    const info = req.user as JwtPayload;

    return this.transactionsService.createTransaction(info.sub, newTransaction);
  }

  @Get('business/:id')
  getTransactionsByBusiness(
    @Param('id') businessId: string,
    @Request() req,
    @Query('fecha') fecha: string,
  ) {
    const info = req.user as JwtPayload;
    return this.transactionsService.getTransactionsByBusiness(
      info.sub,
      +businessId,
      fecha,
    );
  }

  @Get('dailytransaciton/:businessId')
  getTransactionByDay(
    @Query('fecha') fecha: string,
    @Query('tipo') tipo: string,
    @Param('businessId') businessId,
    @Request() req,
  ) {
    const user = req.user as JwtPayload;

    return this.transactionsService.getTransactionByDay(
      user.sub,
      businessId,
      fecha,
      tipo,
    );
  }


}
