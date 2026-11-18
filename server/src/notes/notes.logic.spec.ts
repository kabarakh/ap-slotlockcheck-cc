import { isSlotNoteKind, notesOfKind } from './notes.logic.js';

describe('notes logic', () => {
  it('knows only the public and the internal kind', () => {
    expect(isSlotNoteKind('public')).toBe(true);
    expect(isSlotNoteKind('internal')).toBe(true);
    expect(isSlotNoteKind('player')).toBe(false);
  });

  it('selects the notes of one kind by slot', () => {
    const updatedAt = new Date('2026-11-18T12:00:00.000Z');
    const notes = notesOfKind(
      [
        { slotId: 1, kind: 'public', text: 'Visible', updatedAt, updatedBy: { name: 'Alice' } },
        { slotId: 1, kind: 'internal', text: 'Hidden', updatedAt, updatedBy: { name: 'Bob' } },
        { slotId: 2, kind: 'public', text: '', updatedAt, updatedBy: { name: 'Bob' } },
      ],
      'public',
    );
    expect([...notes.entries()]).toEqual([
      [1, { text: 'Visible', updatedAt: '2026-11-18T12:00:00.000Z', updatedByName: 'Alice' }],
      [2, { text: '', updatedAt: '2026-11-18T12:00:00.000Z', updatedByName: 'Bob' }],
    ]);
  });
});
