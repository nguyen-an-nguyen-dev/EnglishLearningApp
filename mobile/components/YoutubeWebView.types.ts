import type { WebViewMessageEvent } from 'react-native-webview/lib/WebViewTypes';

export interface YoutubeWebViewHandle {
  injectJavaScript(script: string): void;
}

export interface YoutubeWebViewProps {
  source: { html: string; baseUrl: string };
  originWhitelist: string[];
  onMessage: (event: WebViewMessageEvent) => void;
  onError: () => void;
}
