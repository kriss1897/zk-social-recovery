import {
  fetchAccount,
  PublicKey,
  PrivateKey,
  Field,
} from 'snarkyjs'

import type { ZkappWorkerRequest, ZkappWorkerReponse, WorkerFunctions } from './zkappWorker';

export default class ZkappWorkerClient {

  // ---------------------------------------------------------------------------------------

  loadSnarkyJS() {
    return this._call('loadSnarkyJS', {});
  }

  setSignerKey(key: string) {
    return this._call('setSignerKey', key);
  }

  setActiveInstanceToBerkeley() {
    return this._call('setActiveInstanceToBerkeley', {});
  }

  loadContract() {
    return this._call('loadContract', {});
  }

  compileContract() {
    return this._call('compileContract', {});
  }

  fetchAccount({ publicKey }: { publicKey: PublicKey }): ReturnType<typeof fetchAccount> {
    const result = this._call('fetchAccount', { publicKey58: publicKey.toBase58() });
    return (result as ReturnType<typeof fetchAccount>);
  }

  initZkappInstance(publicKey: PublicKey) {
    return this._call('initZkappInstance', { publicKey58: publicKey.toBase58() });
  }

  async getState(): Promise<any> {
    const result = await this._call('getState', {});
    return JSON.parse(result as string);
  }

  async setOracle(oracleKey: string): Promise<any> {
    const result = await this._call('setOracle', oracleKey);

    return result;
  }

  async setController (controllerAddr: string): Promise<any> {
    const result = await this._call('setController', controllerAddr);

    return result;
  }

  async setOwner (ownerAddr: string): Promise<any> {
    const result = await this._call('claimApp', ownerAddr);

    return result;
  }

  // createUpdateTransaction() {
  //   return this._call('createUpdateTransaction', {});
  // }

  // proveUpdateTransaction() {
  //   return this._call('proveUpdateTransaction', {});
  // }

  // async getTransactionJSON() {
  //   const result = await this._call('getTransactionJSON', {});
  //   return result;
  // }

  // ---------------------------------------------------------------------------------------

  worker: Worker;

  promises: { [id: number]: { resolve: (res: any) => void, reject: (err: any) => void } };

  nextId: number;

  constructor() {
    this.worker = new Worker(new URL('./zkappWorker.ts', import.meta.url))
    this.promises = {};
    this.nextId = 0;

    this.worker.onmessage = (event: MessageEvent<ZkappWorkerReponse>) => {
      this.promises[event.data.id].resolve(event.data.data);
      delete this.promises[event.data.id];
    };
  }

  _call(fn: WorkerFunctions, args: any) {
    return new Promise((resolve, reject) => {
      this.promises[this.nextId] = { resolve, reject }

      const message: ZkappWorkerRequest = {
        id: this.nextId,
        fn,
        args,
      };

      this.worker.postMessage(message);

      this.nextId++;
    });
  }
}

