"""Build dark/light Microi technical or enterprise deck PDFs from browser captures.

The browser capture folders are intentionally temporary. The automated browser
captures the deterministic presentation surface at its native 1600x900 size.
This script creates exact 16:9 4K, high-quality 4:4:4 JPEG masters and embeds
one master per PDF page.
"""

from __future__ import annotations

import gc
import argparse
import hashlib
import re
import time
from pathlib import Path

from PIL import Image
from pypdf import PdfReader, PdfWriter
from reportlab import rl_config
from reportlab.pdfgen import canvas


PROJECT_ROOT = Path(__file__).resolve().parents[1]
WORKSPACE_ROOT = PROJECT_ROOT.parent
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--edition", choices=("technical", "enterprise"), default="technical")
parser.add_argument("--capture-root", type=Path)
# 大文件先写入忽略目录；发布者核验 CDN 字节后更新下载清单，不再写回 Git 跟踪目录。
parser.add_argument("--output-root", type=Path, default=WORKSPACE_ROOT / ".tmp" / "training-deck-downloads" / "pdf")
arguments = parser.parse_args()
EDITION = arguments.edition
# 两套课件隔离截图、缩略图与下载文件，企业版更新不能重写技术版现有资产。
default_capture_root = (
    WORKSPACE_ROOT / ".tmp" / "training-deck-pdf" / "enterprise"
    if EDITION == "enterprise"
    else WORKSPACE_ROOT / ".tmp" / "training-deck" / "pdfs"
)
TEMP_ROOT = (arguments.capture_root or default_capture_root).resolve()
thumbnail_directory = "training-deck-enterprise" if EDITION == "enterprise" else "training-deck"
THUMBNAIL_ROOTS = {
    "dark": PROJECT_ROOT / "docs" / "public" / "images" / thumbnail_directory / "thumbs",
    "light": PROJECT_ROOT / "docs" / "public" / "images" / thumbnail_directory / "thumbs-light",
}
OUTPUT_ROOT = arguments.output_root.resolve()
if EDITION == "enterprise":
    slide_source = PROJECT_ROOT / "docs/.vitepress/theme/enterprise-training-slides.js"
    slide_count_pattern = r"(?:export\s+)?const\s+enterpriseSlideCount\s*=\s*(\d+)"
    PDF_BASENAME = "microi-enterprise-application-training-syllabus"
    PDF_TITLE = "Microi吾码企业应用培训大纲"
    PDF_SUBJECT = "企业应用与行业案例：业务价值、关键优势、AI交付、实施路径与效果评估"
else:
    slide_source = PROJECT_ROOT / "docs/.vitepress/theme/components/TrainingSyllabusDeck.vue"
    slide_count_pattern = r"const expectedSlideCount = (\d+)"
    PDF_BASENAME = "microi-ai-development-framework-training-syllabus"
    PDF_TITLE = "Microi吾码 AI 开发框架技术培训大纲"
    PDF_SUBJECT = "功能点培训：30+引擎、邮箱系统、AI数据分析、AI创作、服务器运维面板、MCP、全端交付与企业案例"
slide_count_match = re.search(slide_count_pattern, slide_source.read_text(encoding="utf-8"))
if slide_count_match is None:
    raise RuntimeError(f"{EDITION}: missing declared slide count in {slide_source}")
SLIDE_COUNT = int(slide_count_match.group(1))
if SLIDE_COUNT < 1:
    raise RuntimeError(f"{EDITION}: slide count must be positive")
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

    filename = f"{PDF_BASENAME}-{variant}.pdf"
    output_pdf = OUTPUT_ROOT / filename
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
        "/Title": f"{PDF_TITLE}（{label}）",
        "/Author": "Microi吾码",
        "/Subject": f"{SLIDE_COUNT}页{PDF_SUBJECT}",
        "/Creator": "Microi吾码官网预生成培训课件",
    })
    with output_pdf.open("wb") as stream:
        writer.write(stream)

    return {
        "edition": EDITION,
        "variant": variant,
        "pages": len(masters),
        "output_pdf": str(output_pdf),
        "bytes": output_pdf.stat().st_size,
        "sha256": sha256(output_pdf),
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
