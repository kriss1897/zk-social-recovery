import { useEffect, useState } from "react";
import { PublicKey, Encoding, PrivateKey } from "snarkyjs";
import { getAddress, isAddress } from "ethers/lib/utils";

import ContractABI from "../contracts/SampleAccounts.json";
import { JsonRpcProvider } from "@ethersproject/providers";
import { Contract } from "ethers";

import ZkappWorkerClient from "../zkApp/zkappWorkerClient";
import { Account } from "snarkyjs/dist/node/lib/fetch";
import { EthAddress } from "../../contracts/build/src/Accounts";
import { sign } from "crypto";

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
    count: 0,
  });

  async function loadContract() {
    const contract = new Contract(getAddress(address), ContractABI, provider);

    const [controller, oracle, count] = await Promise.all([
      contract.controller(),
      contract.oracle(),
      contract.count(),
    ]);

    setState({ controller, oracle, count });

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

  return <div>{JSON.stringify(state)}</div>;
}

function MinaAppController({ controller, handleUpdate }: { controller: string, handleUpdate: Function }) {
  const [address, setAddress] = useState(controller);

  return <div>
    <input
      className="w-full px-4 py-2 rounded-md border-2"
      placeholder="Address"
      onChange={(e) => setAddress(e.target.value)}
    />
    <button
        className="my-2 px-4 py-2 bg-cyan-200 rounded-md text-cyan-900 font-bold"
        onClick={() => handleUpdate(address)}
      >
      Set Controller
    </button>
  </div>
}

function MinaAppOracle({ oracle, handleUpdate }: { oracle: string, handleUpdate: Function }) {
  const [address, setAddress] = useState(oracle);

  return <div>
    <input
      className="w-full px-4 py-2 rounded-md border-2"
      placeholder="Oracle Key"
      onChange={(e) => setAddress(e.target.value)}
    />
    <button
        className="my-2 px-4 py-2 bg-cyan-200 rounded-md text-cyan-900 font-bold"
        onClick={() => handleUpdate(address)}
      >
      Set Oracle
    </button>
  </div>
}

function MinaApp({
  client,
  appPublicKey,
}: {
  client: ZkappWorkerClient;
  appPublicKey: PublicKey;
}) {
  const [appState, setAppState] = useState({
    currentState: null as null | any,
    creatingTransaction: false,
  });

  const [contractReady, setContractReady] = useState(false);

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

    if (currentState) {
      const { trustedOracle, owner } = currentState;

      PublicKey.fromBase58(trustedOracle).isEmpty().toJSON() &&
        delete currentState.trustedOracle;
      PublicKey.fromBase58(owner).isEmpty().toJSON() &&
        delete currentState.owner;
    }

    setAppState({
      currentState,
      creatingTransaction: false,
    });
  }

  async function handleControllerUpdate(_address: string) {
    // const address = getAddress(_address);

    const message = Encoding.stringToFields(_address);

    (window as any).mina.signMessage({ message: _address }).then(console.log);
  }

  if (!appState.currentState) {
    return <p>Loading</p>;
  }

  return (
    <div>
      <ul>
        <li className="my-2">
          <span className="text-gray-400 text-sm block">Owner</span>
          {appState.currentState.owner || "Not Set"}
        </li>
        <li className="my-2">
          <span className="text-gray-400 text-sm block">Google ID</span>
          {appState.currentState.googleId}
        </li>
        <li className="my-2">
          <span className="text-gray-400 text-sm block">Controller</span>
          <MinaAppController controller={appState.currentState.controller} handleUpdate={handleControllerUpdate}/>
        </li>
        <li className="my-2">
          <span className="text-gray-400 text-sm block">Trusted Oracle</span>
          <MinaAppOracle oracle={appState.currentState.trustedOracle} handleUpdate={handleControllerUpdate}/>
        </li>
      </ul>
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

  useEffect(() => {
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
        console.log("SnarkyJS Loaded and net set to Berkeley");
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
            appPublicKey={PublicKey.fromBase58(
              "B62qpHfzjb8tMe8nqk5WMmYq9ZCVsP882UuzjrBhjWTiizAMdXEBi17"
            )}
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
