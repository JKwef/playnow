type Listener = (account: string, remote: boolean) => void;
const listeners = new Set<Listener>();
export const subscribePickerChanges = (listener: Listener) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
export const signalPickerChange = (account: string, remote = false) => {
  for (const listener of listeners) listener(account, remote);
};
