import { DATA_CLEAR_GENERATION } from '../browser/dataClear';

// A content-free epoch distinguishes deliberate deletion from normal capture consumption.
export { DATA_CLEAR_GENERATION };

export async function broadcastDataClear(): Promise<string> {
  const generation = crypto.randomUUID();
  await chrome.storage.session.set({ [DATA_CLEAR_GENERATION]: generation });
  return generation;
}
