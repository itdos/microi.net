"""Build the two pre-generated Microi training deck PDFs from browser captures.

The browser capture folders are intentionally temporary. The automated browser
captures the deterministic presentation surface at its native 1600x900 size.
This script creates exact 16:9 4K, high-quality 4:4:4 JPEG masters and embeds
one master per PDF page.
"""

from __future__ import annotations

import gc
import hashlib
import shutil
import time
from pathlib import Path

from PIL import Image
from pypdf import PdfReader, PdfWriter
from reportlab import rl_config
from reportlab.pdfgen import canvas


PROJECT_ROOT = Path(__file__).resolve().parents[1]
WORKSPACE_ROOT = PROJECT_ROOT.parent
TEMP_ROOT = PROJECT_ROOT / "tmp" / "pdfs"
PUBLIC_ROOT = PROJECT_ROOT / "docs" / "public" / "downloads"
THUMBNAIL_ROOTS = {
    "dark": PROJECT_ROOT / "docs" / "public" / "images" / "training-deck" / "thumbs",
    "light": PROJECT_ROOT / "docs" / "public" / "images" / "training-deck" / "thumbs-light",
}
OUTPUT_ROOT = WORKSPACE_ROOT / "output" / "pdf"
SLIDE_COUNT = 45
PAGE_SIZE = (960, 540)
CAPTURE_SIZE = (1600, 900)
MASTER_SIZE = (3840, 2160)
THUMBNAIL_SIZE = (320, 180)

# Binary JPEG streams avoid ReportLab's memory-heavy ASCII85 expansion. The
# image data remains the same 4K, 4:4:4, quality-95 master while peak memory is
# low enough for repeatable documentation releases on developer workstations.
rl_config.useA85 = 0


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def save_thumbnail(thumbnail: Image.Image, target: Path) -> None:
    """Write thumbnails atomically with a short retry for Windows file scanners."""
    staging_root = TEMP_ROOT / "thumbnails"
    staging_root.mkdir(parents=True, exist_ok=True)
    staging = staging_root / f"{target.parent.name}-{target.name}"
    last_error: OSError | None = None
    for attempt in range(6):
        try:
            thumbnail.save(staging, "WEBP", quality=84, method=6)
            staging.replace(target)
            return
        except OSError as error:
            last_error = error
            gc.collect()
            time.sleep(0.2 * (attempt + 1))
    raise RuntimeError(f"failed to replace thumbnail {target}") from last_error


def build_variant(variant: str, label: str) -> dict[str, object]:
    raw_dir = TEMP_ROOT / variant / "raw"
    image_dir = TEMP_ROOT / variant / "cropped"
    image_dir.mkdir(parents=True, exist_ok=True)
    PUBLIC_ROOT.mkdir(parents=True, exist_ok=True)
    OUTPUT_ROOT.mkdir(parents=True, exist_ok=True)
    thumbnail_root = THUMBNAIL_ROOTS[variant]
    thumbnail_root.mkdir(parents=True, exist_ok=True)

    raw_slides = [raw_dir / f"slide-{index:02d}.jpg" for index in range(1, SLIDE_COUNT + 1)]
    missing = [source.name for source in raw_slides if not source.exists()]
    if missing:
        raise RuntimeError(f"{variant}: missing source slides: {', '.join(missing)}")

    masters: list[Path] = []
    for index, source in enumerate(raw_slides, start=1):
        expected_name = f"slide-{index:02d}.jpg"
        if source.name != expected_name:
            raise RuntimeError(f"{variant}: expected {expected_name}, found {source.name}")

        with Image.open(source) as image:
            image = image.convert("RGB")
            if image.size != CAPTURE_SIZE:
                raise RuntimeError(
                    f"{source.name}: expected {CAPTURE_SIZE[0]}x{CAPTURE_SIZE[1]}, "
                    f"found {image.width}x{image.height}"
                )
            rendered = image.resize(MASTER_SIZE, Image.Resampling.LANCZOS)
            master = image_dir / f"slide-{index:02d}.jpg"
            rendered.save(
                master,
                "JPEG",
                quality=95,
                subsampling=0,
                optimize=True,
                progressive=False,
                dpi=(264, 264),
            )
            rendered.close()
            thumbnail = image.resize(THUMBNAIL_SIZE, Image.Resampling.LANCZOS)
            save_thumbnail(thumbnail, thumbnail_root / f"slide-{index:02d}.webp")
            thumbnail.close()
            masters.append(master)

    filename = f"microi-ai-development-framework-training-syllabus-{variant}.pdf"
    public_pdf = PUBLIC_ROOT / filename
    page_pdf_dir = TEMP_ROOT / variant / "pages"
    page_pdf_dir.mkdir(parents=True, exist_ok=True)
    page_pdfs: list[Path] = []
    for index, master in enumerate(masters, start=1):
        page_pdf = page_pdf_dir / f"slide-{index:02d}.pdf"
        page_canvas = canvas.Canvas(
            str(page_pdf),
            pagesize=PAGE_SIZE,
            pageCompression=1,
            invariant=False,
        )
        page_canvas.drawImage(
            str(master),
            0,
            0,
            width=PAGE_SIZE[0],
            height=PAGE_SIZE[1],
            preserveAspectRatio=False,
            mask="auto",
        )
        page_canvas.showPage()
        page_canvas.save()
        page_pdfs.append(page_pdf)
        del page_canvas
        gc.collect()

    writer = PdfWriter()
    for page_pdf in page_pdfs:
        reader = PdfReader(str(page_pdf))
        writer.add_page(reader.pages[0])
    writer.add_metadata({
        "/Title": f"Microi吾码 AI 开发框架技术培训大纲（{label}）",
        "/Author": "Microi吾码",
        "/Subject": "45页功能点培训：20+引擎、AI数据分析、AI创作、MCP、全端交付与企业案例",
        "/Creator": "Microi吾码官网预生成培训课件",
    })
    with public_pdf.open("wb") as stream:
        writer.write(stream)

    output_pdf = OUTPUT_ROOT / filename
    shutil.copy2(public_pdf, output_pdf)
    return {
        "variant": variant,
        "pages": len(masters),
        "public_pdf": str(public_pdf),
        "output_pdf": str(output_pdf),
        "bytes": public_pdf.stat().st_size,
        "sha256": sha256(public_pdf),
        "master_size": Image.open(masters[0]).size,
    }


def main() -> None:
    results = [
        build_variant("dark", "暗色版"),
        build_variant("light", "浅色版"),
    ]
    for thumbnail_root in THUMBNAIL_ROOTS.values():
        # 页数变动后只清理超出当前课件范围的旧缩略图，不能误删有效页面。
        for stale_thumbnail in thumbnail_root.glob("slide-*.webp"):
            try:
                index = int(stale_thumbnail.stem.rsplit("-", 1)[-1])
            except ValueError:
                continue
            if index > SLIDE_COUNT:
                stale_thumbnail.unlink()
    for result in results:
        print(result)


if __name__ == "__main__":
    main()
