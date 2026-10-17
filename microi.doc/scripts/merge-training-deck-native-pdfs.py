"""Merge Chromium's one-page PDFs and verify searchable Chinese against the DOM."""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import unicodedata
from pathlib import Path

from pypdf import PdfReader, PdfWriter


def normalized(value: str) -> str:
    return re.sub(r"\s+", "", unicodedata.normalize("NFKC", value)).casefold()


def merge(manifest_path: Path) -> dict:
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    if manifest.get("schema") != "native-training-pdf.v1":
        raise ValueError("unsupported native training PDF manifest")
    slides = manifest["slides"]
    if not slides or len(slides) != manifest["expectedPageCount"]:
        raise ValueError("PDF page inventory does not match the selected slides")
    output_path = Path(manifest["outputPath"])
    workspace_root = Path(__file__).resolve().parents[2]
    temporary_root = (workspace_root / ".tmp").resolve()
    if not output_path.resolve().is_relative_to(temporary_root):
        raise ValueError("native PDF output must remain inside workspace .tmp")
    writer = PdfWriter()
    pages = []
    recompressed_images = 0
    for slide in slides:
        reader = PdfReader(slide["pdfPath"])
        if len(reader.pages) != 1:
            raise ValueError(f"slide {slide['index']}: expected exactly one native page")
        page = reader.pages[0]
        width, height = float(page.mediabox.width), float(page.mediabox.height)
        if abs(width / height - 16 / 9) > 0.001:
            raise ValueError(f"slide {slide['index']}: PDF aspect ratio is not 16:9")
        text = page.extract_text() or ""
        extracted = normalized(text)
        missing = [snippet for snippet in slide["snippets"] if normalized(snippet) not in extracted]
        if len(extracted) < 40 or missing:
            raise ValueError(f"slide {slide['index']}: searchable PDF text missing {missing[:8]}")
        writer.add_page(page)
        written_page = writer.pages[-1]
        gallery_images = [image for image in slide["images"] if image.get("gallery")]
        if len(written_page.images) < len(gallery_images):
            raise ValueError(f"slide {slide['index']}: screenshot image streams are missing")
        # Chromium 默认把屏幕背景和高清截图以巨大无损流写入 PDF。
        # 只重编码大型不透明 RGB 位图；原始像素尺寸、原生正文、矢量与透明图层保留。
        # PDF 场景允许缩略原图，90质量4:4:4使截图细字清晰同时降低下载体积。
        for image_index in range(len(written_page.images)):
            embedded = written_page.images[image_index]
            if embedded.indirect_reference is None:
                continue
            bitmap = embedded.image
            if bitmap is None or bitmap.mode != "RGB" or max(bitmap.size) < 800:
                continue
            embedded.replace(bitmap, quality=90, subsampling=0, optimize=True)
            recompressed_images += 1
        writer.add_outline_item(f"{slide['index']:02d} {slide['title']}", len(pages))
        pages.append({"index": slide["index"], "textCharacters": len(text), "images": len(slide["images"]),
                      "galleryImages": len(gallery_images), "embeddedImageObjects": len(written_page.images),
                      "verifiedTextNodes": len(slide["snippets"]), "width": width, "height": height})
    edition = "企业版介绍" if manifest["edition"] == "enterprise" else "技术架构培训"
    theme = "暗色" if manifest["theme"] == "dark" else "浅色"
    writer.add_metadata({"/Title": f"Microi吾码{edition}（{theme}）", "/Author": "Microi吾码",
                         "/Subject": f"{len(slides)}页原生文字课件；源码 SHA-256 {manifest['sourceSha256']}",
                         "/Creator": "Microi吾码官网原生PDF生成器"})
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("wb") as stream:
        writer.write(stream)
    # 重新打开最终文件，而不是用合并前的页面对象代表交付产物。
    final = PdfReader(output_path)
    if len(final.pages) != len(slides):
        raise ValueError("merged PDF page count mismatch")
    for slide, page in zip(slides, final.pages):
        extracted = normalized(page.extract_text() or "")
        if any(normalized(snippet) not in extracted for snippet in slide["snippets"]):
            raise ValueError(f"slide {slide['index']}: final PDF lost searchable text")
    result = {"edition": manifest["edition"], "theme": manifest["theme"], "pages": len(final.pages),
              "path": str(output_path), "bytes": output_path.stat().st_size,
              "sha256": hashlib.sha256(output_path.read_bytes()).hexdigest(), "nativeTextVerified": True,
              "imageCount": sum(page["images"] for page in pages),
              "galleryImageCount": sum(page["galleryImages"] for page in pages),
              "recompressedImages": recompressed_images, "pageEvidence": pages}
    output_path.with_suffix(".validation.json").write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    return result


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--manifest", type=Path, required=True)
    arguments = parser.parse_args()
    print(json.dumps(merge(arguments.manifest), ensure_ascii=False))
