// Type definitions for @google/model-viewer custom element
import 'react';

declare module 'react/jsx-runtime' {
  namespace JSX {
    interface IntrinsicElements {
      'model-viewer': React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement>,
        HTMLElement
      > & {
        src?: string;
        alt?: string;
        'camera-controls'?: boolean;
        'touch-action'?: string;
        'auto-rotate'?: boolean;
        autoplay?: boolean;
        exposure?: string | number;
        poster?: string;
        loading?: string;
        reveal?: string;
        ar?: boolean;
      };
    }
  }
}

declare global {
  namespace JSX {
    interface IntrinsicElements {
      'model-viewer': React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement>,
        HTMLElement
      > & {
        src?: string;
        alt?: string;
        'camera-controls'?: boolean;
        'touch-action'?: string;
        'auto-rotate'?: boolean;
        autoplay?: boolean;
        exposure?: string | number;
        poster?: string;
        loading?: string;
        reveal?: string;
        ar?: boolean;
      };
    }
  }
}

export {};
