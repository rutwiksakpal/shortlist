declare module 'mammoth/mammoth.browser.js' {
  interface Message {
    type: 'warning' | 'error';
    message: string;
  }
  interface Result {
    value: string;
    messages: Message[];
  }
  interface ImageElement {
    contentType: string;
  }
  interface Options {
    convertImage?: unknown;
  }
  const mammoth: {
    extractRawText(input: { arrayBuffer: ArrayBuffer }): Promise<Result>;
    convertToHtml(input: { arrayBuffer: ArrayBuffer }, options?: Options): Promise<Result>;
    images: {
      imgElement(fn: (image: ImageElement) => Promise<{ src: string }>): unknown;
    };
  };
  export default mammoth;
}
