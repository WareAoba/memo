import { isMessageKey, tr, type MessageKey } from '.';

/** Keep a stable key so errors already on screen follow language changes. */
export class LocalizedError extends Error {
  readonly messageKey?: MessageKey;
  constructor(keyOrMessage: string, options?: ErrorOptions) {
    super(isMessageKey(keyOrMessage) ? tr(keyOrMessage) : keyOrMessage, options);
    this.messageKey = isMessageKey(keyOrMessage) ? keyOrMessage : undefined;
  }
}
