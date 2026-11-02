"""Read-only data audit; similarity pairs are review candidates, not deletions."""
import argparse
import hashlib
import json
import sys
from collections import Counter, defaultdict
from datetime import date
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageOps, ImageStat
from scipy.fft import dctn

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from services.material_model import CLASSES, MODEL_DIR, build_model, evaluation_transform
from services.trashnet_data import classification_metrics
from services.waste_data import dataset

ROOT = Path(__file__).resolve().parents[1]


def fingerprints(path):
    with Image.open(path) as original:
        original.load()
        image = ImageOps.exif_transpose(original).convert("RGB")
        pixels = hashlib.sha256(str(image.size).encode() + image.tobytes()).hexdigest()
        gray = image.convert("L")
        reduced = np.asarray(gray.resize((32, 32), Image.Resampling.LANCZOS), dtype=float)
        coefficients = dctn(reduced, type=2, norm="ortho")[:8, :8].ravel()
        phash = sum(int(bit) << i for i, bit in enumerate(coefficients > np.median(coefficients[1:])))
        diff = np.asarray(gray.resize((9, 8), Image.Resampling.LANCZOS), dtype=int)
        dhash = sum(int(bit) << i for i, bit in enumerate((diff[:, 1:] > diff[:, :-1]).ravel()))
    return pixels, phash, dhash


def image_audit(source, prepared, model_dir):
    manifest_bytes = (prepared / "manifest.json").read_bytes()
    manifest = json.loads(manifest_bytes)
    prepared_hashes = defaultdict(list)
    mismatch, missing = [], []
    for row in manifest["records"]:
        path = prepared / row["path"]
        if not path.is_file():
            missing.append(row["path"])
            continue
        digest, _, _ = fingerprints(path)
        prepared_hashes[digest].append(row)
        if digest != row["sha256"]:
            mismatch.append(row["path"])
    expected = {row["path"] for row in manifest["records"]}
    actual = {path.relative_to(prepared).as_posix() for path in prepared.rglob("*") if path.suffix.lower() in {".png", ".jpg", ".jpeg"}}
    by_hash = defaultdict(list)
    valid, invalid = [], []
    split_by_hash = {row["sha256"]: row["split"] for row in manifest["records"]}
    reviewed_leakage = []
    for group in manifest.get("reviewedNearDuplicateGroups", []):
        splits = {split_by_hash[digest] for digest in group["sha256"] if digest in split_by_hash}
        if len(splits) > 1:
            reviewed_leakage.append(group["files"])
        elif splits:
            for digest in group["sha256"]:
                split_by_hash[digest] = next(iter(splits))
    for class_name in CLASSES:
        for path in sorted((source / class_name).iterdir()):
            if not path.is_file() or path.suffix.lower() not in {".png", ".jpg", ".jpeg"}:
                continue
            try:
                digest, phash, dhash = fingerprints(path)
                row = {"path": path.relative_to(source).as_posix(), "className": class_name, "sha256": digest,
                       "split": split_by_hash.get(digest, "excluded"), "phash": phash, "dhash": dhash}
                valid.append(row)
                by_hash[digest].append(row)
            except Exception as error:
                invalid.append({"path": str(path), "error": type(error).__name__})
    pairs = []
    for i, left in enumerate(valid):
        for right in valid[i + 1:]:
            if left["sha256"] == right["sha256"]:
                continue
            pd = (left["phash"] ^ right["phash"]).bit_count()
            if pd > 4:
                continue
            dd = (left["dhash"] ^ right["dhash"]).bit_count()
            if dd <= 8:
                pairs.append({"left": left["path"], "right": right["path"], "phashDistance": pd, "dhashDistance": dd,
                              "crossSplit": left["split"] != right["split"] and "excluded" not in (left["split"], right["split"]),
                              "splits": [left["split"], right["split"]], "crossClass": left["className"] != right["className"]})
    pairs.sort(key=lambda pair: (pair["phashDistance"], pair["dhashDistance"], pair["left"], pair["right"]))
    metadata = json.loads((model_dir / "metadata.json").read_text(encoding="utf-8"))
    return {
        "sourceImageCount": len(valid) + len(invalid), "sourceClasses": dict(Counter(row["className"] for row in valid)),
        "invalid": invalid, "exactDuplicateGroups": [[row["path"] for row in members] for members in by_hash.values() if len(members) > 1],
        "preparedImageCount": len(expected), "missing": missing, "unexpected": sorted(actual - expected), "hashMismatch": mismatch,
        "preparedDuplicateGroups": [[row["path"] for row in members] for members in prepared_hashes.values() if len(members) > 1],
        "exactCrossSplitLeakage": [[row["path"] for row in members] for members in prepared_hashes.values() if len({row["split"] for row in members}) > 1],
        "modelManifestMatches": metadata["manifestSha256"] == hashlib.sha256(manifest_bytes).hexdigest(),
        "reviewedGroupCrossSplitLeakage": reviewed_leakage,
        "similarityMethod": "64-bit pHash distance <=4 AND dHash distance <=8; candidates require visual review; does not detect all same-object shots",
        "nearDuplicateCandidates": pairs, "nearDuplicateCrossSplitCandidates": sum(pair["crossSplit"] for pair in pairs),
    }


