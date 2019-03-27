const Transaction = require('./transaction');
const Wallet = require('./index')
const { verifySignature } = require('../util')
const { REWARD_INPUT, MINING_REWARD } = require('../config')

describe('Transaction', () => {
    let  transaction, senderWallet, recipient, amount;

    beforeEach(() => {
        senderWallet = new Wallet();
        recipient = 'recipient-public-key';
        amount = 50;
        
        transaction = new Transaction({senderWallet, recipient, amount});
        
    });

    it('has an `id`', () => {
        expect(transaction).toHaveProperty('id');
    });

    describe('outputMap', () => {
        it('has an `output Map`', () => {
            expect(transaction).toHaveProperty('outputMap');
        });

        it('test output the amount to the recipient', () => {
            expect(transaction.outputMap[recipient]).toEqual(amount);
        });

        it('output remaining balance for the `sender` ', () => {
            expect(transaction.outputMap[senderWallet.publicKey])
            .toEqual(senderWallet.balance - amount);
        })
    });


    describe('input', () => {
        it('has an `input`',() => {
            expect(transaction).toHaveProperty('input');
        });

        it('has a `timeStamp` in the input', () => {
            expect(transaction.input).toHaveProperty('timeStamp');
        });

        it('set the `amount` to the `senderWallet` balance', () => {
            expect(transaction.input.amount).toEqual(senderWallet.balance);
        });

        it('set the `address` to the `senderWallet` publicKey', () => {
            expect(transaction.input.address).toEqual(senderWallet.publicKey);
        });

        it('sign the `input`', () => {
            expect(
                verifySignature({
                    publicKey: senderWallet.publicKey,
                    data: transaction.outputMap,
                    signature: transaction.input.signature
                })
            ).toBe(true);     
        });
    });

    describe('validTransaction()', () => {
        let errorMock;

        beforeEach(() => {
            errorMock = jest.fn();

            global.console.error = errorMock;
        });

        describe('when the transaction is valid', () => {
            it('return true', () => {
                expect(Transaction.validTransaction(transaction)).toBe(true);
            });

        });

        describe('when the transaction is invalid', () => {
            describe('and a transaction outputMap value is invalid', () => {
                it('return false && log an err', () => {
                    transaction.outputMap[senderWallet.publicKey] = 999999;
                    expect(Transaction.validTransaction(transaction)).toBe(false);
                    expect(errorMock).toHaveBeenCalled();
                });
            });

            describe('and a transaction input signature is invalid', () => {
                it('return false && log an err', () => {
                    transaction.input.signature = new Wallet().sign('data');
                    expect(Transaction.validTransaction(transaction)).toBe(false);
                    expect(errorMock).toHaveBeenCalled();
                });
            });
        });
    });

    describe('update()', () => {
        let originalSignature, originalSenderOutput, nextRecipient, nextAmount;

        describe('and the amount is invalid', () => {
            it('throws an error', () => {
                expect(() => {
                    transaction.update({
                        senderWallet, recipient: 'foo', amount: 999999
                    });
                }).toThrow('Amount exceeds balance');
            });
        });

        describe('and the amount is valid', () => {
            beforeEach(() => {
                originalSignature = transaction.input.signature;
                originalSenderOutput = transaction.outputMap[senderWallet.publicKey];
                nextRecipient = 'next-recipient';
                nextAmount = 50;
    
                transaction.update({ senderWallet, recipient: nextRecipient, amount:nextAmount });
            });
    
            it('output the amount to the next recipient', () => {
                expect(transaction.outputMap[nextRecipient]).toEqual(nextAmount);
            });
    
            it('subtract the amount from the original `senderWallet`', () => {
                expect(transaction.outputMap[senderWallet.publicKey]).toEqual(originalSenderOutput - nextAmount);
            });
    
            it('maintain a total output that matches the input amount', () => {
                expect(
                    Object.values(transaction.outputMap)
                    .reduce((total, outputAmount) =>  total + outputAmount)
                ).toEqual(transaction.input.amount);    
            });
    
            it('re-signs the transaction', () => {
                expect(transaction.input.signature).not.toEqual(originalSignature);
            });

            describe('add another update for the same recipient()', () => {
                let addedAmount;

                beforeEach(() => {
                    addedAmount = 80;
                    transaction.update({senderWallet, recipient: nextRecipient, amount: addedAmount})
                });

                it('add to the recipient amount', () => {
                    expect(transaction.outputMap[nextRecipient]).toEqual(nextAmount + addedAmount);
                });

                it('subtract the amount from the original sender output amount', () => {
                    expect(transaction.outputMap[senderWallet.publicKey]).toEqual(originalSenderOutput - nextAmount - addedAmount);
                });
            });

        });
    });

    describe('rewardTransaction()', () => {
        let rewardTransaction, minerWallet;

        beforeEach(() => {
            minerWallet = new Wallet(),
            rewardTransaction = Transaction.rewardTransaction({ minerWallet });
        });

        it('create a transaction with the reward input', () => {
            expect(rewardTransaction.input).toEqual(REWARD_INPUT);
        });

        it('create a transaction for the miner with the `mining-reward`', () => {
            expect(rewardTransaction.outputMap[minerWallet.publicKey]).toEqual(MINING_REWARD);
        });
    });

});