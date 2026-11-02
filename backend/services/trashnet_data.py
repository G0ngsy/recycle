import hashlib
import json
import random
import shutil
from collections import Counter, defaultdict
from pathlib import Path

from PIL import Image, ImageOps

from services.material_model import CLASSES


def prepare_dataset(source: Path, destination: Path, seed: int = 42, reviewed_groups: Path | None = None) -> dict:
    source = source.resolve()
    destination = destination.resolve()
    if source == destination or source in destination.parents or destination in source.parents:
        raise ValueError("Source and destination must be separate directories")
    if destination.exists() and any(destination.iterdir()):
        raise ValueError("Destination must be empty; choose a new output directory")
    groups = defaultdict(list)
    invalid = []
    for class_name in CLASSES:
        folder = source / class_name
        if not folder.is_dir():
            raise ValueError(f"Missing class folder: {class_name}")
        for path in sorted(folder.iterdir()):
            if not path.is_file() or path.suffix.lower() not in {".jpg", ".jpeg", ".png"}:
                continue
            try:
                with Image.open(path) as original:
                    original.load()
                    image = ImageOps.exif_transpose(original).convert("RGB")
                    digest = hashlib.sha256(str(image.size).encode() + image.tobytes()).hexdigest()
                groups[digest].append((class_name, path))
            except Exception:
                invalid.append(str(path))
    conflicts = [digest for digest, members in groups.items() if len({name for name, _ in members}) > 1]
    conflict_records = [{"sha256": digest, "files": [str(path) for _, path in groups[digest]]} for digest in conflicts]
    review = json.loads(reviewed_groups.read_text(encoding="utf-8")) if reviewed_groups else {"groups": []}
    by_path = {path.relative_to(source).as_posix(): (digest, name) for digest, members in groups.items() for name, path in members}
    roots = {digest: digest for digest in groups if digest not in conflicts}

    def root(digest):
        while roots[digest] != digest:
            roots[digest] = roots[roots[digest]]
            digest = roots[digest]
        return digest

    for group in review["groups"]:
        files, hashes = group["files"], group["sha256"]
        if len(files) < 2 or len(files) != len(hashes) or any(path not in by_path for path in files):
            raise ValueError("Invalid reviewed duplicate group")
        entries = [by_path[path] for path in files]
        if [digest for digest, _ in entries] != hashes or any(digest in conflicts for digest, _ in entries):
            raise ValueError("Reviewed images changed or have conflicting labels")
        if len({name for _, name in entries}) != 1:
            raise ValueError("Reviewed groups cannot merge different classes")
        for digest, _ in entries[1:]:
            roots[root(digest)] = root(entries[0][0])
    merged = defaultdict(list)
    for digest, members in groups.items():
        if digest not in conflicts:
            merged[root(digest)].extend(members)
    by_class = defaultdict(list)
    for members in merged.values():
        members.sort(key=lambda entry: str(entry[1]))
        digest = by_path[members[0][1].relative_to(source).as_posix()][0]
        by_class[members[0][0]].append((digest, members))
    if any(len(by_class[name]) < 7 for name in CLASSES):
        raise ValueError("Each class requires at least seven unique images")
    destination.mkdir(parents=True, exist_ok=True)
    generator = random.Random(seed)
    records = []
    duplicates = []
    for class_name in CLASSES:
        unique = sorted(by_class[class_name])
        generator.shuffle(unique)
        train_end = int(len(unique) * 0.70)
        val_end = train_end + int(len(unique) * 0.15)
        for index, (digest, members) in enumerate(unique):
            split = "train" if index < train_end else "val" if index < val_end else "test"
            relative = Path(split) / class_name / members[0][1].name
            target = destination / relative
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(members[0][1], target)
            records.append({"path": relative.as_posix(), "className": class_name, "split": split, "sha256": digest})
            if len(members) > 1:
                duplicates.append({"sha256": digest, "split": split, "files": [str(path) for _, path in members]})
    manifest = {
        "seed": seed, "classes": list(CLASSES), "source": str(source),
        "records": records, "duplicates": duplicates, "invalid": invalid,
        "conflictingDuplicates": conflict_records,
        "reviewedNearDuplicateGroups": review["groups"],
        "counts": {split: dict(Counter(row["className"] for row in records if row["split"] == split)) for split in ("train", "val", "test")},
        "sourceImageCount": sum(len(members) for members in groups.values()),
    }
    (destination / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    return manifest


def classification_metrics(targets: list[int], predictions: list[int]) -> dict:
    matrix = [[0] * len(CLASSES) for _ in CLASSES]
    for target, prediction in zip(targets, predictions, strict=True):
        matrix[target][prediction] += 1
    per_class = {}
    for index, class_name in enumerate(CLASSES):
        true_positive = matrix[index][index]
        support = sum(matrix[index])
        predicted = sum(row[index] for row in matrix)
        precision = true_positive / predicted if predicted else 0
        recall = true_positive / support if support else 0
        per_class[class_name] = {"precision": precision, "recall": recall, "f1": 2 * precision * recall / (precision + recall) if precision + recall else 0, "support": support}
    return {
        "accuracy": sum(matrix[index][index] for index in range(len(CLASSES))) / len(targets) if targets else 0,
        "macroF1": sum(values["f1"] for values in per_class.values()) / len(CLASSES),
        "perClass": per_class, "confusionMatrix": matrix, "classes": list(CLASSES),
    }


def select_thresholds(targets: list[int], scores: list[list[float]], precision_target: float = 0.9, min_support: int = 10) -> dict:
    predictions = [max(range(len(CLASSES)), key=lambda index: row[index]) for row in scores]
    thresholds = {}
    for index, class_name in enumerate(CLASSES):
        candidates = sorted({row[index] for row, predicted in zip(scores, predictions, strict=True) if predicted == index})
        thresholds[class_name] = None
        for threshold in candidates:
            selected = [target for target, row, predicted in zip(targets, scores, predictions, strict=True) if predicted == index and row[index] >= threshold]
            if len(selected) >= min_support and sum(target == index for target in selected) / len(selected) >= precision_target:
                thresholds[class_name] = threshold
                break
    return thresholds
