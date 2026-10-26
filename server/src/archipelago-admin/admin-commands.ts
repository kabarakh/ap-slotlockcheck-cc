const PREFIX = '!admin ';

export function quote(value: string): string {
  return `"${value.replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`;
}

export const adminCommands = {
  login: (password: string): string => `${PREFIX}login ${password}`,
  logout: (): string => `${PREFIX}logout`,
  sendItem: (slot: string, item: string, amount: number): string =>
    amount === 1
      ? `${PREFIX}/send ${quote(slot)} ${quote(item)}`
      : `${PREFIX}/send_multiple ${amount} ${quote(slot)} ${quote(item)}`,
  sendLocation: (slot: string, location: string): string => `${PREFIX}/send_location ${quote(slot)} ${quote(location)}`,
  release: (slot: string): string => `${PREFIX}/release ${slot}`,
  collect: (slot: string): string => `${PREFIX}/collect ${slot}`,
};

export const LOGIN_SUCCESS_TEXT = 'login successful';
export const LOGIN_FAILURE_TEXT = 'password incorrect';
