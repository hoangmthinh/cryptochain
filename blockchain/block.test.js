const hexToBinary = require('hex-to-binary');
const Block = require('./block');
const { GENESIS_DATA, MINE_RATE } = require('../config');
const { cryptoHash } = require('../util');

describe('Block', () => {
    const timeStamp = 2000;
    const lastHash = 'lastHash';
    const hash = 'hash';
    const data = ['blockchain', 'data'];
    //proof of work
    const nonce = 1;
    const difficulty = 1;

    const block = new Block({ timeStamp, lastHash, hash, data, nonce, difficulty });

    it('has a timestamp, lastHash, hash, data, nonce, difficulty', () => {
        expect(block.timeStamp).toEqual(timeStamp);
        expect(block.lastHash).toEqual(lastHash);
        expect(block.hash).toEqual(hash);
        expect(block.data).toEqual(data);
        expect(block.nonce).toEqual(nonce);
        expect(block.difficulty).toEqual(difficulty);
    });

    describe('genesis()', () => {
        const genesisBlock = Block.genesis();    

        it('return a block instance', () => {
            expect(genesisBlock instanceof Block).toBe(true);
        });

        it('return a genesis data', () => {
            expect(genesisBlock).toEqual(GENESIS_DATA);
        });
    });

    describe('mineBlock', () => {
        const lastBlock = Block.genesis();
        const data = 'mine data';
        const minedBlock = Block.mineBlock({lastBlock, data});

        it('return a block instance', () => {
            expect(minedBlock instanceof Block).toBe(true);
        });

        it(`set the 'lastHash' to the 'hash' of the lastBlock`, () => {
            expect(minedBlock.lastHash).toEqual(lastBlock.hash);
        });

        it(`set the 'data`, () => {
            expect(minedBlock.data).toEqual(data);
        });

        it(`set the 'timeStamp'`, () => {
            expect(minedBlock.timeStamp).not.toEqual(undefined);
        });

        it(`create SHA-256 'hash' based on the proper inputs`, () => {
            expect(minedBlock.hash)
            .toEqual(
                cryptoHash(
                    minedBlock.timeStamp,
                    minedBlock.nonce,
                    minedBlock.difficulty,
                    lastBlock.hash, 
                    data
                )
            );
        });

        it('set a `hash` that matches the difficulty criteria', () => {
            expect(hexToBinary(minedBlock.hash).substring(0, minedBlock.difficulty))
                .toEqual('0'.repeat(minedBlock.difficulty));
        });

        it('adjust the difficulty', () => {
            const possibleResult = [lastBlock.difficulty+1, lastBlock.difficulty-1];

            expect(possibleResult.includes(minedBlock.difficulty)).toBe(true);
        });
    });

    describe('adjustDifficulty()', () => {
        it('raise the difficulty for the quickly minedblock', () => {
            expect(Block.adjustDifficulty({ 
                originalBlock: block, timeStamp: block.timeStamp + MINE_RATE - 100
            })).toEqual(block.difficulty + 1);
        });

        it('raise the difficulty for the slowly minedblock', () => {
            expect(Block.adjustDifficulty({ 
                originalBlock: block, timeStamp: block.timeStamp + MINE_RATE + 100
            })).toEqual(block.difficulty - 1);
        });

        it('has a lower limit of 1', () => {
            block.difficulty = -1;

            expect(Block.adjustDifficulty({originalBlock: block})).toEqual(1);
        });
    });
});