# Zero Knowledge - Cross Chain Recovery

App Demo Link: https://drive.google.com/file/d/15lqOOMZTEGsdMAqoCfFryqfac1nKFbTZ/view?usp=sharing
Oracle Demo: https://drive.google.com/file/d/1TNkKk1p5i7nNwZO2dcoFKsDsbI-VsYLB/view?usp=sharing

This application works as a tool to recover accounts on any chains. With support to validate Mina states on EVM and Solana coming soon, this tool
can become very useful for account abstraction with a zero knowledge based web2/social recovery.

This application currently only offers two mechanisims:
1. Just update the account owner using Mina Private Key
2. Update the account owner on EVM using Google ID Verification (In-Progress)

## How to use

This application is deployed online on `https://mina-2022.web.app/`. But to use it, first some steps have to be complete on local machine.
1. Clone this repository
2. `cd ./contracts`
3. `zk config` -> Configure berkeley
4. `zk deploy berkeley`
5. Open the app `https://mina-2022.web.app?zkApp={{zkAppPublicKey}}` and copy the signer key that is randomly generated
6. Edit `./contracts/src/interact.ts` and replace `B62qkqYvABDBT2vLZnM7WuVGqJL1QvPEwrLnMTyxRRqRTEyrWebiTUr` with your public key.
7. `npm run build && node build/src/interact.js berkeley`
8. After this transaction has passed, you are ready to go and use the app.

## In Progress

- Integration with ZK Google Auth integration to support Google Auth based recovery.
