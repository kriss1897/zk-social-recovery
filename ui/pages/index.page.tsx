import { useEffect, useState, Fragment } from "react";
import { PublicKey, Encoding, PrivateKey } from "snarkyjs";
import { getAddress, isAddress } from "ethers/lib/utils";

import ContractABI from "../contracts/SampleAccounts.json";
import { JsonRpcProvider } from "@ethersproject/providers";
import { Contract, ethers } from "ethers";

import ZkappWorkerClient from "../zkApp/zkappWorkerClient";
import { Account } from "snarkyjs/dist/node/lib/fetch";
import { EthAddress } from "../../contracts/build/src/Accounts";
import { sign } from "crypto";

import { Dialog, Transition } from '@headlessui/react'

function TransactionModal ({ isOpen, handleClose, status }: { status: string, isOpen: boolean, handleClose: Function }) {
  return (
    <>
      <Transition appear show={isOpen} as={Fragment}>
        <Dialog as="div" className="relative z-10" onClose={() => handleClose()}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black bg-opacity-25" />
          </Transition.Child>

          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4 text-center">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all">
                  <Dialog.Title
                    as="h3"
                    className="text-lg font-medium leading-6 text-gray-900"
                  >
                    Transaction
                  </Dialog.Title>
                  <div className="mt-2">
                    <p className="text-sm text-gray-500">
                      { status }
                    </p>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>
    </>
  )
}

function SmartContract({
  address,
  handleLoaded,
}: {
  address: any;
  handleLoaded: Function;
}) {
  const [loaded, setLoaded] = useState(false);
  const [provider] = useState(
    new JsonRpcProvider(
      "https://goerli.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161"
    )
  );
  const [state, setState] = useState({
    controller: "0x",
    oracle: "0x",
    owner: '0x',
  });

  useEffect(() => {
    isAddress(address) ? loadContract() : console.log('not address');
  }, [address]);

  async function loadContract() {
    const contract = new Contract(getAddress(address), ContractABI, provider);

    const [controller, oracle, owner] = await Promise.all([
      contract.controller(),
      contract.oracle(),
      contract.owner(),
    ]);

    setState({ controller: ethers.utils.toUtf8String(controller), oracle, owner });

    setLoaded(true);
    handleLoaded();
  }

  if (!loaded) {
    return (
      <button
        className="my-2 px-4 py-2 bg-cyan-200 rounded-md text-cyan-900 font-bold"
        onClick={loadContract}
      >
        Load Contract
      </button>
    );
  }

  return <div>
      <ul>  
        <li className="my-2">
          <span className="text-gray-400 text-sm block">Controller</span>
          {state.controller}
        </li>
        <li className="my-2">
          <span className="text-gray-400 text-sm block">Oracle</span>
          {state.oracle}
        </li>
        <li className="my-2">
          <span className="text-gray-400 text-sm block">Owner</span>
          {state.owner}
        </li>
      </ul>
  </div>;
}

function MinaAppController({ controller, handleUpdate, contractReady }: { contractReady: boolean, controller: string, handleUpdate: Function }) {
  const [address, setAddress] = useState(controller || '');

  return <div>
    <input
      className="w-full px-4 py-2 rounded-md border-2"
      placeholder="Address"
      onChange={(e) => setAddress(e.target.value)}
      value={controller}
    />
    { contractReady ? <button
      disabled={!contractReady}
        className="my-2 px-4 py-2 bg-cyan-200 rounded-md text-cyan-900 font-bold"
        onClick={() => handleUpdate(address)}
      >
      { controller === '0x' ? 'Set Controller' : 'Update Controller' }
    </button> : <span className="animate-pulse">Loading App</span>}
  </div>
}

function MinaAppOracle({ oracle, handleUpdate, contractReady }: { contractReady: boolean, oracle: string, handleUpdate: Function }) {
  const [address, setAddress] = useState(oracle || '');

  return <div>
    <input
      className="w-full px-4 py-2 rounded-md border-2"
      placeholder="Oracle Key"
      onChange={(e) => setAddress(e.target.value)}
      value={address}
    />
    { contractReady ? <button
        className="my-2 px-4 py-2 bg-cyan-200 rounded-md text-cyan-900 font-bold"
        onClick={() => handleUpdate(address)}
      >
      { oracle === '0x' ? 'Set Oracle' : 'Update Oracle' }
    </button> : <span className="animate-pulse">Loading App</span> }
  </div>
}

