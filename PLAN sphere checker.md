# Sphere Checker – Feature List

Version: draft v1 (2026-10-25)
Language: ASD-STE100 (Simplified Technical English)

This file contains the feature list for a sphere checker. A friend of the developer wrote the list. This file contains only these features. "As in Archipolygo" means that the function works the same as in the project Archipolygo (`J:\dev\archipolygo-claude\archipolygo-claude`). Section 7 describes these functions of Archipolygo.

## Glossary

The terms of the glossary in `PLAN slotlock.md` also apply.

| Term | Meaning |
|---|---|
| sphere | A step in the calculation of Archipelago. All locations of a sphere are reachable with the items of the spheres before it. |
| location | A place in a slot that contains one item. |
| receiver | The slot that gets the item of a location. |
| item type | Progression, useful, normal or trap. |
| filler | Each item that is not progression: useful, normal and trap. |
| admin helper | A user who helps the admins of a room. |
| sphere clean-up | A request to the players to check the open locations of a sphere. |

## 1. Admin

1. Admin login.
2. Admin helper login.
3. Login to the Archipelago server (server login), as in Archipolygo.
4. Admin functions: the admin view and the functions of this section, for example send, release and collect. This item adds no other function.
5. Mark a location as filler.
6. Send an item or a location, as in Archipolygo.
7. Release and collect, as in Archipolygo.
8. Release of spheres. The admin selects the spheres. The admin is not limited to the active sphere (Spheretracker can release only the active sphere).

## 2. Sphere overview

1. The sphere overview shows for each sphere which item types are left.
2. Each item that is not progression counts as filler.
3. Exclude slots with reached goal. Items that slots with reached goal receive count as filler.

## 3. Sphere clean-up in Discord

1. The application pings the Discord users of the slots. The Discord user of a slot comes from Cheese.
2. The admin selects the Discord thread. Probably the share function of Discord does this.
3. Maximum 10 pings in one message (rule of the Discord server).
4. The message contains:
   - the sphere number, formatted as a Discord title with `#`,
   - one line for each slot: Discord name, slot name, number of progression items, number of filler items (useful, normal, traps).

Example:

```text
# Sphere 36
DiscordName1, SlotName1: 3 progression, 5 filler (2 useful, 3 normal, 0 traps)
DiscordName2, SlotName2: 1 progression, 2 filler (0 useful, 2 normal, 0 traps)
DiscordName3, SlotName3: 0 progression, 4 filler (1 useful, 2 normal, 1 trap)
```

## 4. Filters

1. Slots: a dropdown with "All", "Mine" and single slots. Possibly with a search field.
2. Item type: a dropdown with progression, useful, normal and trap.
3. Spheres: a slider for the sphere range, or input fields for the lowest and the highest sphere in the range.

## 5. Lists

### 5.1 Admin view

| Column | Content |
|---|---|
| Sphere | Sphere number |
| Slot name | Slot that contains the location |
| Discord name | Discord user of the slot |
| Receiver | Slot name of the receiver |
| Item | Item name |
| Game | Game of the slot |
| Type | Item type |
| Location | Location name |
| Mark as filler | Button |
| Send location | Button |

### 5.2 User view

| Column | Content |
|---|---|
| Sphere | Sphere number. Only up to the sphere that the admin permits. |
| Slot name | Slot that contains the location |
| Discord name | Discord user of the slot |
| Game | Game of the slot |
| Location | Location name |
| Mark as filler | Button. Only if the admin permits it. |

## 6. Pages

1. Admin settings.
2. User view.
3. Admin view.
4. Open locations (not collected).
5. Found locations (collected).
6. Marked as filler.

## 7. Functions of Archipolygo

This section describes how Archipolygo does the functions 1.3, 1.6 and 1.7. Sources: `README.md` (section "Admin view") and `AvaloniaApplication1/Services/AdminCommands.cs` of Archipolygo.

### 7.1 Server login

1. Archipolygo connects to the Archipelago server as a slot. Then it sends the chat line `!admin login <password>`.
2. The password is the admin password of the server (`server_password`).
3. On archipelago.gg, the room owner must first set this password in the command field of the room page: `/option server_password <password>`.
4. Archipolygo does not save the password.
5. The server logs out the admin when the connection changes or when another client logs in as admin. Archipolygo then logs in again automatically.
6. All players in the room see the admin commands in the chat. The server hides the passwords.

### 7.2 Commands

All commands are chat lines that start with `!admin `. Names with spaces are in quotation marks.

| Function | Command |
|---|---|
| Send an item | `!admin /send "<slot>" "<item>"` |
| Send an item more than one time | `!admin /send_multiple <amount> "<slot>" "<item>"` |
| Send a location, as if the slot checked it | `!admin /send_location "<slot>" "<location>"` |
| Release | `!admin /release <slot>` |
| Collect | `!admin /collect <slot>` |
| Log out | `!admin logout` |

Archipolygo asks for a confirmation before a release and before a collect.

## 8. Decisions

The developer decided these points on 2026-10-26.

| Topic | Decision |
|---|---|
| Place | The sphere checker is a part of SlotLockCheck. It uses the same rooms, the same Discord login and the same Cheese data. |
| Data source | An admin uploads the multidata file `AP_<seed>.archipelago` or the ZIP file of the generation that contains it. It gives the spheres, the items and the item types. |
| Admin password (`server_password`) | The server keeps the password only in memory for the current session. It does not write it to the disk. After a restart of the server, the admin enters it again. |
| Slot for the server login | The server connects as the selected SlotLock slot of the room. Then it sends `!admin login`. |
| Admin helper | An admin helper can see the admin view and can mark locations as filler and remove the marks. An admin helper cannot send items or locations and cannot release or collect. |
| Admin commands in the chat | All players see the admin commands in the chat. A release of a sphere sends one `/send_location` for each location. This is acceptable. |
| Release of spheres | The admin selects in the dialog: all open locations, only filler, or only locations that are marked as filler. |
| Exclude slots with reached goal | A switch. |
| Mark as filler | If the admin permits it, a player can mark only the locations of the own slots. |
| Discord message | The application makes the text. The admin copies it with a button and posts it in Discord. No webhook. |
| Pings | Maximum 10 pings in one message. If there are more, the application splits the text into more messages. A Discord user with more than one slot gets only one ping. |
| Slots in the Discord message | The admin selects: all slots with open locations, or only slots with open progression. |
| Sphere limit for players | The lowest sphere with open locations, plus an optional number that the admin sets. Example: the lowest sphere with open locations is 32, the admin sets "+2". Players see the spheres 32, 33 and 34. |
| Visitors | Room setting: the admin selects if visitors without login can see the user view. |
| Pages "Found locations" and "Marked as filler" | Players see both pages with the columns of the user view (5.2). |
