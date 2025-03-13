import type { AuthConfig, WebAuthn } from './types';

import { APP_NAME } from '../../config';
import { randomBytes } from '../random';
import { pause } from '../schedulers';

declare global {
  interface AuthenticationExtensionsClientInputs {
    credBlob?: Uint8Array; // max 32 bytes
    getCredBlob?: boolean;
    hmacCreateSecret?: boolean;
    hmacGetSecret?: { salt1: Uint8Array }; // 32-byte random data
  }

  interface AuthenticationExtensionsClientOutputs {
    credBlob?: boolean;
    getCredBlob?: Uint8Array;
    hmacCreateSecret?: boolean;
    hmacGetSecret?: { output1: Uint8Array };
  }

  interface AuthenticatorResponse {
    getTransports?: () => AuthenticatorTransport[];
  }
}

export interface CredentialCreationResult {
  type: 'credBlob' | 'userHandle';
  password: {
    credBlob: string;
    userHandle: string;
  };
  credential: PublicKeyCredential;
}

enum PubkeyAlg {
  Ed25519 = -8,
  ES256 = -7,
  RS256 = -257,
}

const CREDENTIAL_SIZE = 32;
const RP_NAME = APP_NAME;
const USER_NAME = APP_NAME;
const PAUSE = 300;
const CREDENTIAL_TIMEOUT = 120000;

async function createCredential() {
  const rpId = window.location.hostname;

  const userHandle = randomBytes(CREDENTIAL_SIZE);
  const credBlob = randomBytes(CREDENTIAL_SIZE);

  const options: CredentialCreationOptions = {
    publicKey: {
      challenge: randomBytes(CREDENTIAL_SIZE),
      rp: {
        name: RP_NAME,
        id: rpId,
      },
      user: {
        id: userHandle,
        name: USER_NAME,
        displayName: RP_NAME,
      },
      pubKeyCredParams: [
        {
          type: 'public-key',
          alg: PubkeyAlg.ES256,
        },
        {
          type: 'public-key',
          alg: PubkeyAlg.RS256,
        },
        {
          type: 'public-key',
          alg: PubkeyAlg.Ed25519,
        },
      ],
      authenticatorSelection: {
        requireResidentKey: true,
        userVerification: 'preferred',
      },
      extensions: {
        credBlob,
        hmacCreateSecret: true,
      },
      timeout: CREDENTIAL_TIMEOUT,
      excludeCredentials: [],
    },
  };

  const credential = (await navigator.credentials.create(options)) as PublicKeyCredential;

  if (!credential) {
    throw new Error('Missing credential');
  }

  const extensions = credential.getClientExtensionResults();
  const type = extensions.credBlob ? 'credBlob' : 'userHandle';

  return {
    type,
    password: {
      credBlob: Buffer.from(credBlob).toString('hex'),
      userHandle: Buffer.from(userHandle).toString('hex'),
    },
    credential,
  } as CredentialCreationResult;
}

async function verify({ credential, password, type }: CredentialCreationResult) {
  await pause(PAUSE);

  const transports = credential.response
    && credential.response.getTransports
    && credential.response.getTransports();

  const credentialId = Buffer.from(credential.rawId).toString('hex');

  const options: CredentialRequestOptions = {
    publicKey: {
      challenge: randomBytes(CREDENTIAL_SIZE),
      allowCredentials: [
        {
          id: credential.rawId,
          type: 'public-key',
          transports,
        },
      ],
      userVerification: 'required',
      extensions: {
        getCredBlob: true,
      },
    },
  };

  const assertion = (await navigator.credentials.get(options)) as PublicKeyCredential;

  if (!assertion) {
    throw new Error('Missing authentication');
  }

  const response = assertion.response as AuthenticatorAssertionResponse;
  let result: string | undefined;
  switch (type) {
    case 'userHandle': {
      if (!response.userHandle) {
        throw new Error('Missing stored userHandle');
      }
      if (!Buffer.from(password.userHandle, 'hex').equals(Buffer.from(response.userHandle))) {
        throw new Error('Stored blob not equals passed blob');
      }
      result = password.userHandle;
      break;
    }
  }

  if (!result) {
    throw new Error('Missing stored blob');
  }

  const config: WebAuthn = {
    kind: 'webauthn',
    type,
    credentialId,
    transports,
  };

  return { config, password: result };
}

async function getPassword(config: AuthConfig) {
  if (config.kind !== 'webauthn') {
    throw new Error('Unexpected auth kind');
  }

  const { credentialId, transports, type } = config;

  const controller = new AbortController();
  const signal = controller.signal;

  const options: CredentialRequestOptions = {
    publicKey: {
      challenge: randomBytes(CREDENTIAL_SIZE),
      allowCredentials: [
        {
          id: Buffer.from(credentialId, 'hex'),
          type: 'public-key',
          transports,
        },
      ],
      userVerification: 'required',
      extensions: {
        getCredBlob: true,
      },
    },
    signal,
  };

  const assertion = (await navigator.credentials.get(options)) as PublicKeyCredential;

  if (signal.aborted) {
    throw new Error('Verification canceled');
  }

  const response = assertion.response as AuthenticatorAssertionResponse;

  const extensions = assertion.getClientExtensionResults();
  if (type === 'userHandle') {
    if (!response.userHandle) {
      throw new Error('missing userHandle');
    }
    return Buffer.from(response.userHandle).toString('hex');
  } else {
    return Buffer.from(extensions.getCredBlob ?? '').toString('hex');
  }
}

export default {
  createCredential,
  verify,
  getPassword,
};
