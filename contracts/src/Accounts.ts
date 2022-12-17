import {
  Field,
  SmartContract,
  state,
  State,
  method,
  Struct,
  Encoding,
  PublicKey,
  Signature,
  DeployArgs,
  Permissions,
} from 'snarkyjs';

export class EthAddress extends Struct({ partOne: Field, partTwo: Field }) {
  static fromString(address: string) {
    const [partOne, partTwo] = Encoding.stringToFields(address);

    return new EthAddress({ partOne, partTwo });
  }

  toString() {
    if (this.partOne.isZero() || this.partTwo.isZero()) {
      return '0x';
    }

    return Encoding.stringFromFields([this.partOne, this.partTwo]);
  }

  toFields() {
    return [this.partOne, this.partTwo];
  }
}

export class Accounts extends SmartContract {
  @state(EthAddress) controller = State<EthAddress>();
  @state(Field) googleId = State<Field>();
  @state(PublicKey) trustedOracle = State<PublicKey>();
  @state(PublicKey) owner = State<PublicKey>();

  events = {
    'attach-contract': EthAddress,
  };

  deploy(args: DeployArgs) {
    super.deploy(args);

    this.setPermissions({
      ...Permissions.default(),
      editState: Permissions.proof(),
    });
  }

  init() {
    super.init();

    this.trustedOracle.set(PublicKey.empty());
    this.owner.set(PublicKey.empty());
  }

  @method setOwner(newOwner: PublicKey) {
    const owner = this.owner.get();
    this.owner.assertEquals(owner);

    // Make sure the owner property can only be set once
    owner.isEmpty().assertTrue();

    this.owner.set(newOwner);
  }

  // For simplicity, a trusted oracle can only be set once
  @method setTrustedOracle(newOracle: PublicKey, ownerSignature: Signature) {
    const owner = this.owner.get();
    this.owner.assertEquals(owner);

    const nonce = this.account.nonce.get();
    this.account.nonce.assertEquals(nonce);

    ownerSignature
      .verify(owner, newOracle.toFields().concat(nonce.toFields()))
      .assertTrue('Invalid owner signature');

    const oracle = this.trustedOracle.get();
    this.trustedOracle.assertEquals(oracle);

    this.trustedOracle.assertEquals(PublicKey.empty());
    newOracle.isEmpty().assertFalse();

    this.trustedOracle.set(newOracle);
    this.googleId.set(Field(0));

    // this.emitEvent('set-trusted-oracle', newOracle);
  }

  // Oracle must validate using google oauth flow, and then
  @method updateController(address: EthAddress, oracleSignature: Signature) {
    const currentController = this.controller.get();
    this.controller.assertEquals(currentController);

    const oracle = this.trustedOracle.get();
    this.trustedOracle.assertEquals(oracle);

    const nonce = this.account.nonce.get();
    this.account.nonce.assertEquals(nonce);

    oracleSignature
      .verify(
        oracle,
        address
          .toFields()
          .concat(currentController.toFields())
          .concat(nonce.toFields())
      )
      .assertTrue();

    this.controller.set(address);
  }

  @method setController(address: EthAddress, ownerSignature: Signature) {
    const owner = this.owner.get();
    this.owner.assertEquals(owner);

    ownerSignature.verify(owner, address.toFields()).assertTrue();

    this.controller.set(address);
  }

  // A google id can only be set by an oracle
  @method setGoogleId(googleId: Field, oracleSignature: Signature) {
    const trustedOracle = this.trustedOracle.get();
    this.trustedOracle.assertEquals(trustedOracle);

    oracleSignature
      .verify(trustedOracle, [googleId].concat(this.address.toFields()))
      .assertTrue();

    this.googleId.set(googleId);
  }
}
