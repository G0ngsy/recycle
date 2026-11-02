import argparse
import hashlib
import json
import random
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from services.material_model import CLASSES, MODEL_DIR, PREPROCESS, build_model, evaluation_transform
from services.trashnet_data import classification_metrics, select_thresholds


def main():
    import numpy as np
    import torch
    from PIL import Image, ImageOps
    from torch import nn
    from torch.utils.data import DataLoader
    from torchvision import datasets, transforms

    parser = argparse.ArgumentParser(description="Fine-tune MobileNetV3 Small on prepared TrashNet")
    parser.add_argument("--data", type=Path, default=Path(__file__).resolve().parents[1] / "data" / "trashnet-reviewed-v2")
    parser.add_argument("--output", type=Path, default=MODEL_DIR)
    parser.add_argument("--device", choices=("auto", "cpu", "cuda"), default="auto")
    parser.add_argument("--batch-size", type=int, default=32)
    parser.add_argument("--head-epochs", type=int, default=5)
    parser.add_argument("--finetune-epochs", type=int, default=20)
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()
    if args.batch_size < 1 or args.head_epochs < 1 or args.finetune_epochs < 1:
        parser.error("Batch size and epoch counts must be positive")
    if args.output.exists() and any(args.output.iterdir()):
        parser.error("Output must be empty; use a new directory for a new model version")
    random.seed(args.seed)
    np.random.seed(args.seed)
    torch.manual_seed(args.seed)
    torch.set_num_threads(4)
    torch.backends.cudnn.benchmark = False
    torch.backends.cudnn.deterministic = True
    device = "cuda" if args.device == "auto" and torch.cuda.is_available() else ("cpu" if args.device == "auto" else args.device)
    manifest_bytes = (args.data / "manifest.json").read_bytes()
    manifest = json.loads(manifest_bytes)
    if manifest["classes"] != list(CLASSES):
        raise ValueError("Unexpected classes in manifest")
    for record in manifest["records"]:
        with Image.open(args.data / record["path"]) as original:
            image = ImageOps.exif_transpose(original).convert("RGB")
            digest = hashlib.sha256(str(image.size).encode() + image.tobytes()).hexdigest()
        if digest != record["sha256"]:
            raise ValueError(f"Dataset changed: {record['path']}")
    augmentation = transforms.Compose([
        transforms.RandomResizedCrop(224, scale=(0.75, 1.0)), transforms.RandomHorizontalFlip(),
        transforms.RandomRotation(15), transforms.ColorJitter(brightness=0.2, contrast=0.2, saturation=0.1),
        transforms.ToTensor(), transforms.Normalize(PREPROCESS["mean"], PREPROCESS["std"]),
    ])
    def load_photo(path):
        with Image.open(path) as original:
            return ImageOps.exif_transpose(original).convert("RGB")

    dataset_map = {split: datasets.ImageFolder(args.data / split, loader=load_photo, transform=augmentation if split == "train" else evaluation_transform()) for split in ("train", "val", "test")}
    for split, dataset in dataset_map.items():
        if dataset.classes != list(CLASSES):
            raise ValueError(f"Unexpected classes in {split}")
        expected = {record["path"] for record in manifest["records"] if record["split"] == split}
        actual = {Path(path).relative_to(args.data).as_posix() for path, _ in dataset.samples}
        if expected != actual:
            raise ValueError(f"Files in {split} do not match the manifest")
    generator = torch.Generator().manual_seed(args.seed)
    loaders = {split: DataLoader(dataset, batch_size=args.batch_size, shuffle=split == "train", num_workers=0, generator=generator if split == "train" else None) for split, dataset in dataset_map.items()}
    counts = torch.bincount(torch.tensor(dataset_map["train"].targets), minlength=len(CLASSES)).float()
    criterion = nn.CrossEntropyLoss(weight=(counts.sum() / (len(CLASSES) * counts)).to(device))
    model = build_model(pretrained=True).to(device)
    args.output.mkdir(parents=True, exist_ok=True)
    best_score = -1.0
    best_epoch = None
    history = []

    def evaluate(split):
        model.eval()
        targets, scores = [], []
        with torch.inference_mode():
            for images, labels in loaders[split]:
                scores.extend(model(images.to(device)).softmax(dim=1).cpu().tolist())
                targets.extend(labels.tolist())
        predictions = [max(range(len(CLASSES)), key=lambda index: row[index]) for row in scores]
        return targets, scores, classification_metrics(targets, predictions)

    for phase, epochs, learning_rate in (("head", args.head_epochs, 1e-3), ("finetune", args.finetune_epochs, 1e-4)):
        for parameter in model.parameters():
            parameter.requires_grad = phase == "finetune"
        for parameter in model.classifier.parameters():
            parameter.requires_grad = True
        optimizer = torch.optim.AdamW([parameter for parameter in model.parameters() if parameter.requires_grad], lr=learning_rate, weight_decay=1e-4)
        stale = 0
        for epoch in range(epochs):
            model.train()
            if phase == "head":
                model.features.eval()
            total_loss = 0
            for images, labels in loaders["train"]:
                optimizer.zero_grad(set_to_none=True)
                loss = criterion(model(images.to(device)), labels.to(device))
                loss.backward()
                optimizer.step()
                total_loss += loss.item() * len(labels)
            _, _, metrics = evaluate("val")
            entry = {"phase": phase, "epoch": epoch + 1, "loss": total_loss / len(dataset_map["train"]), "validationMacroF1": metrics["macroF1"]}
            history.append(entry)
            print(json.dumps(entry), flush=True)
            if metrics["macroF1"] > best_score:
                best_score = metrics["macroF1"]
                best_epoch = {"phase": phase, "epoch": epoch + 1}
                torch.save({key: value.detach().cpu() for key, value in model.state_dict().items()}, args.output / "model.pt")
                stale = 0
            else:
                stale += 1
            if phase == "finetune" and stale >= 5:
                break
    model.load_state_dict(torch.load(args.output / "model.pt", map_location=device, weights_only=True))
    val_targets, val_scores, val_metrics = evaluate("val")
    thresholds = select_thresholds(val_targets, val_scores)
    test_targets, test_scores, test_metrics = evaluate("test")
    metadata = {
        "version": datetime.now(timezone.utc).strftime("trashnet-%Y%m%dT%H%M%SZ"),
        "architecture": "mobilenet_v3_small", "pretrainedWeights": "IMAGENET1K_V1",
        "classes": list(CLASSES), "preprocess": PREPROCESS, "thresholds": thresholds,
        "thresholdPolicy": {"precisionTarget": 0.9, "minimumValidationPredictions": 10},
        "experimental": True, "phoneEvaluation": "not_collected",
        "manifestSha256": hashlib.sha256(manifest_bytes).hexdigest(), "bestEpoch": best_epoch,
        "training": {"seed": args.seed, "batchSize": args.batch_size, "device": device, "headEpochs": args.head_epochs, "finetuneEpochs": args.finetune_epochs, "torch": str(torch.__version__)},
        "validation": val_metrics, "test": test_metrics,
    }
    (args.output / "metadata.json").write_text(json.dumps(metadata, ensure_ascii=False, indent=2), encoding="utf-8")
    report = {"history": history, "thresholds": thresholds, "validation": val_metrics, "test": test_metrics}
    (args.output / "evaluation.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({"model": str(args.output), "testAccuracy": test_metrics["accuracy"], "testMacroF1": test_metrics["macroF1"], "thresholds": thresholds}), flush=True)


if __name__ == "__main__":
    main()
