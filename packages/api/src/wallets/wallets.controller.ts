import {
  Controller,
  Get,
  Param,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { WalletsService } from './wallets.service.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import type { JwtPayload } from '../common/decorators/current-user.decorator.js';

@ApiTags('Wallets')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('vaults/:vaultId/wallet')
export class WalletsController {
  constructor(private readonly walletsService: WalletsService) {}

  @Get('me')
  @ApiOperation({
    summary: 'Get own wallet (private: total/reserved/available)',
  })
  getMyWallet(
    @Param('vaultId', ParseIntPipe) vaultId: number,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.walletsService.getWalletWithBalances(vaultId, user.sub);
  }
}