function MinaApp({
  client,
  appPublicKey,
  signerKey
}: {
  client: ZkappWorkerClient;
  appPublicKey: PublicKey;
  signerKey: string
}) {
  const [appState, setAppState] = useState({
    currentState: null as null | any
  });

  const [contractReady, setContractReady] = useState(false);
  const [isOpen, toggleModal] = useState(false);
  const [status, setStatus] = useState('');
  const [transactions, setTransactions] = useState<string[]>([]);

  useEffect(() => {
    initialSetup()
      .then(() => console.log("Compiling Contract"))
      .then(() => client.compileContract())
      .then(() => setContractReady(true))
      .then(() => console.log("Contract Compiled"));
  }, []);

  async function initialSetup() {
    await client.loadContract();
    await client!.initZkappInstance(appPublicKey);
    console.log("getting zkApp state...");
    await client!.fetchAccount({ publicKey: appPublicKey });
    const currentState = await client!.getState();
    console.log("current state:", currentState);

    setAppState({ currentState });
  }

  async function handleControllerUpdate(_address: string) {
    try {
      toggleModal(true);
      setStatus('Generating proof for controller update. This might take a while');
      const transaction = await client.setController(_address);
      setStatus('Sending Transaction.');
      const { hash } = await (window as any).mina.sendTransaction({
        transaction: transaction,
        feePayer: {
          fee: 0.1,
          memo: ''
        }
      });
      setStatus(`Sent Transaction: ${hash}`)

      setTransactions([hash].concat(transactions));
      setTimeout(() => toggleModal(false), 2000);
    }
    catch (err) {
      toggleModal(false);
    }
  }

  async function handleOracleUpdate(_address: string) {
    try {
      toggleModal(true);
      setStatus('Generating proof for oracle update. This might take a while');
      const transaction = await client.setOracle(_address);
      setStatus('Sending Transaction.');
      const { hash } = await (window as any).mina.sendTransaction({
        transaction: transaction,
        feePayer: {
          fee: 0.1,
          memo: ''
        }
      });
      setStatus(`Sent Transaction: ${hash}`)

      setTransactions([hash].concat(transactions));
      setTimeout(() => toggleModal(false), 2000);
    }
    catch (err) {
      toggleModal(false);
    }
  }

  async function handleSetOwner() {
    try {
      toggleModal(true);
      setStatus('Generating proof for owner update. This might take a while');
      const transaction = await client.setOwner(signerKey);
      setStatus('Sending Transaction.');
      const { hash } = await (window as any).mina.sendTransaction({
        transaction: transaction,
        feePayer: {
          fee: 0.1,
          memo: ''
        }
      });
      setStatus(`Sent Transaction: ${hash}`)

      setTransactions([hash].concat(transactions));
      setTimeout(() => toggleModal(false), 2000);
    }
    catch (err) {
      toggleModal(false);
    }
  }

  if (!appState.currentState) {
    return <p>Loading</p>;
  }

  return (
    <div>
      <TransactionModal isOpen={isOpen} handleClose={console.log} status={status} />
      <ul>
        <li className="my-2">
          <span className="text-gray-400 text-sm block">Owner</span>
          {appState.currentState.owner ? appState.currentState.owner : contractReady && <button
            className="my-2 px-4 py-2 bg-cyan-200 rounded-md text-cyan-900 font-bold"
            onClick={() => handleSetOwner()}
          >
          Claim ZkApp
        </button>}
        </li>
        <li className="my-2">
          <span className="text-gray-400 text-sm block">Google ID</span>
          {appState.currentState.googleId}
        </li>
        <li className="my-2">
          <span className="text-gray-400 text-sm block">Controller</span>
          <MinaAppController controller={appState.currentState.controller} contractReady={contractReady} handleUpdate={handleControllerUpdate}/>
        </li>
        <li className="my-2">
          <span className="text-gray-400 text-sm block">Trusted Oracle</span>
          <MinaAppOracle oracle={appState.currentState.trustedOracle} contractReady={contractReady} handleUpdate={handleOracleUpdate}/>
        </li>
      </ul>
      { transactions.length > 0 && <>
          <span>Recent Transactions</span>
          <ul>
            { transactions.map((hash, idx) => <li key={idx}><a href={`https://berkeley.minaexplorer.com/transaction/${hash}`}>{hash}</a></li>)}
          </ul>
        </>
      }
    </div>
  );
}

