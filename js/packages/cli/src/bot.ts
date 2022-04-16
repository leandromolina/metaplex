import { InvalidArgumentError, program } from 'commander';

import { PublicKey } from '@solana/web3.js';
import { CandyMachine, loadCandyProgramV2, loadWalletKey } from './helpers/accounts';

import { mintV2 } from './commands/mint';
import log from 'loglevel';

const rpcUrl = "https://lingering-damp-pine.solana-mainnet.quiknode.pro/c430ad34250aed0b00156df7244b39d9164d1ece/"
const chalk = require('chalk');
program.version('0.0.2');

log.setLevel(log.levels.WARN);

function myParseInt(value) {
    const parsedValue = parseInt(value, 10);
    if (isNaN(parsedValue)) {
        throw new InvalidArgumentError('Not a number.');
    }
    return parsedValue;
}

programCommand('start_mint', { requireWallet: true })
    .action(async (_, cmd) => {
        const { keypair, env, candyId } = cmd.opts();

        const walletKeyPair = loadWalletKey(keypair.split(',')[0]);

        const anchorProgram = await loadCandyProgramV2(walletKeyPair, env, rpcUrl);
        const candyMachine = new PublicKey(candyId);

        const candyMachineObj: CandyMachine = await anchorProgram.account.candyMachine.fetch(
            candyMachine,
        );

        console.log(candyMachineObj)

        var anti_bot = !!candyMachineObj.data.gatekeeper
        var price = myParseInt(candyMachineObj.data.price) / (10 ** 9)
        var remaining_items = Math.abs(myParseInt(candyMachineObj.data.itemsAvailable) - myParseInt(candyMachineObj.itemsRedeemed))
        var remaining_time = (myParseInt(candyMachineObj.data.goLiveDate) * 1000) - Date.now()

        console.log()
        console.log(`Price: ${price} SOL`)
        console.log(`Remaining tokens: ${remaining_items}`)
        console.log(`Antibot: ${anti_bot ? 'Enable' : 'Disable'}`)
        console.log(`Remaining time: ${remaining_time} ms`)
        console.log()

        if (anti_bot) {
            console.log(chalk.redBright(`This Mint is protected by captcha.`))
            return
        }

        if (remaining_items <= 0) {
            console.log(chalk.redBright(`This Mint is sold out.`))
            //return
        }

        setTimeout(() => {
            console.log(chalk.yellowBright("-START MINT TOKENS-"))
            setInterval(async () => {

                var keys = keypair.split(',')
                for (const key of keys) {
                    const wallet = loadWalletKey(key);
                    mintV2(key, env, candyMachine, rpcUrl).then((tx) => {
                        console.log(chalk.greenBright(`-Mint token finished with ${wallet.publicKey.toString()} successfully: ${tx}-`));
                    }).catch((error) => {
                        console.log(chalk.gray(`Fatal Error Mint with ${wallet.publicKey.toString()}: ${error.msg ?? error.message}`))
                    })
                }
            }, 500)

        }, remaining_time - 10000)
    });

function programCommand(
    name: string,
    options: { requireWallet: boolean } = { requireWallet: true },
) {
    let cmProgram = program
        .command(name)
        .option(
            '-e, --env <string>',
            'Solana cluster env name',
            'mainnet-beta', //mainnet-beta, testnet, devnet
        );

    if (options.requireWallet) {
        cmProgram = cmProgram.requiredOption(
            '-k, --keypair <path>',
            `Solana wallet location`,
        ).requiredOption('-c, --candy-id <string>',
            'Candy machine ID');
    }

    return cmProgram;
}

program.parse(process.argv);