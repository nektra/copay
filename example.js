var repl = require('repl');
var deasync = require('deasync');

var scCfg = {
    //domain: 'https://localhost:3000',
    domain: 'https://192.168.0.117:3000',
    emailDomain: 'SendCoin.com',
    title: 'SendCoin',
    fromPhoneNumber: '+14846015103',
    copayPath: __dirname + '/./',
    currencyHostname: 'blockchain.info',
    currencyPath: '/ticker'
};
var _ = require(scCfg.copayPath + 'lib/lodash/dist/lodash');
var copay = require(scCfg.copayPath + 'copay');
var config = require(scCfg.copayPath + 'config');
var async = require(scCfg.copayPath + 'js/models/Async');
var insight_mod = require(scCfg.copayPath + 'js/models/Insight');
var pluginManager = new copay.PluginManager(config);

var options = {
    pluginManager: pluginManager,
    plugins: config.plugins,
    network: config.network,
    networkName: 'testnet',
    walletDefaults: config.wallet,
    passphraseConfig: config.passphraseConfig,
    failIfExists: true
};

process.stdin.resume();
process.stdin.setEncoding('utf8');

function takeInput(){
    var ret = null;
    process.stdin.on(
        'data',
        function (text) {
            ret = text;
        }
    );
    while (!ret)
        deasync.runLoopOnce();
    return ret;
}

console.log('Email: ');
global.email = takeInput();
console.log('Password: ');
global.password = takeInput();

var openCreateOptions = _.extend(
    options,
    {
        email: global.email,
        password: global.password
    }
);

var identity = null;
global.convenience = {
    getIdentity: function (){
        return identity;
    },
    anyItem: function (x){
        return x[Object.keys(x)[0]];
    },
    spend: function (wallet, dest, satoshis){
        wallet.spend(
            {
                toAddress: dest,
                amountSat: satoshis
            },
            function (err){
                if (err)
                    console.log('Error: ' + err);
            }
        );
    },
    getBalance: function (wallet){
        wallet.getBalance(
            function (err, balance){
                if (err)
                    console.log('Error getting balance: ' + err);
                else
                    console.log('Balance for wallet ' + wallet.id + ': ' + balance);
            }
        );
    },
    getAnyWallet: function(){
        return this.anyItem(identity.wallets);
    }
};

var openCreateCallback = function (err, iden){
    if (err)
        if (err === 'notfound'){
            copay.Identity.create(
                openCreateOptions,
                openCreateCallback
            );
        }else
            console.log('Error opening/creating identity: ' + err);
    else{
        identity = iden;
        identity.openWallets();
        var network = new async(options.network.testnet);
        for (var i = 0; i < 10; i++) {
            var name = 'test' + i;
            var f = function (s) {
                return function (err, wallet) {
                    if (err)
                        console.log(err);
                    else {
                        var msg = 'Wallet named ' + s + ' created without errors. ';
                        //var addresses = wallet.getAddresses();
                        var secret = wallet.getSecret();
                        //if (addresses.length >= 1)
                        //    msg += 'Address: ' + addresses[0] + ' ';
                        msg += 'Secret: ' + secret;
                        console.log(msg);
                        wallet.netStart();
                    }
                };
            }(name);
            iden.createWallet(
                _.extend(
                    _.clone(options),
                    {
                        nickname: name,
                        requiredCopayers: 1,
                        totalCopayers: 1,
                        network: network,
                        blockchainOpts: { testnet: options.network.testnet }
                    }
                ),
                f
            );
        }
    }
};

copay.Identity.open(
    openCreateOptions,
    openCreateCallback
);

repl.start(
    {
        useGlobal: true
    }
);
