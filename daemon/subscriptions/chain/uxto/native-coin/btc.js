/* eslint-disable @typescript-eslint/no-var-requires */
// daemon/subscriptions/chain/utxo/native-coin/bitcoin.js
const axios = require('axios');
const { Queue, prisma, uuidv4 } = require('./index');

const chainType = 'BTC';
const blockchainId = 'BITCOIN-TESTNET';
const coin = 'BTC';
const transactionsQueue = new Queue(`${coin.toLowerCase()}-transactions`);

class DepositBtcOnBillete {
  constructor() {
    this.bitcoinClient = axios.create({
      baseURL: 'https://go.getblock.io/d3997a11804641bda19e595364934897',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': 'd3997a11804641bda19e595364934897',
      },
    });
    this.lastPolledBlock = 0;
  }

  async pollForTransactions() {
    try {
      const latestBlock = await this.bitcoinClient.post('/', {
        jsonrpc: '2.0',
        id: 'getblock.io',
        method: 'getblockcount',
        params: [],
      });

      const blockCount = latestBlock.data.result;
      if (blockCount > this.lastPolledBlock) {
        this.lastPolledBlock = blockCount;
        await this.processBlock(blockCount);
      }
    } catch (error) {
      console.error('Error al obtener el último bloque:', error);
    }
  }

  async processBlock(blockNumber) {
    try {
      const blockHash = await this.bitcoinClient.post('/', {
        jsonrpc: '2.0',
        id: 'getblock.io',
        method: 'getblockhash',
        params: [blockNumber],
      });

      const blockHashData = blockHash.data.result;
      const blockDetails = await this.bitcoinClient.post('/', {
        jsonrpc: '2.0',
        id: 'getblock.io',
        method: 'getblock',
        params: [blockHashData, 2],
      });

      const transactions = blockDetails.data.result.tx;
      for (const tx of transactions) {
        await this.handleTransaction(tx.txid);
      }
    } catch (error) {
      console.error('Error al procesar el bloque:', error);
    }
  }

  async getBlockDetails(blockhash) {
    try {
      const blockDetailsResponse = await this.bitcoinClient.post('/', {
        jsonrpc: '2.0',
        id: 'getblock.io',
        method: 'getblock',
        params: [blockhash, true],
      });
      const blockDetails = blockDetailsResponse.data.result;
      return blockDetails;
    } catch (error) {
      console.error('Error al obtener los detalles del bloque:', error);
    }
  }

  async handleTransaction(txid) {
    try {
      const response = await this.bitcoinClient.post('/', {
        jsonrpc: '2.0',
        id: 'getblock.io',
        method: 'getrawtransaction',
        params: [txid, true],
      });
      const transaction = response.data.result;
      if (transaction && transaction.vout) {
        for (const vout of transaction.vout) {
          if (vout.scriptPubKey && vout.scriptPubKey.address) {
            console.log('address', vout.scriptPubKey.address);
            const wallet = await prisma.wallet.findUnique({
              where: {
                address: vout.scriptPubKey.address,
              },
            });

            if (wallet) {
              const blockDetails = await this.getBlockDetails(
                transaction.blockhash,
              );
              const blockNumber = blockDetails ? blockDetails.height : null;

              if (blockNumber) {
                await transactionsQueue.add(
                  'transaction',
                  {
                    txHash: txid,
                    amount: vout.value,
                    from: '',
                    to: vout.scriptPubKey.address,
                    transactionType: 'DEPOSIT',
                    status: 'PROCESSING',
                    confirmations: transaction.confirmations,
                    chainType,
                    blockchainId: blockchainId,
                    blockNumber: blockNumber,
                    walletId: wallet.id,
                    userId: wallet.userId,
                    network: blockchainId === 'MAINNET' ? 'MAINNET' : 'TESTNET',
                    coin: coin,
                    isNativeCoin: true,
                    uuid: uuidv4(),
                  },
                  {
                    attempts: 5,
                    backoff: {
                      type: 'exponential',
                      delay: 5000,
                    },
                  },
                );
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('Error al manejar la transacción:', error);
    }
  }
}

const depositBtcOnBillete = new DepositBtcOnBillete();

setInterval(() => {
  depositBtcOnBillete.pollForTransactions();
}, 3000);
