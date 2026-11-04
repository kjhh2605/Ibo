import {Capacitor, registerPlugin} from '@capacitor/core';

export interface AuthTokens {
  idToken: string;
  appCheckToken: string;
}

interface NativeAuth {
  getTokens(): Promise<AuthTokens>;
}

const nativeAuth = registerPlugin<NativeAuth>('SfAuth');

export async function getAuthTokens(): Promise<AuthTokens> {
  if (!Capacitor.isNativePlatform()) {
    throw new Error('Authenticated relay access requires Android.');
  }
  try {
    const tokens = await nativeAuth.getTokens();
    if (!tokens.idToken || !tokens.appCheckToken) throw new Error();
    return tokens;
  } catch {
    throw new Error('Authentication unavailable.');
  }
}
