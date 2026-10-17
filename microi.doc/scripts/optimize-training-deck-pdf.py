"""把培训PDF转换成轻量视觉层和原字体不可见文字层，保留链接与书签。"""
from __future__ import annotations

import argparse
import hashlib
import io
import json
import os
from pathlib import Path
import sys
import tempfile
import time

import pikepdf
import pymupdf as fitz
from PIL import Image, ImageChops, ImageStat
from pypdf import PdfReader, PdfWriter
from pypdf.generic import (ArrayObject, ContentStream, DecodedStreamObject, DictionaryObject,
                          EncodedStreamObject, FloatObject, NameObject, NumberObject)

WORKSPACE_ROOT = Path(__file__).resolve().parents[2]
OPTIMIZER_PATH = Path(__file__).resolve()
TEXT_OPERATORS = {b"Tf", b"Tc", b"Tw", b"Tz", b"TL", b"Ts", b"Td", b"TD", b"Tm", b"T*", b"Tj", b"TJ", b"'", b'"'}


def text_identity(value: str) -> str:
    # 展开Form后阅读器换行策略可能不同；字符顺序与所有非空白字符必须逐一相同。
    return "".join(value.split())


def object_value(value):
    return value.get_object() if hasattr(value, "get_object") else value


def file_sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def assert_file_unchanged(path: Path, expected: str, label: str):
    if file_sha256(path) != expected:
        raise ValueError(f"生成过程中{label}发生变化")


def checked_output(source: Path, target: Path, workspace_root: Path = WORKSPACE_ROOT) -> Path:
    source = source.resolve(strict=True)
    target = target.absolute()
    temporary_root = (workspace_root / ".tmp").resolve()
    if target.suffix.lower() != ".pdf" or not target.resolve().is_relative_to(temporary_root):
        raise ValueError("输出PDF必须位于工作区 .tmp 内")
    if os.path.normcase(str(source)) == os.path.normcase(str(target.resolve())):
        raise ValueError("优化不能覆盖源PDF")
    cursor = target
    while cursor != workspace_root.parent:
        if cursor.is_symlink() or getattr(cursor, "is_junction", lambda: False)():
            raise ValueError("输出目录禁止符号链接或junction")
        if cursor == workspace_root:
            break
        cursor = cursor.parent
    if target.exists() or target.with_suffix(".validation.json").exists():
        raise FileExistsError("输出或验收记录已存在，请选择新的候选文件名")
    return target


def page_boundary(page) -> tuple[float, float]:
    box = page.mediabox
    if int(page.get("/Rotate", 0)) % 360 or float(page.get("/UserUnit", 1)) != 1:
        raise ValueError("当前优化器仅接受Rotate=0、UserUnit=1的既有课件")
    if abs(float(box.left)) > .001 or abs(float(box.bottom)) > .001:
        raise ValueError("当前优化器不接受带偏移的MediaBox")
    if any(abs(float(a) - float(b)) > .001 for a, b in zip(page.cropbox, box)):
        raise ValueError("当前优化器要求CropBox与MediaBox一致")
    if float(box.width) <= 0 or float(box.height) <= 0:
        raise ValueError("页面尺寸必须为正")
    return float(box.width), float(box.height)


