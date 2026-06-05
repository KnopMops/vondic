declare global {
  interface CryptoKeyPair {
    publicKey: CryptoKey;
    privateKey: CryptoKey;
  }

  // WebRTC types missing from react-native-webrtc typings
  interface RTCIceServer {
    urls: string | string[];
    username?: string;
    credential?: string;
  }

  interface RTCIceCandidateInit {
    candidate?: string;
    sdpMid?: string | null;
    sdpMLineIndex?: number | null;
    usernameFragment?: string | null;
  }

  interface RTCSessionDescriptionInit {
    type: RTCSdpType;
    sdp: string;
  }
}

export {};
