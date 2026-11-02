import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from services.trashnet_data import prepare_dataset


def main():
    parser = argparse.ArgumentParser(description="Validate and split TrashNet without changing the source")
    parser.add_argument("source", type=Path)
    parser.add_argument("--output", type=Path, default=Path(__file__).resolve().parents[1] / "data" / "trashnet")
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--reviewed-groups", type=Path, help="Visually reviewed groups with source pixel hashes")
    args = parser.parse_args()
    manifest = prepare_dataset(args.source, args.output, args.seed, args.reviewed_groups)
    print(json.dumps({"counts": manifest["counts"], "duplicateGroups": len(manifest["duplicates"]), "conflictingGroupsExcluded": len(manifest["conflictingDuplicates"]), "damagedImagesExcluded": len(manifest["invalid"]), "sourceImages": manifest["sourceImageCount"]}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
