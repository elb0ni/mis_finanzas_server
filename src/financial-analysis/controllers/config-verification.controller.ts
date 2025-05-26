import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { JwtauthGuard } from 'src/auth/guards/JwtGuard.guard';
import { ConfigVerificationService } from '../services/config-verification.service';
import { JwtPayload } from 'src/auth/models/token.model';
import { QuickConfirmationDto } from '../dto/quick-confirmation.dto';

@Controller('financial-analysis/config-verification')
@UseGuards(JwtauthGuard)
export class ConfigVerificationController {
    constructor(private readonly configVerificationService: ConfigVerificationService) { }


    @Get(':businessId')
    async verifyCurrentMonthConfig(
        @Req() req,
        @Param('businessId') businessId: number,
        @Body('pointOfSaleId') pointOfSaleId?: number
    ) {
        const user = req.user as JwtPayload;


        return this.configVerificationService.verifyCurrentMonthConfig(
            user.sub,
            businessId,
            pointOfSaleId
        );
    }

    @Post('quick-confirm')
    async quickConfirmCurrentConfig(
      @Req() req,
      @Body() data: QuickConfirmationDto
    ) {
      return this.configVerificationService.quickConfirmCurrentConfig(
        req.user.userId,
        data
      );
    }
}
