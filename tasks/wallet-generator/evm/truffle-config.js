/* eslint-disable @typescript-eslint/no-var-requires */
const chains = require('./chains/get');

console.log('chains: ', chains);
module.exports = {
  contracts_build_directory: `./contracts/abis`,
  networks: chains,
  compilers: {
    solc: {
      version: '0.8.17',
      settings: {
        optimizer: {
          enabled: true,
          runs: 200,
        },
      },
    },
  },
};