function WalletView(props: { account: Account; publicKey: string }) {
  return (
    <div>
      <span className="text-gray-400 text-sm block">Fee Payer</span>
      {props.publicKey}
      {/* {props.balance} */}
    </div>
  );
}

export default function Home() {
  const [address, setAddress] = useState("");
  const [locked, toggleLock] = useState(false);
  const [libraryLoaded, setLibraryLoaded] = useState(false);
  const [zkappWorkerClient, setClient] = useState<ZkappWorkerClient>();
  const [wallet, setWallet] = useState<Account | null>();
  const [walletPublicKey, setWalletPublicKey] = useState<string | null>(null);
  const [signerKey, setSignerKey] = useState<string|null>(null);
  const [zkAppKey, setZkAppKey] = useState<string|null>(null);

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const zkAppKey = searchParams.get('zkApp');

    if (!zkAppKey) {
      return;
    }

    setZkAppKey(zkAppKey);
    
    const client = new ZkappWorkerClient();
    console.log("Loading SnarkyJS...");

    client
      .loadSnarkyJS()
      .then(() => {
        let privateKeyStr = localStorage.getItem('mina-signer-key');

        if (!privateKeyStr) {
          privateKeyStr = PrivateKey.random().toBase58().toString();

          localStorage.setItem('mina-signer-key', privateKeyStr);
        }

        const publicKey = PrivateKey.fromBase58(privateKeyStr).toPublicKey();

        setSignerKey(publicKey.toBase58().toString());

        return client.setSignerKey(privateKeyStr);
      })
      .then(() => client.setActiveInstanceToBerkeley())
      .then(() => {
        setClient(client);
        setLibraryLoaded(true);
        console.log("SnarkyJS Loaded and network set to Berkeley");
      });
  }, []);

  useEffect(() => {
    libraryLoaded && loadWallet();
  }, [libraryLoaded]);

  async function loadWallet() {
    const mina = (window as any).mina;
    if (mina == null) {
      setWallet(null);
      return;
    }

    const publicKeyBase58: string = (await mina.requestAccounts())[0];
    const publicKey = PublicKey.fromBase58(publicKeyBase58);

    setWalletPublicKey(publicKeyBase58.toString());

    console.log("using key", publicKey.toBase58());
    console.log("checking if account exists...");

    const res = await zkappWorkerClient!.fetchAccount({
      publicKey: publicKey!,
    });
    const accountExists = res.error == null;

    if (accountExists) {
      console.log(res.account);
      setWallet(res.account);
    } else {
      setWallet(null);
    }
  }

  if (!zkAppKey) {
    return <div className="max-w-xl text-center">
      <p>No zkAppKey set. Go through <a href="https://github.com/kriss1897/zk-social-recovery" target="_blank" rel="noreferrer">https://github.com/kriss1897/zk-social-recovery</a></p>
    </div>
  }

  if (!libraryLoaded) {
    return <p>Loading</p>;
  }

  return (
    <div className="m-8 p-8">
      <div className="max-w-3xl p-4 mx-auto">
        {wallet && (
          <WalletView publicKey={walletPublicKey || ""} account={wallet} />
        )}
        <div className="mt-4"><span className="text-gray-400 text-sm block">Signer Key</span> { signerKey }</div>
      </div>
      <div className="shadow-lg max-w-3xl rounded-lg p-8 my-4 bg-white mx-auto">
        {zkappWorkerClient && (
          <MinaApp
            client={zkappWorkerClient}
            signerKey={signerKey as string}
            appPublicKey={PublicKey.fromBase58(zkAppKey)}
          />
        )}
      </div>
      <div className="shadow-lg max-w-3xl rounded-lg p-8 bg-white mx-auto">
        <input
          disabled={locked}
          readOnly={locked}
          className="w-full px-4 py-2 rounded-md border-2"
          placeholder="Address"
          onChange={(e) => setAddress(e.target.value)}
        />
        {isAddress(address) && (
          <SmartContract
            address={address}
            handleLoaded={() => toggleLock(true)}
          />
        )}
      </div>
    </div>
  );
}
