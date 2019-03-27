const express = require('express');
const bodyParser = require('body-parser');
const request = require('request');
const path = require('path');
const Blockchain = require('./blockchain');
const PubSub = require('./app/pubsub');
const TransactionPool = require('./wallet/transaction-pool');
const Wallet = require('./wallet');
const TransactionMiner = require('./app/transaction-miner');


const isDevelopment = process.env.ENV === 'development';


const DEFAULT_PORT = 3000;
const ROOT_NODE_ADRESS = `http://localhost:${DEFAULT_PORT}`;
const REDIS_URL = isDevelopment ?
    'redis://127.0.0.1:6379' :
    'redis://h:p72c97ceb2ef2597e3b322086d13a30ef1ac540f33fe192de72239a5a3c2c23ed@ec2-3-209-100-93.compute-1.amazonaws.com:9229'

const app = express();
const blockchain = new Blockchain();
const transactionPool = new TransactionPool();
const wallet = new Wallet();
const pubsub = new PubSub({ blockchain, transactionPool, redisUrl: REDIS_URL });
const transactionMiner = new TransactionMiner({blockchain, transactionPool, wallet, pubsub});


// setTimeout(() => {
//     pubsub.broadcastChain();
// }, 1000);

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'client/dist')));

app.get('/api/blocks', (req, res, next) => {
    res.json(blockchain.chain);
});

app.post('/api/mine', (req, res, next) => {
    const {data} = req.body;

    blockchain.addBlock({data});

    pubsub.broadcastChain();
    res.redirect('/api/blocks')
});

app.get('/api/transaction-pool-map', (req, res, next) => {
    res.json(transactionPool.transactionMap);
});

app.post('/api/transaction', (req, res, next) => {
    const { amount, recipient } = req.body;
    let transaction = transactionPool.existingTransaction({ inputAddress: wallet.publicKey });

    try {
        if (transaction) {
            transaction.update({senderWallet: wallet, recipient, amount});
        } else {
            transaction = wallet.createTransaction({ recipient, amount, chain: blockchain.chain });    
        }
        
    } catch (error) {
        return res.status(400).json({type: 'error', message: error.message});
    }
    
    transactionPool.setTransaction(transaction);
    //
    pubsub.broadcastTransaction(transaction);
    res.json({ type:'success', transaction });
    
})

app.get('/api/mine-transaction', (req, res, next) => {
    transactionMiner.mineTransactions();

    res.redirect('/api/blocks');
});

app.get('/api/wallet-info', (req, res, next) => {
    const address = wallet.publicKey;
    res.json({
        address,
        balance: Wallet.calculateBalance({chain: blockchain.chain, address})
    })
});

app.get('*', (req, res, next) => {
    res.sendFile(path.join(__dirname, 'client/dist/index.html'));
});


const syncWithRootState = () => {
    request({ url: `${ROOT_NODE_ADRESS}/api/blocks` }, (err, res, body) => {
        if (!err && res.statusCode === 200) {
            const rootChain = JSON.parse(body);
            console.log('replace chain on a sync with ', rootChain);
            
            blockchain.replaceChain(rootChain);
        }
    });

    request({ url: `${ROOT_NODE_ADRESS}/api/transaction-pool-map`}, (err, res, body) => {
        if (!err && res.statusCode === 200) {
            const rootTransactionPoolMap = JSON.parse(body);

            console.log('replace transaction pool map on a sync with', rootTransactionPoolMap);

            transactionPool.setMap(rootTransactionPoolMap);
        }
    });
};

if (isDevelopment) {
    const walletFoo = new Wallet();
    const walletBar = new Wallet();

    const generateWalletTransaction = ({wallet, recipient, amount}) => {
        const transaction = wallet.createTransaction({
            recipient, amount, chain: blockchain.chain
        });

        transactionPool.setTransaction(transaction);

    };

    const walletAction = () => generateWalletTransaction({
        wallet, recipient: walletFoo.publicKey, amount: 5
    });

    const walletFooAction = () => generateWalletTransaction({
        wallet: walletFoo, recipient: walletBar.publicKey, amount: 10
    });

    const walletBarAction = () => generateWalletTransaction({
        wallet: walletBar, recipient: wallet.publicKey, amount: 15
    });

    for (let i = 0; i < 10; i++) {
        if (i%3 === 0) {
            walletAction();
            walletFooAction();
        } else if (i%3 === 1) {
            walletAction();
            walletBarAction();
        } else {
            walletFooAction();
            walletBarAction();
        }

        transactionMiner.mineTransactions();
        
    }
}


let PEER_PORT;

if (process.env.GENERATE_PEER_PORT === 'true') {
    PEER_PORT = DEFAULT_PORT + Math.floor(Math.random() * 1000);
}

const PORT = process.env.PORT || PEER_PORT || DEFAULT_PORT;

app.listen(PORT, () => {
    console.log(`server is listenning at: ${PORT}` );

    if (PORT !== DEFAULT_PORT) {
        syncWithRootState();    
    }
    
});
