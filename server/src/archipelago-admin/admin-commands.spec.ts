import { adminCommands, quote } from './admin-commands.js';
import { replyFromPacket } from './admin-connection.js';

describe('adminCommands', () => {
  it('quotes names with spaces, quotation marks and backslashes', () => {
    expect(quote('Link (HW)')).toBe('"Link (HW)"');
    expect(quote('Say "hi"')).toBe(String.raw`"Say \"hi\""`);
    expect(quote(String.raw`a\b`)).toBe(String.raw`"a\\b"`);
  });

  it('builds the same lines as Archipolygo', () => {
    expect(adminCommands.login('secret')).toBe('!admin login secret');
    expect(adminCommands.logout()).toBe('!admin logout');
    expect(adminCommands.sendItem('Bob', 'Mothwing Cloak', 1)).toBe('!admin /send "Bob" "Mothwing Cloak"');
    expect(adminCommands.sendItem('Bob', 'Geo', 3)).toBe('!admin /send_multiple 3 "Bob" "Geo"');
    expect(adminCommands.sendLocation('Davey', "Link's House")).toBe(`!admin /send_location "Davey" "Link's House"`);
    expect(adminCommands.release('Bob')).toBe('!admin /release Bob');
    expect(adminCommands.collect('Bob')).toBe('!admin /collect Bob');
  });
});

describe('replyFromPacket', () => {
  it('keeps only command answers as plain text', () => {
    expect(
      replyFromPacket({ cmd: 'PrintJSON', type: 'CommandResult', data: [{ text: 'Login ' }, { text: 'successful.' }] }),
    ).toEqual({ kind: 'CommandResult', text: 'Login successful.' });
    expect(
      replyFromPacket({ cmd: 'PrintJSON', type: 'AdminCommandResult', data: [{ text: 'Unknown location' }] }),
    ).toEqual({ kind: 'AdminCommandResult', text: 'Unknown location' });
    expect(
      replyFromPacket({ cmd: 'PrintJSON', type: 'Chat', team: 0, slot: 1, message: 'hi', data: [{ text: 'hi' }] }),
    ).toBeNull();
  });
});
