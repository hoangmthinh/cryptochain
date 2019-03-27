const Blockchain = require('./index');
const Block = require('./block');
const { cryptoHash } = require('../util');
const Wallet = require('../wallet');
const Transaction = require('../wallet/transaction');

describe('Blockchain', () => {
    let blockchain, newChain, originalChain, errorMock;

    beforeEach(() => {
        blockchain = new Blockchain();
        newChain = new Blockchain();

        errorMock = jest.fn();
        global.console.error = errorMock;
        originalChain = blockchain.chain;
    });

    it('contain a `chain` Array instance', () => {
        expect(blockchain.chain instanceof Array).toBe(true);
    });

    it('start with the genesis block', () => {
        expect(blockchain.chain[0]).toEqual(Block.genesis());
    });

    it('add a new block to the chain', () => {
        const newData = 'foo bar';
        blockchain.addBlock({ data: newData });

    });

    describe('isValidChain()', () => {
        describe('when the chain does not start with genesis block', () => {
            it('return false', () => {
                blockchain.chain[0] = { data: 'fake-genesis-data' };
                expect(Blockchain.isValidChain(blockchain.chain)).toBe(false);
            });
        });

        describe('when the chain starts with genesis block and has multiple blocks', () => {
            beforeEach(() => {
                blockchain.addBlock({data: 'one'});
                blockchain.addBlock({data: 'two'});
                blockchain.addBlock({data: 'three'});
            });

            describe('and the lastHash reference has changed', () => {
                it('return false', () => {
                    blockchain.chain[2].lastHash = 'fake-lastHash';
                    expect(Blockchain.isValidChain(blockchain.chain)).toBe(false);
                });
                
            });

            describe('the chain contains a block with an invalid field', () => {
                it('return false', () => {
                    blockchain.chain[2].data = 'fake-data';
                    expect(Blockchain.isValidChain(blockchain.chain)).toBe(false);
                });
            });

            describe('the chain contain a block with a jumped difficulty', () => {
                it('return false', () => {
                    const lastBlock = blockchain.chain[blockchain.chain.length - 1];
                    const lastHash = lastBlock.hash;
                    const timeStamp = Date.now();
                    const nonce = 0;
                    const data = [];
                    const difficulty = lastBlock.difficulty - 3;
                    const hash = cryptoHash(timeStamp, lastHash, difficulty, nonce, data);
                    const badBlock = new Block({timeStamp, lastHash, hash, nonce, difficulty, data});

                    blockchain.chain.push(badBlock);

                    expect(Blockchain.isValidChain(blockchain.chain)).toBe(false);

                });
            });

            describe('the chain does not contain any invalid block', () => {
                it('return true', () => {
                    expect(Blockchain.isValidChain(blockchain.chain)).toBe(true);
                })
            });
        });
    });

    describe('replace chain', () => {
        let logMock;

        beforeEach(() => {
            logMock = jest.fn();
            global.console.log = logMock;
        });

        describe('when the new chain is not longer', () => {
            beforeEach(() => {
                newChain.chain[0] = { new: 'chain-0' };
                blockchain.replaceChain(newChain.chain);
            });

            it('does not replace the chain', () => {
                expect(blockchain.chain).toEqual(originalChain);
            });

            it('log an error', () => {
                expect(errorMock).toHaveBeenCalled();
            })
        });

        describe('when the new chain is longer', () => {
            beforeEach(() => {
                newChain.addBlock({data: 'one'});
                newChain.addBlock({data: 'two'});
                newChain.addBlock({data: 'three'});

            });

            describe('and the chain is invalid', () => {
                beforeEach(() => {
                    newChain.chain[2].hash = 'some-fake-hash';
                    blockchain.replaceChain(newChain.chain);
                });
                it('does not replace the chain', () => { 
                    expect(blockchain.chain).toEqual(originalChain);
                });
                
                it('log an error', () => {
                    expect(errorMock).toHaveBeenCalled();
                })
            });

            describe('and the chain is valid', () => {
                beforeEach(() => {
                    blockchain.replaceChain(newChain.chain);
                });
                it('replaces the chain', () => {
                    expect(blockchain.chain).toEqual(newChain.chain);
                });

                it('log the replacement', () => {
                    expect(logMock).toHaveBeenCalled();
                })
            });
        });

        describe('when the `validateTransactions` flag is true', () => {
            it('calls validTransactionData()', () => {
                const validTransactionDataMock = jest.fn();
                blockchain.validTransactionData = validTransactionDataMock;

                newChain.addBlock({data: 'foo'});
                blockchain.replaceChain(newChain.chain, true);

                expect(validTransactionDataMock).toHaveBeenCalled();
            })
        });
    });

    describe('validTransactionData()',() => {
        let transaction, rewardTransaction, wallet;

        beforeEach(()=> {
            wallet = new Wallet();
            transaction = wallet.createTransaction({ recipient: 'foo-address', amount: 65 });
            rewardTransaction = Transaction.rewardTransaction({minerWallet: wallet});

        });

        describe('and the transaction data is valid', () => {
            it('return true', () => {
                newChain.addBlock({data: [transaction, rewardTransaction]});
                expect(blockchain.validTransactionData({chain: newChain.chain})).toBe(true);
                expect(errorMock).not.toHaveBeenCalled();
            });
        });

        describe('and the transaction data has multiple rewards', () => {
            it('return false and log an error', () => {
                newChain.addBlock({ data: [transaction, rewardTransaction, rewardTransaction] });
                expect(blockchain.validTransactionData({chain: newChain.chain})).toBe(false);
                expect(errorMock).toHaveBeenCalled();
            });
        });

        describe('and the transaction data has at least one malformed outputMap', () => {
            describe('and the transaction is not a reward transaction', () => {
                it('return false and log an error', () => {
                    transaction.outputMap[wallet.publicKey] = 999999;

                    newChain.addBlock({data:[transaction, rewardTransaction]});
                    expect(blockchain.validTransactionData({chain: newChain.chain})).toBe(false);
                    expect(errorMock).toHaveBeenCalled();
                });
            });
            describe('and the transaction is a reward transaction', () => {
                it('return false and log an error', () => {
                    rewardTransaction.outputMap[wallet.publicKey] = 999999;

                    newChain.addBlock({data: [transaction, rewardTransaction]});
                    expect(blockchain.validTransactionData({chain: newChain.chain})).toBe(false);
                    expect(errorMock).toHaveBeenCalled();
                });
            });
        });

        describe('and the transaction data has at least one malformed input', () => {
            it('return false and log an error', () => {
                wallet.balance = 9000;
                const evilOutputMap = {
                    [wallet.publicKey]: 8900,
                    fooRecipient: 100,
                };

                const evilTransaction = {
                    input: {
                        timeStamp: Date.now(),
                        amount: wallet.balance,
                        address: wallet.publicKey,
                        signature: wallet.sign(evilOutputMap)
                    },
                    outputMap: evilOutputMap
                };

                newChain.addBlock({data: [evilTransaction, rewardTransaction]});
                expect(blockchain.validTransactionData({chain: newChain.chain})).toBe(false);
                expect(errorMock).toHaveBeenCalled();
            });
        });

        describe('and the block contains multiple identical transactions', () => {
            it('return false and log an error', () => {
                newChain.addBlock({data: [transaction, transaction, transaction, rewardTransaction]});
                expect(blockchain.validTransactionData({chain: newChain.chain})).toBe(false);
                expect(errorMock).toHaveBeenCalled();
            });
        });
    });

})