import {
  Mina,
  isReady,
  PublicKey,
  PrivateKey,
  Field,
  fetchAccount,
  zkappCommandToJson,
  Signature,
} from 'snarkyjs'

type Transaction = Awaited<ReturnType<typeof Mina.transaction>>;

// ---------------------------------------------------------------------------------------

import { Accounts } from '../../contracts/src/Accounts';
import { EthAddress } from '../../contracts/build/src/Accounts';

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
    const [controller, googleId, trustedOracle, owner, nonce] = await Promise.all([
      state.zkapp!.controller.get(),
      state.zkapp!.googleId.get(),
      state.zkapp!.trustedOracle.fetch(),
      state.zkapp!.owner.fetch(),
      state.zkapp?.account.nonce.get()
    ]);

    let safeParse;

    try {
      safeParse = controller.toString()
    } catch {
      safeParse = '0x'
    } finally {
      return JSON.stringify({
        controller: safeParse,
        googleId: googleId.toString(),
        trustedOracle: trustedOracle?.toBase58().toString(),
        owner: owner?.toBase58().toString(),
        nonce: nonce?.toString()
      });
    }
  },
  setOracle: async (oracleAddress: string) => {
    const oracleKey = PublicKey.fromBase58(oracleAddress);
    if (!state.signerKey) {
      return;
    }

    const sign = Signature.create(state.signerKey, oracleKey.toFields());

    const transaction = await Mina.transaction(() => {
        state.zkapp!.setTrustedOracle(oracleKey, sign);
      }
    );

    await transaction.prove();

    return transaction.toJSON();
  },
  setController: async (controllerAddress: string) => {
    const address = EthAddress.fromString(controllerAddress);

    if (!state.signerKey) {
      return;
    }

    const sign = Signature.create(state.signerKey, address.toFields());

    const transaction = await Mina.transaction(() => {
        state.zkapp!.setController(address, sign);
      }
    );

    await transaction.prove();
    return transaction.toJSON();
  },
  claimApp: async (owner: string) => {
    const address = PublicKey.fromBase58(owner);

    if (!state.signerKey) {
      return;
    }

    const transaction = await Mina.transaction(() => {
        state.zkapp?.setOwner(address)
      }
    );

    await transaction.prove();
    return transaction.toJSON();
  }
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
