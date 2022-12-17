import { useEffect, useState } from "react";
import { PublicKey, Encoding, PrivateKey, Signature, Field } from "snarkyjs";
import { getAddress, isAddress } from "ethers/lib/utils";

import ContractABI from "../contracts/SampleAccounts.json";
import { JsonRpcProvider } from "@ethersproject/providers";
import { Contract, ethers } from "ethers";

import ZkappWorkerClient from "../zkApp/zkappWorkerClient";
import { Account } from "snarkyjs/dist/node/lib/fetch";
import { EthAddress } from "../../contracts/build/src/Accounts";
import { sign } from "crypto";


export default function Home() {
  const [state, setState] = useState({});

  useEffect(() => {
    const client = new ZkappWorkerClient();
    console.log("Loading SnarkyJS...");

    client
      .loadSnarkyJS()
      .then(() => {
        const searchParams = new URLSearchParams(window.location.search);

        const googleId = searchParams.get('google_id');
        const signatureR = searchParams.get('signature_r');
        const signatureS = searchParams.get('signature_s');
        const publicKey = searchParams.get('public_key');

        if (!googleId) { return; }

        setState({
          googleId,
          signature: {
            r: signatureR,
            s: signatureS,
          },
          publicKey
        })

        const signature = Signature.fromJSON({
          r: signatureR,
          s: signatureS
        });

        const verifyKey = PublicKey.fromBase58(publicKey as string);

        if (signature.verify(verifyKey, [Field(googleId as string)]).toJSON()) {
          window.alert('Signature Valid');
        }
      });

       
  }, []);

  
  return (
    <div>
      <h1>Check Signature</h1>
      <br/>
      { (state as any).googleId ? <ul>
        <li>GoogleId: {(state as any).googleId}</li>
        <li>signature.r: {(state as any).signature.r}</li>
        <li>signature.s: {(state as any).signature.s}</li>
        <li>PublicKey: {(state as any).publicKey}</li>
      </ul> : 'Checking Signature' }
    </div>
  );
}
