import { forwardRef, useImperativeHandle, useRef } from 'react';
import WebView from 'react-native-webview/lib/WebView.ios';
import type { YoutubeWebViewHandle, YoutubeWebViewProps } from './YoutubeWebView.types';

const YoutubeWebView = forwardRef<YoutubeWebViewHandle, YoutubeWebViewProps>(function YoutubeWebView(props, ref) {
  const nativeRef = useRef<unknown>(null);
  useImperativeHandle(ref, () => ({
    injectJavaScript(script) {
      const current = nativeRef.current;
      if (typeof current === 'object' && current !== null && 'injectJavaScript' in current) {
        const inject = current.injectJavaScript;
        if (typeof inject === 'function') inject.call(current, script);
      }
    },
  }), []);
  return (
    <WebView
      ref={nativeRef}
      source={props.source}
      originWhitelist={props.originWhitelist}
      onMessage={props.onMessage}
      onError={props.onError}
      javaScriptEnabled
      allowsInlineMediaPlayback
      mediaPlaybackRequiresUserAction={false}
      style={{ flex: 1, backgroundColor: '#000000' }}
    />
  );
});

export default YoutubeWebView;
