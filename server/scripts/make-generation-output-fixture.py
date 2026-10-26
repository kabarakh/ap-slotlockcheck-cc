import sys
import zipfile

SEED = "12345678901234567890"


def write_zip(path, entries):
    with zipfile.ZipFile(path, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        for name, content in entries:
            info = zipfile.ZipInfo(name, date_time=(2026, 10, 26, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            archive.writestr(info, content)


def main():
    multidata_path, output_directory = sys.argv[1], sys.argv[2]
    with open(multidata_path, "rb") as source:
        multidata = source.read()
    spoiler = f"Archipelago Version 0.6.8  -  Seed: {SEED}\n".encode("utf-8")
    patch = bytes(range(256)) * 64
    write_zip(
        f"{output_directory}/generation-big-chill.zip",
        [
            (f"AP_{SEED}_Spoiler.txt", spoiler),
            (f"AP_{SEED}_P2_Alice.aplttp", patch),
            (f"AP_{SEED}.archipelago", multidata),
        ],
    )
    write_zip(f"{output_directory}/generation-without-multidata.zip", [(f"AP_{SEED}_Spoiler.txt", spoiler)])
    write_zip(
        f"{output_directory}/generation-two-multidata.zip",
        [(f"AP_{SEED}.archipelago", multidata), (f"copy/AP_{SEED}.archipelago", multidata)],
    )


main()
