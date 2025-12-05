declare namespace JSX {
  interface IntrinsicElements {
    'model-viewer': React.DetailedHTMLProps<
      React.HTMLAttributes<HTMLElement> & {
        src?: string;
        alt?: string;
        'auto-rotate'?: boolean;
        'camera-controls'?: boolean;
        'environment-image'?: string;
        'exposure'?: string;
        'shadow-intensity'?: string;
        'shadow-softness'?: string;
        style?: React.CSSProperties;
      },
      HTMLElement
    >;
  }
}
