import {
  Mina,
  isReady,
  PublicKey,
  PrivateKey,
  Field,
  fetchAccount,
} from 'snarkyjs'

type Transaction = Awaited<ReturnType<typeof Mina.transaction>>;

// ---------------------------------------------------------------------------------------

import type { Accounts } from '../../contracts/src/Accounts';

const state = {
  signerKey: null as null | PrivateKey, 
  Accounts: null as null | typeof Accounts,
  zkapp: null as null | Accounts,
  transaction: null as null | Transaction,
}

// ---------------------------------------------------------------------------------------

const functions = {
  loadSnarkyJS: async () => {
    await isReady;
  },
  setSignerKey: (privateKey: string) => {
    state.signerKey = PrivateKey.fromBase58(privateKey);
  },
  setActiveInstanceToBerkeley: async (args: {}) => {
    const Berkeley = Mina.Network(
      "https://proxy.berkeley.minaexplorer.com/graphql"
    );
    Mina.setActiveInstance(Berkeley);
  },
  loadContract: async (args: {}) => {
    const { Accounts } = await import('../../contracts/build/src/Accounts');
    state.Accounts = Accounts;
  },
  compileContract: async (args: {}) => {
    await state.Accounts!.compile();
  },
  fetchAccount: async (args: { publicKey58: string }) => {
    const publicKey = PublicKey.fromBase58(args.publicKey58);
    return await fetchAccount({ publicKey });
  },
  initZkappInstance: async (args: { publicKey58: string }) => {
    const publicKey = PublicKey.fromBase58(args.publicKey58);
    state.zkapp = new state.Accounts!(publicKey);
  },
  getState: async (args: {}) => {
    const [controller, googleId, trustedOracle, owner] = await Promise.all([
      state.zkapp!.controller.get(),
      state.zkapp!.googleId.get(),
      state.zkapp!.trustedOracle.fetch(),
      state.zkapp!.owner.fetch()
    ]);

    return JSON.stringify({
      controller: controller.toString(),
      googleId: googleId.toString(),
      trustedOracle: trustedOracle?.toBase58().toString(),
      owner: owner?.toBase58().toString()
    });
  },
  // updateController: async (args: {}) => {
  //   const transaction = await Mina.transaction(() => {
  //       state.zkapp!.updateController;
  //     }
  //   );
  //   state.transaction = transaction;
  // },
  // proveUpdateTransaction: async (args: {}) => {
  //   await state.transaction!.prove();
  // },
  // getTransactionJSON: async (args: {}) => {
  //   return state.transaction!.toJSON();
  // },
};

// ---------------------------------------------------------------------------------------

export type WorkerFunctions = keyof typeof functions;

export type ZkappWorkerRequest = {
  id: number,
  fn: WorkerFunctions,
  args: any
}

export type ZkappWorkerReponse = {
  id: number,
  data: any
}
if (process.browser) {
  addEventListener('message', async (event: MessageEvent<ZkappWorkerRequest>) => {
    const returnData = await functions[event.data.fn](event.data.args);

    const message: ZkappWorkerReponse = {
      id: event.data.id,
      data: returnData,
    }
    postMessage(message)
  });
}
