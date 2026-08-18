// tweetnacl ships no types of its own and there's no @types/tweetnacl we can
// trust to match; this covers only the one function this project calls.
declare module 'tweetnacl' {
  export interface SignKeyPair {
    publicKey: Uint8Array;
    secretKey: Uint8Array;
  }

  const nacl: {
    sign: {
      detached: {
        verify(message: Uint8Array, signature: Uint8Array, publicKey: Uint8Array): boolean;
        (message: Uint8Array, secretKey: Uint8Array): Uint8Array;
      };
      keyPair(): SignKeyPair;
    };
  };

  export default nacl;
}
