import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Request,
  UseGuards,
} from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { JwtauthGuard } from 'src/auth/guards/JwtGuard.guard';
import { JwtPayload } from 'src/auth/models/token.model';
import { CreateExpenseCategoryDto } from './dto/CreateExpenseCategoryDto';
import { CreateTransactionDto } from './dto/CreateTransactionDto';

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
  findExpenseCategories(@Param('id') id: string, @Request() req) {
    const info = req.user as JwtPayload;
    console.log(info);

    return this.transactionsService.findExpenseCategoriesByBusiness(
      +id,
      info.sub,
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

  @Post()
  createTransaction(
    @Body() newTransaction: CreateTransactionDto,
    @Request() req,
  ) {
    const info = req.user as JwtPayload;

    return this.transactionsService.createTransaction(info.sub, newTransaction);
  }
}
