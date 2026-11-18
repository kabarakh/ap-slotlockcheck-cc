export const SLOT_NOTE_KINDS = ['public', 'internal'] as const;

export type SlotNoteKind = (typeof SLOT_NOTE_KINDS)[number];

export const SLOT_NOTE_MAX_LENGTH = 10_000;

export function isSlotNoteKind(value: string): value is SlotNoteKind {
  return (SLOT_NOTE_KINDS as readonly string[]).includes(value);
}

export interface StoredSlotNote {
  slotId: number;
  kind: string;
  text: string;
  updatedAt: Date;
  updatedBy: { name: string };
}

export interface SlotNoteView {
  text: string;
  updatedAt: string;
  updatedByName: string;
}

export function toSlotNoteView(note: StoredSlotNote): SlotNoteView {
  return { text: note.text, updatedAt: note.updatedAt.toISOString(), updatedByName: note.updatedBy.name };
}

export function notesOfKind(notes: StoredSlotNote[], kind: SlotNoteKind): Map<number, SlotNoteView> {
  return new Map(notes.filter((note) => note.kind === kind).map((note) => [note.slotId, toSlotNoteView(note)]));
}