def invisible_text_operations(page, reader: PdfReader, writer: PdfWriter):
    """按原执行次序展开文字Form；丢弃旧绘图、透明组和图片，不在上面简单盖一张图。"""
    fonts = DictionaryObject()
    font_names = {}
    sanitized = set()

    def register_font(reference):
        reference_object = object_value(reference)
        key = (getattr(reference, "idnum", id(reference_object)), getattr(reference, "generation", 0))
        if key not in font_names:
            alias = NameObject(f"/TextFont{len(font_names) + 1}")
            cloned = reference.clone(writer)
            cloned_font = object_value(cloned)
            # Type3在原课件中携带阴影位图。不可见文字只需字宽和ToUnicode，
            # 保留d0/d1指标，删除字形绘图，避免旧大图通过字体资源仍然可达。
            if cloned_font.get("/Subtype") == "/Type3" and key not in sanitized:
                char_procs = DictionaryObject()
                for name, procedure in object_value(reference_object.get("/CharProcs", {})).items():
                    operations = ContentStream(procedure, reader, forced_encoding="bytes").operations
                    metrics = [operation for operation in operations if operation[1] in {b"d0", b"d1"}]
                    if not metrics:
                        raise ValueError("Type3字形缺少可保留的d0/d1字宽指标")
                    stream = ContentStream(None, writer)
                    stream.operations = metrics[:1]
                    char_procs[name] = writer._add_object(stream)
                cloned_font[NameObject("/CharProcs")] = char_procs
                cloned_font.pop("/Resources", None)
                sanitized.add(key)
            fonts[alias] = cloned
            font_names[key] = alias
        return font_names[key]

    def visit(stream, resources, ancestors=()):
        resources = object_value(resources)
        output = []
        for operands, operator in ContentStream(stream, reader, forced_encoding="bytes").operations:
            if operator in {b"q", b"Q", b"cm"}:
                output.append((operands, operator))
            elif operator == b"BT":
                output.extend([(operands, operator), ([NumberObject(3)], b"Tr")])
            elif operator == b"ET":
                output.append((operands, operator))
            elif operator == b"Tr":
                output.append(([NumberObject(3)], b"Tr"))
            elif operator in TEXT_OPERATORS:
                if operator == b"Tf":
                    reference = object_value(resources.get("/Font", {})).get(operands[0])
                    if reference is None:
                        raise ValueError(f"文字字体资源缺失：{operands[0]}")
                    operands = [register_font(reference), operands[1]]
                output.append((operands, operator))
            elif operator == b"Do":
                reference = object_value(resources.get("/XObject", {})).get(operands[0])
                if reference is None:
                    raise ValueError("原始XObject引用缺失")
                form = object_value(reference)
                if form.get("/Subtype") != "/Form":
                    continue
                key = (getattr(reference, "idnum", id(form)), getattr(reference, "generation", 0))
                if key in ancestors or len(ancestors) >= 64:
                    raise ValueError("原始Form存在递归或超过64层")
                output.append(([], b"q"))
                matrix = form.get("/Matrix", [1, 0, 0, 1, 0, 0])
                output.append(([FloatObject(value) for value in matrix], b"cm"))
                output.extend(visit(form, form.get("/Resources", resources), (*ancestors, key)))
                output.append(([], b"Q"))
        return output

    operations = visit(page.get("/Contents"), page["/Resources"])
    return operations, fonts


def uri_links(reader: PdfReader):
    return [[(str(object_value(annotation.get("/A", {})).get("/URI")), tuple(round(float(number), 3) for number in annotation.get("/Rect", [])))
             for reference in page.get("/Annots", [])
             if (annotation := object_value(reference)).get("/Subtype") == "/Link"
             and object_value(annotation.get("/A", {})).get("/S") == "/URI"] for page in reader.pages]


def raster_rgb(page, width: int):
    scale = width / page.rect.width
    pixmap = page.get_pixmap(matrix=fitz.Matrix(scale, scale), colorspace=fitz.csRGB, alpha=False)
    bitmap = Image.frombytes("RGB", (pixmap.width, pixmap.height), pixmap.samples)
    del pixmap
    return bitmap