def contact_sheet(source, pairs, output):
    if not pairs:
        return
    # Preserve full images and display each candidate pair with paths and split.
    canvas = Image.new("RGB", (850, len(pairs) * 180), "white")
    draw = ImageDraw.Draw(canvas)
    for index, pair in enumerate(pairs):
        y = index * 180
        for side, key in enumerate(("left", "right")):
            with Image.open(source / pair[key]) as original:
                image = ImageOps.exif_transpose(original).convert("RGB")
                image.thumbnail((220, 140))
                canvas.paste(image, (side * 425 + 10, y + 28))
            draw.text((side * 425 + 10, y + 5), f'{index+1}: {pair[key]} [{pair["splits"][side]}]', fill="black")
        draw.text((245, y + 70), f'p={pair["phashDistance"]} d={pair["dhashDistance"]}', fill="black")
    canvas.save(output)


def regional_audit():
    rows = dataset()[0]
    ids = Counter(row["관리번호"] for row in rows)
    groups = defaultdict(list)
    for row in rows:
        key = tuple((key, value) for key, value in sorted(row.items()) if key != "관리번호")
        groups[key].append(row["관리번호"])
    dates = [date.fromisoformat(row["데이터기준일자"]) for row in rows]
    stale = [row["관리번호"] for row, stamp in zip(rows, dates) if (date.today() - stamp).days > 365]
    guideline = json.loads((ROOT / "data/recycling_guideline_pages.json").read_text(encoding="utf-8"))
    pdf_digest = hashlib.sha256((ROOT / "data/recycling_guideline_2018.pdf").read_bytes()).hexdigest()
    return {"records": len(rows), "duplicateManagementIds": [key for key, count in ids.items() if count > 1],
            "identicalRowsExceptId": [values for values in groups.values() if len(values) > 1],
            "oldestDate": min(dates).isoformat(), "newestDate": max(dates).isoformat(), "olderThan365Days": len(stale),
            "missingRecyclingDays": sum(row["재활용품배출요일"] in {"", "없음", "해당없음", "기타"} for row in rows),
            "guidelineMetadataKeys": list(guideline), "pdfSha256": pdf_digest,
            "guidelineHashMatches": pdf_digest == guideline["source_sha256"]}


def model_audit(prepared, model_dir):
    import torch
    torch.set_num_threads(4)
    model = build_model()
    model.load_state_dict(torch.load(model_dir / "model.pt", map_location="cpu", weights_only=True))
    model.eval()
    transform = evaluation_transform()
    metadata = json.loads((model_dir / "metadata.json").read_text(encoding="utf-8"))
    records = json.loads((prepared / "manifest.json").read_text(encoding="utf-8"))["records"]
    targets, scores = [], []
    records = [row for row in records if row["split"] == "test"]
    with torch.inference_mode():
        for start in range(0, len(records), 32):
            images = []
            for row in records[start:start+32]:
                with Image.open(prepared / row["path"]) as original:
                    images.append(transform(ImageOps.exif_transpose(original).convert("RGB")))
                    targets.append(CLASSES.index(row["className"]))
            scores.extend(model(torch.stack(images)).softmax(dim=1).tolist())
        predictions = [int(np.argmax(row)) for row in scores]
        accepted = defaultdict(list)
        for target, predicted, row in zip(targets, predictions, scores, strict=True):
            threshold = metadata["thresholds"][CLASSES[predicted]]
            if CLASSES[predicted] != "trash" and threshold is not None and row[predicted] >= threshold:
                accepted[CLASSES[predicted]].append(target == predicted)
        rng = np.random.default_rng(42)
        probes = [(f"solid-{color}", Image.new("RGB", (512, 512), color)) for color in ("white", "black", "gray", "green")]
        probes.append(("random-noise", Image.fromarray(rng.integers(0, 256, (512, 512, 3), dtype=np.uint8))))
        negatives = []
        for name, image in probes:
            row = model(transform(image).unsqueeze(0)).softmax(dim=1)[0].tolist()
            best = int(np.argmax(row))
            threshold = metadata["thresholds"][CLASSES[best]]
            rejected = max(ImageStat.Stat(image.resize((64, 64))).stddev) < 2
            negatives.append({"image": name, "predictedClass": CLASSES[best], "score": row[best],
                              "lowInformationRejected": rejected,
                              "requiresExtraConfirmation": rejected or CLASSES[best] == "trash" or threshold is None or row[best] < threshold})
    return {"test": classification_metrics(targets, predictions), "thresholdedTest": {name: {"accepted": len(accepted[name]),
            "correct": sum(accepted[name]), "precision": sum(accepted[name]) / len(accepted[name]) if accepted[name] else None} for name in CLASSES},
            "negativeProbes": negatives, "negativeProbeNote": "Synthetic stress tests only; not real-phone accuracy or representative OOD evaluation"}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, required=True)
    parser.add_argument("--prepared", type=Path, default=ROOT / "data/trashnet-reviewed-v2")
    parser.add_argument("--output", type=Path, default=ROOT / "test-results/data-audit.json")
    parser.add_argument("--evaluate", action="store_true")
    parser.add_argument("--model", type=Path, default=MODEL_DIR)
    args = parser.parse_args()
    report = {"auditDate": date.today().isoformat(), "images": image_audit(args.source, args.prepared, args.model), "regional": regional_audit()}
    if args.evaluate:
        report["model"] = model_audit(args.prepared, args.model)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    contact_sheet(args.source, report["images"]["nearDuplicateCandidates"], args.output.with_suffix(".jpg"))
    print(json.dumps({"report": str(args.output), "images": {key: value for key, value in report["images"].items() if key != "nearDuplicateCandidates"},
                      "regional": {key: value for key, value in report["regional"].items() if key != "identicalRowsExceptId"},
                      "regionalIdenticalGroups": len(report["regional"]["identicalRowsExceptId"]), "model": report.get("model")}, ensure_ascii=False))


if __name__ == "__main__":
    main()
