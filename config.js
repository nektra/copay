'use strict';
var defaultConfig = {
  defaultLanguage: 'en',
  // DEFAULT network (livenet or testnet)
  networkName: 'testnet',
  logLevel: 'info',

  // wallet limits
  limits: {
    totalCopayers: 6,
    mPlusN: 100,
  },

  // network layer config
  network: {
    testnet: {
      url: 'https://test-insight.bitpay.com:443',
      transports: ['polling'],
    },
    livenet: {
      url: 'https://insight.bitpay.com:443',
      transports: ['polling'],
    },
  },

  // wallet default config
  wallet: {
    requiredCopayers: 2,
    totalCopayers: 3,
    spendUnconfirmed: true,
    reconnectDelay: 5000,
    idleDurationMin: 4,
    settings: {
      unitName: 'bits',
      unitToSatoshi: 100,
      unitDecimals: 2,
      alternativeName: 'US Dollar',
      alternativeIsoCode: 'USD',
    }
  },

  // local encryption/security config
  passphraseConfig: {
    iterations: 5000,
    storageSalt: 'mjuBtGybi/4=',
  },

  rates: {
    url: 'https://insight.bitpay.com:443/api/rates',
  },

  verbose: 1,

  pluginsPath: __dirname + '/',
  plugins: {
    mongodbplugin: true
  },

  minPasswordStrength: 4
};
if (typeof module !== 'undefined')
  module.exports = defaultConfig;
