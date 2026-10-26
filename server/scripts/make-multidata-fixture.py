import enum
import pickle
import sys
import types
import typing
import zlib

net_utils = types.ModuleType("NetUtils")
sys.modules["NetUtils"] = net_utils


class SlotType(enum.IntFlag):
    spectator = 0b00
    player = 0b01
    group = 0b10


class HintStatus(enum.IntEnum):
    HINT_UNSPECIFIED = 0
    HINT_NO_PRIORITY = 10
    HINT_AVOID = 20
    HINT_PRIORITY = 30
    HINT_FOUND = 40


class NetworkSlot(typing.NamedTuple):
    name: str
    game: str
    type: SlotType
    group_members: typing.Union[typing.List[int], typing.Tuple] = ()


class Hint(typing.NamedTuple):
    receiving_player: int
    finding_player: int
    location: int
    item: int
    found: bool
    entrance: str = ""
    item_flags: int = 0
    status: HintStatus = HintStatus.HINT_UNSPECIFIED


for exported in (SlotType, HintStatus, NetworkSlot, Hint):
    exported.__module__ = "NetUtils"
    exported.__qualname__ = exported.__name__
    setattr(net_utils, exported.__name__, exported)

PLAYERS = {
    1: ("Locker", "SlotLock"),
    2: ("Alice", "A Link to the Past"),
    3: ("Bob", "Hollow Knight"),
    4: ("Carol", "Celeste"),
    5: ("Dave", "Factorio"),
    6: ("Locker2", "SlotLock"),
}

DATAPACKAGE = {
    "SlotLock": {
        "checksum": "slotlockchecksum0001",
        "item_name_to_id": {
            "Unlock Locker": 1002,
            "Unlock Alice": 1003,
            "Unlock Bob": 1004,
            "Unlock Carol": 1005,
            "Unlock Dave": 1006,
            "Unlock Locker2": 1007,
            "Nothing": 6999,
            "Unlock Bonus Slot 1": 1,
        },
        "location_name_to_id": {"Free Item Alice 1": 10020, "Free Item Bob 1": 10021, "Free Item Carol 1": 10030},
    },
    "A Link to the Past": {
        "checksum": "alttpchecksum0001",
        "item_name_to_id": {"Hookshot": 42, "Rupees (20)": 43, "Bomb Trap": 44},
        "location_name_to_id": {
            "Link's House": 1,
            "Sanctuary": 2,
            "Kakariko Well (Top)": 3,
            "Aginah's Cave": 20002,
            "Blind's Hideout (Top)": 30001,
        },
    },
    "Hollow Knight": {
        "checksum": "hkchecksum0001",
        "item_name_to_id": {"Mothwing_Cloak": 500, "Geo_Rock-Default": 501},
        "location_name_to_id": {"Salubra_(Requires_Charms)": 77, "Mothwing_Cloak": 20001, "Crossroads_(Grub)": 3000000101},
    },
    "Celeste": {
        "checksum": "celestechecksum0001",
        "item_name_to_id": {"Strawberry": 600, "Dash Refill": 601},
        "location_name_to_id": {"Forsaken City: Strawberry 1": 20003, "Old Site: Strawberry 2": 201},
    },
    "Factorio": {
        "checksum": "factoriochecksum0001",
        "item_name_to_id": {"progressive-science-pack": 700, "Evolution Trap": 701},
        "location_name_to_id": {"Automate (1)": 20004, "Logistics (2)": 70301},
    },
}

LOCATIONS = {
    1: {10020: (42, 2, 1), 10021: (500, 3, 1)},
    2: {1: (500, 3, 1), 2: (43, 2, 0), 3: (44, 2, 4), 20002: (6999, 1, 0), 30001: (1005, 6, 1)},
    3: {77: (42, 2, 1), 20001: (1003, 1, 1), 3000000101: (501, 3, 0)},
    4: {20003: (1, 1, 0), 201: (600, 4, 2)},
    5: {20004: (1003, 1, 1), 70301: (701, 5, 4)},
    6: {10030: (600, 4, 2)},
}

SPHERES = [
    {1: {10020, 10021}, 2: {1, 2}, 3: {77}},
    {2: {3, 20002}, 3: {20001}, 6: {10030}},
    {2: {30001}, 4: {20003, 201}, 5: {20004}},
    {3: {3000000101}, 5: {70301}},
]


def multidata():
    return {
        "slot_data": {1: {"locked_slots": ["Alice", "Bob", "Carol", "Dave"]}, 6: {"locked_slots": ["Carol"]}},
        "slot_info": {number: NetworkSlot(name, game, SlotType.player) for number, (name, game) in PLAYERS.items()},
        "connect_names": {name: (0, number) for number, (name, _) in PLAYERS.items()},
        "locations": LOCATIONS,
        "checks_in_area": {2: {"Total": [1, 2, 3]}},
        "server_options": {"password": "room-secret", "server_password": "admin-secret", "hint_cost": 10},
        "er_hint_data": {},
        "precollected_items": {number: [] for number in PLAYERS},
        "precollected_hints": {
            number: {Hint(1, 3, 20001, 1003, False, "", 1, HintStatus.HINT_PRIORITY)} if number == 1 else set()
            for number in PLAYERS
        },
        "version": (0, 6, 8),
        "tags": ["AP"],
        "minimum_versions": {"server": (0, 5, 0), "clients": {}},
        "seed_name": "12345678901234567890",
        "spheres": SPHERES,
        "datapackage": DATAPACKAGE,
        "race_mode": 0,
    }


def item_link_multidata():
    data = multidata()
    data["slot_info"][7] = NetworkSlot("Link Group", "A Link to the Past", SlotType.group, [2])
    data["locations"][3][3000000102] = (43, 7, 0)
    return data


def other_room_multidata():
    data = multidata()
    data["slot_info"][2] = NetworkSlot("Alicia", "A Link to the Past", SlotType.player)
    return data


VARIANTS = {"big-chill": multidata, "item-link": item_link_multidata, "other-room": other_room_multidata}


def main():
    payload = zlib.compress(pickle.dumps(VARIANTS[sys.argv[2]](), protocol=4), 9)
    with open(sys.argv[1], "wb") as output:
        output.write(bytes([3]) + payload)


main()
