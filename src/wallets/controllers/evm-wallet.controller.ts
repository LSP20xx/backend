import {
  Body,
  Controller,
  Delete,
  Get,
  HttpException,
  HttpStatus,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';

import { AuthGuard } from '@nestjs/passport';
import { Wallet } from '@prisma/client';
import { GetUserIdFromSub } from 'src/users/decorators/get-user-id-from-sub.decorator';
import { TransactionsService } from '../../transactions/services/transaction.service';
import { Web3Service } from '../../web3/services/web3.service';
import { SendTransactionDto } from '../dto/send-transaction.dto';
import { EvmWalletService } from '../services/evm-wallet.service';

@Controller('evm-wallets')
export class EvmWalletController {
  constructor(
    private readonly walletService: EvmWalletService,
    private readonly web3Service: Web3Service,
    private readonly transactionsService: TransactionsService,
  ) {}

  @Get()
  findAll(): Promise<Wallet[]> {
    return this.walletService.findAll();
  }
  @Get(':id')
  async findOne(@Param('id') id: string): Promise<Wallet | null> {
    return await this.walletService.findOne(id);
  }

  @Post('create/:chainId')
  @UseGuards(AuthGuard('jwt'))
  async createWallet(
    @Param('chainId') chainId: string,
    @GetUserIdFromSub() userIdFromSub: string,
  ): Promise<Wallet> {
    return await this.walletService.createWallet(userIdFromSub, chainId);
  }

  @Post(':chainId/send')
  @UseGuards(AuthGuard('jwt'))
  async send(
    @Param('chainId') chainId: string,
    @Body() sendTransactionDto: SendTransactionDto,
  ): Promise<string> {
    try {
      const isUnlocked = this.web3Service.unlockWallet(
        chainId,
        sendTransactionDto.from,
        sendTransactionDto.encryptedPrivateKey,
      );

      if (!isUnlocked) {
        throw new HttpException(
          'No se pudo desbloquear la wallet.',
          HttpStatus.UNAUTHORIZED,
        );
      }

      const txHash = await this.web3Service.sendTransaction(
        chainId,
        sendTransactionDto,
        sendTransactionDto.encryptedPrivateKey,
      );

      const txData = {
        txHash,
        from: sendTransactionDto.from,
        to: sendTransactionDto.to,
        amount: sendTransactionDto.amount,
      };

      await this.transactionsService.saveTransaction(txData);

      return txHash;
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get(':chainId/transfers')
  async getTransfersForChain(@Param('chainId') chainId: string) {
    try {
      const transfers = await this.walletService.getTransfersForChain(chainId);
      return transfers;
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() wallet: Wallet): Promise<Wallet> {
    return this.walletService.update(id, wallet);
  }

  @Delete(':id')
  remove(@Param('id') id: string): Promise<void> {
    return this.walletService.remove(id);
  }
}