def optimize_pdf(source: Path, output: Path, *, visual_width: int = 2560, jpeg_quality: int = 88,
                 verify_width: int = 1024, max_mean_error: float = 4.0, workspace_root: Path = WORKSPACE_ROOT) -> dict:
    source = Path(source).resolve(strict=True)
    output = checked_output(source, Path(output), workspace_root)
    if not 800 <= visual_width <= 4096 or not 40 <= jpeg_quality <= 95 or not 400 <= verify_width <= 1600:
        raise ValueError("视觉宽度/验证宽度/JPEG质量超出受控范围")
    started = time.perf_counter()
    print(json.dumps({"stage": "optimizer-started", "pid": os.getpid(), "source": str(source), "output": str(output)}), file=sys.stderr, flush=True)
    source_hash = file_sha256(source)
    optimizer_hash = file_sha256(OPTIMIZER_PATH)
    reader = PdfReader(source)
    if reader.is_encrypted:
        raise ValueError("不支持加密PDF")
    if reader.trailer["/Root"].get("/AcroForm"):
        raise ValueError("不支持包含表单域的PDF")
    source_text = [page.extract_text() or "" for page in reader.pages]
    source_links = uri_links(reader)
    sizes = [page_boundary(page) for page in reader.pages]
    writer = PdfWriter()
    writer.clone_document_from_reader(reader)
    # 原tag树指向已删除的MCID，不能留下失效的可访问性标记。
    writer.root_object.pop("/StructTreeRoot", None)
    writer.root_object.pop("/MarkInfo", None)
    evidence = []
    output.parent.mkdir(parents=True, exist_ok=True)
    with fitz.open(source) as original, tempfile.TemporaryDirectory(prefix=f".{output.stem}-", dir=output.parent) as temporary:
        toc = original.get_toc()
        for index, (original_page, page, size) in enumerate(zip(reader.pages, writer.pages, sizes)):
            page_started = time.perf_counter()
            operations, fonts = invisible_text_operations(original_page, reader, writer)
            bitmap = raster_rgb(original[index], visual_width)
            encoded = io.BytesIO()
            bitmap.save(encoded, "JPEG", quality=jpeg_quality, subsampling=0, optimize=True)
            image_width, image_height = bitmap.size
            bitmap.close()
            image = EncodedStreamObject()
            image._data = encoded.getvalue()
            image.update({NameObject("/Type"): NameObject("/XObject"), NameObject("/Subtype"): NameObject("/Image"),
                          NameObject("/Width"): NumberObject(image_width), NameObject("/Height"): NumberObject(image_height),
                          NameObject("/ColorSpace"): NameObject("/DeviceRGB"), NameObject("/BitsPerComponent"): NumberObject(8),
                          NameObject("/Filter"): NameObject("/DCTDecode")})
            page[NameObject("/Resources")] = DictionaryObject({NameObject("/Font"): fonts,
                NameObject("/XObject"): DictionaryObject({NameObject("/Visual"): writer._add_object(image)})})
            content = ContentStream(None, writer)
            content.operations = [([], b"q"), ([FloatObject(size[0]), NumberObject(0), NumberObject(0), FloatObject(size[1]), NumberObject(0), NumberObject(0)], b"cm"),
                                  ([NameObject("/Visual")], b"Do"), ([], b"Q"), *operations]
            # ContentStream.operations是惰性序列；必须先序列化再压缩，
            # 直接flate_encode会压缩尚为空的底层_data而丢掉整个文字层。
            serialized = DecodedStreamObject()
            serialized.set_data(content.get_data())
            page[NameObject("/Contents")] = writer._add_object(serialized.flate_encode())
            if text_identity(page.extract_text() or "") != text_identity(source_text[index]):
                raise ValueError(f"第{index+1}页生成阶段已发现原生文字字符/顺序变化")
            evidence.append({"page": index + 1, "visualWidth": image_width, "visualHeight": image_height,
                             "jpegBytes": len(image._data), "textCharacters": len(source_text[index]),
                             "renderSeconds": round(time.perf_counter() - page_started, 4)})
            fitz.TOOLS.store_shrink(100)
            print(json.dumps({"stage": "page-authored", **evidence[-1]}), file=sys.stderr, flush=True)
        # 真正移除孤儿旧images/forms，而非仅把它们隐藏在新页面后面。
        writer.compress_identical_objects(remove_duplicates=True, remove_unreferenced=True)
        intermediate = Path(temporary) / "native-text.pdf"
        with intermediate.open("wb") as stream:
            writer.write(stream)
        candidate = Path(temporary) / "linearized.pdf"
        with pikepdf.open(intermediate) as pdf:
            pdf.save(candidate, linearize=True, object_stream_mode=pikepdf.ObjectStreamMode.disable,
                     compress_streams=True, recompress_flate=True)
        with pikepdf.open(candidate) as pdf:
            if not pdf.is_linearized or not pdf.check_linearization():
                raise ValueError("快速Web查看结构验收失败")
            forbidden = [obj for obj in pdf.objects if isinstance(obj, pikepdf.Dictionary)
                         and (obj.get("/Subtype") == "/Form" or obj.get("/SMask") is not None)]
            if forbidden:
                raise ValueError("旧Form/透明SMask仍然可达")
        final = PdfReader(candidate)
        if len(final.pages) != len(reader.pages) or uri_links(final) != source_links:
            raise ValueError("优化后页数或URI链接发生变化")
        with fitz.open(candidate) as optimized:
            if optimized.get_toc() != toc:
                raise ValueError("优化后书签发生变化")
            for index, page in enumerate(final.pages):
                actual = page.extract_text() or ""
                if text_identity(actual) != text_identity(source_text[index]):
                    raise ValueError(f"第{index+1}页原生文字字符/顺序发生变化")
                evidence[index]["rawTextIdentical"] = actual == source_text[index]
                resources = page["/Resources"]
                xobjects = object_value(resources.get("/XObject", {}))
                if len(xobjects) != 1 or "/Visual" not in xobjects:
                    raise ValueError("每页必须只有一幅轻量视觉图")
                operations = ContentStream(page["/Contents"], final).operations
                if any(operator == b"Tr" and list(operands) != [3] for operands, operator in operations):
                    raise ValueError("文字层不是不可见模式3")
                before, after = raster_rgb(original[index], verify_width), raster_rgb(optimized[index], verify_width)
                difference = ImageChops.difference(before, after)
                mean_error = sum(ImageStat.Stat(difference).mean) / 3
                evidence[index]["pixelMeanError"] = round(mean_error, 4)
                before.close(); after.close(); difference.close()
                if mean_error > max_mean_error:
                    raise ValueError(f"第{index+1}页视觉差异过大：{mean_error:.3f}")
                fitz.TOOLS.store_shrink(100)
        assert_file_unchanged(source, source_hash, "源PDF")
        assert_file_unchanged(OPTIMIZER_PATH, optimizer_hash, "优化器源码")
        checked_output(source, output, workspace_root)
        os.link(candidate, output)  # 排他提交，不能覆盖未知文件。
    result = {"source": str(source), "sourceSha256": source_hash,
              "optimizerSource": str(OPTIMIZER_PATH), "optimizerSha256": optimizer_hash, "path": str(output),
              "bytes": output.stat().st_size, "sha256": hashlib.sha256(output.read_bytes()).hexdigest(),
              "sourceBytes": source.stat().st_size, "pages": len(reader.pages), "bookmarks": len(toc),
              "uriLinks": sum(map(len, source_links)), "linearized": True, "nativeTextVerified": True,
              "visualWidth": visual_width, "jpegQuality": jpeg_quality, "jpegSubsampling": "4:4:4",
              "visualImages": len(reader.pages), "formObjects": 0, "softMasks": 0,
              "elapsedSeconds": round(time.perf_counter() - started, 3), "pageEvidence": evidence}
    with output.with_suffix(".validation.json").open("x", encoding="utf-8") as stream:
        json.dump(result, stream, ensure_ascii=False, indent=2)
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--visual-width", type=int, default=2560)
    parser.add_argument("--jpeg-quality", type=int, default=88)
    parser.add_argument("--verify-width", type=int, default=1024)
    options = parser.parse_args()
    result = optimize_pdf(options.input, options.output, visual_width=options.visual_width,
                          jpeg_quality=options.jpeg_quality, verify_width=options.verify_width)
    print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    main()
