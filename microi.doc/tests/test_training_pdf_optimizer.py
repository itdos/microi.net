"""PDF优化行为回归：实际生成夹具并检查语义、结构和视觉，不只检查源码字符串。"""
import hashlib
import importlib.util
from pathlib import Path
import tempfile
import unittest
from unittest import mock

import pikepdf
from PIL import Image, ImageDraw
from pypdf import PdfReader, PdfWriter
from pypdf.generic import (ArrayObject, ContentStream, DecodedStreamObject, DictionaryObject,
                          NameObject, NumberObject)
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas

ROOT = Path(__file__).resolve().parents[2]
SPEC = importlib.util.spec_from_file_location("training_pdf_optimizer", ROOT / "microi.doc/scripts/optimize-training-deck-pdf.py")
optimizer = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(optimizer)


def pdf_stream(data):
    stream = DecodedStreamObject()
    stream.set_data(data)
    return stream


class TrainingPdfOptimizerTests(unittest.TestCase):
    def setUp(self):
        parent = ROOT / ".tmp/training-pdf-20261017/pipeline/tests"
        parent.mkdir(parents=True, exist_ok=True)
        self.temporary = tempfile.TemporaryDirectory(dir=parent)
        self.directory = Path(self.temporary.name)

    def tearDown(self):
        self.temporary.cleanup()

    def fixture(self):
        source = self.directory / "original.pdf"
        screenshot = Image.new("RGB", (900, 450), "#e2edf7")
        draw = ImageDraw.Draw(screenshot)
        for index in range(12):
            draw.rectangle((20, 15 + index * 32, 870, 35 + index * 32), fill=(20 + index * 12, 80, 160))
        transparent = Image.new("RGBA", (100, 100), (20, 150, 230, 110))
        document = canvas.Canvas(str(source), pagesize=(400, 225), pageCompression=1)
        for index in range(2):
            document.bookmarkPage(f"page-{index}")
            document.addOutlineEntry(f"Chapter {index + 1}", f"page-{index}")
            document.setFillColorRGB(.93, .96, .98)
            document.rect(0, 0, 400, 225, fill=1, stroke=0)
            document.drawImage(ImageReader(screenshot), 205, 90, 180, 90)
            document.drawImage(ImageReader(transparent), 340, 20, 35, 35, mask="auto")
            document.beginForm(f"form-{index}", 0, 0, 180, 50)
            document.setFont("Courier", 13)
            document.drawString(4, 14, f"Nested form {index + 1}")
            document.endForm()
            document.saveState()
            document.translate(20, 155)
            document.rotate(7)
            document.doForm(f"form-{index}")
            document.restoreState()
            document.setFont("Helvetica", 15)
            document.setFillColorRGB(.1, .15, .25)
            document.drawString(20, 105, f"Native visible text {index + 1}")
            document.linkURL("https://microi.net/doc/", (20, 20, 160, 40), relative=0, thickness=0)
            document.showPage()
        document.save()
        screenshot.close(); transparent.close()
        return source

    def test_real_output_keeps_text_links_bookmarks_and_removes_old_graphics(self):
        source = self.fixture()
        original_bytes = source.read_bytes()
        output = self.directory / "optimized.pdf"
        result = optimizer.optimize_pdf(source, output, visual_width=1280, verify_width=800)
        self.assertEqual(source.read_bytes(), original_bytes)
        self.assertEqual(result["pages"], 2)
        self.assertEqual(result["bookmarks"], 2)
        self.assertEqual(result["uriLinks"], 2)
        self.assertTrue(result["nativeTextVerified"])
        self.assertTrue(result["linearized"])
        self.assertEqual(result["optimizerSha256"], hashlib.sha256(optimizer.OPTIMIZER_PATH.read_bytes()).hexdigest())
        before, after = PdfReader(source), PdfReader(output)
        self.assertEqual(optimizer.uri_links(before), optimizer.uri_links(after))
        for original, page in zip(before.pages, after.pages):
            self.assertEqual(optimizer.text_identity(original.extract_text()), optimizer.text_identity(page.extract_text()))
            self.assertEqual(list(page["/Resources"]["/XObject"]), ["/Visual"])
            image = page["/Resources"]["/XObject"]["/Visual"]
            self.assertEqual(image["/Width"], 1280)
            self.assertIsNone(image.get("/SMask"))
            instructions = ContentStream(page["/Contents"], after).operations
            self.assertTrue(any(operator == b"Tj" for _, operator in instructions))
            self.assertTrue(all(list(operands) == [3] for operands, operator in instructions if operator == b"Tr"))
        with pikepdf.open(output) as pdf:
            self.assertTrue(pdf.is_linearized)
            self.assertTrue(pdf.check_linearization())
            self.assertFalse(any(isinstance(obj, pikepdf.Dictionary) and
                                 (obj.get("/Subtype") == "/Form" or obj.get("/SMask") is not None) for obj in pdf.objects))
        self.assertTrue(all(row["pixelMeanError"] < 4 for row in result["pageEvidence"]))

    def test_form_local_font_names_do_not_collide(self):
        writer = PdfWriter()
        page = writer.add_blank_page(400, 225)
        forms = DictionaryObject()
        for index, base_font in enumerate(("/Helvetica", "/Courier")):
            font = writer._add_object(DictionaryObject({NameObject("/Type"): NameObject("/Font"),
                NameObject("/Subtype"): NameObject("/Type1"), NameObject("/BaseFont"): NameObject(base_font)}))
            form = pdf_stream(f"BT /F1 18 Tf 5 20 Td (Font {index + 1}) Tj ET".encode())
            form.update({NameObject("/Type"): NameObject("/XObject"), NameObject("/Subtype"): NameObject("/Form"),
                         NameObject("/BBox"): ArrayObject([NumberObject(n) for n in (0, 0, 160, 50)]),
                         NameObject("/Resources"): DictionaryObject({NameObject("/Font"): writer._add_object(DictionaryObject({NameObject("/F1"): font}))})})
            forms[NameObject(f"/Form{index}")] = writer._add_object(form)
        page[NameObject("/Resources")] = DictionaryObject({NameObject("/XObject"): writer._add_object(forms)})
        page[NameObject("/Contents")] = writer._add_object(pdf_stream(b"q 1 0 0 1 20 140 cm /Form0 Do Q q 1 0 0 1 20 60 cm /Form1 Do Q"))
        source = self.directory / "font-collision.pdf"
        with source.open("wb") as stream: writer.write(stream)
        output = self.directory / "font-collision-optimized.pdf"
        optimizer.optimize_pdf(source, output, visual_width=1280, verify_width=800)
        page = PdfReader(output).pages[0]
        fonts = page["/Resources"]["/Font"]
        self.assertEqual(len(fonts), 2)
        self.assertEqual({font.get_object()["/BaseFont"] for font in fonts.values()}, {"/Helvetica", "/Courier"})
        self.assertEqual(optimizer.text_identity(page.extract_text()), "Font1Font2")

    def test_indirect_uri_action_dictionary_is_preserved(self):
        source = self.fixture()
        reader = PdfReader(source)
        writer = PdfWriter()
        writer.clone_document_from_reader(reader)
        for page in writer.pages:
            for reference in page["/Annots"]:
                annotation = reference.get_object()
                annotation[NameObject("/A")] = writer._add_object(annotation["/A"])
        indirect_source = self.directory / "indirect-uri.pdf"
        with indirect_source.open("wb") as stream:
            writer.write(stream)
        output = self.directory / "indirect-uri-optimized.pdf"
        result = optimizer.optimize_pdf(indirect_source, output, visual_width=1280, verify_width=800)
        self.assertEqual(result["uriLinks"], 2)
        self.assertEqual(optimizer.uri_links(PdfReader(indirect_source)), optimizer.uri_links(PdfReader(output)))

    def test_type3_unicode_text_survives_but_glyph_paint_is_removed(self):
        writer = PdfWriter()
        page = writer.add_blank_page(400, 225)
        cmap = b"/CIDInit /ProcSet findresource begin 12 dict begin begincmap /CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def /CMapName /Test def /CMapType 2 def 1 begincodespacerange <00> <FF> endcodespacerange 1 beginbfchar <41> <4E2D> endbfchar endcmap CMapName currentdict /CMap defineresource pop end end"
        font = DictionaryObject({NameObject("/Type"): NameObject("/Font"), NameObject("/Subtype"): NameObject("/Type3"),
            NameObject("/FontBBox"): ArrayObject([NumberObject(n) for n in (0, 0, 500, 700)]),
            NameObject("/FontMatrix"): ArrayObject([optimizer.FloatObject(n) for n in (.001, 0, 0, .001, 0, 0)]),
            NameObject("/CharProcs"): DictionaryObject({NameObject("/A"): writer._add_object(pdf_stream(b"500 0 0 0 500 700 d1 0 0 500 700 re f"))}),
            NameObject("/Encoding"): DictionaryObject({NameObject("/Type"): NameObject("/Encoding"), NameObject("/Differences"): ArrayObject([NumberObject(65), NameObject("/A")])}),
            NameObject("/FirstChar"): NumberObject(65), NameObject("/LastChar"): NumberObject(65),
            NameObject("/Widths"): ArrayObject([NumberObject(500)]), NameObject("/ToUnicode"): writer._add_object(pdf_stream(cmap))})
        page[NameObject("/Resources")] = DictionaryObject({NameObject("/Font"): DictionaryObject({NameObject("/F1"): writer._add_object(font)})})
        page[NameObject("/Contents")] = writer._add_object(pdf_stream(b"BT /F1 40 Tf 20 80 Td <41> Tj ET"))
        source = self.directory / "type3.pdf"
        with source.open("wb") as stream: writer.write(stream)
        output = self.directory / "type3-optimized.pdf"
        optimizer.optimize_pdf(source, output, visual_width=1280, verify_width=800)
        document = PdfReader(output)
        self.assertEqual(optimizer.text_identity(document.pages[0].extract_text()), "中")
        font = next(iter(document.pages[0]["/Resources"]["/Font"].values())).get_object()
        operations = ContentStream(font["/CharProcs"]["/A"], document).operations
        self.assertEqual([operator for _, operator in operations], [b"d1"])

    def test_output_boundaries_and_unsupported_rotation_fail_without_overwriting(self):
        source = self.fixture()
        digest = hashlib.sha256(source.read_bytes()).hexdigest()
        with self.assertRaisesRegex(ValueError, "覆盖源PDF"):
            optimizer.checked_output(source, source)
        with self.assertRaisesRegex(ValueError, ".tmp"):
            optimizer.checked_output(source, ROOT / "microi.doc/invalid-output.pdf")
        existing = self.directory / "existing.pdf"
        existing.write_bytes(b"unknown-owner")
        with self.assertRaises(FileExistsError): optimizer.checked_output(source, existing)
        self.assertEqual(existing.read_bytes(), b"unknown-owner")
        with mock.patch.object(Path, "is_junction", create=True, side_effect=lambda: True):
            with self.assertRaisesRegex(ValueError, "junction"):
                optimizer.checked_output(source, self.directory / "junction.pdf")
        reader = PdfReader(source); writer = PdfWriter(); writer.add_page(reader.pages[0]); writer.pages[0].rotate(90)
        rotated = self.directory / "rotated.pdf"
        with rotated.open("wb") as stream: writer.write(stream)
        with self.assertRaisesRegex(ValueError, "Rotate=0"):
            optimizer.optimize_pdf(rotated, self.directory / "rotated-optimized.pdf", visual_width=1280)
        self.assertFalse((self.directory / "rotated-optimized.pdf").exists())
        self.assertEqual(hashlib.sha256(source.read_bytes()).hexdigest(), digest)

    def test_source_or_optimizer_drift_prevents_candidate_commit(self):
        source = self.fixture()
        original_assertion = optimizer.assert_file_unchanged
        for changed_label in ("源PDF", "优化器源码"):
            output = self.directory / f"drift-{changed_label}.pdf"

            def detect_drift(path, expected, label):
                if label == changed_label:
                    raise ValueError(f"生成过程中{label}发生变化")
                original_assertion(path, expected, label)

            with mock.patch.object(optimizer, "assert_file_unchanged", side_effect=detect_drift):
                with self.assertRaisesRegex(ValueError, changed_label):
                    optimizer.optimize_pdf(source, output, visual_width=1280, verify_width=800)
            self.assertFalse(output.exists(), "漂移时不得提交候选PDF")
            self.assertFalse(output.with_suffix(".validation.json").exists())

        probe = self.directory / "changed-source.py"
        probe.write_text("before", encoding="utf-8")
        expected = optimizer.file_sha256(probe)
        probe.write_text("after", encoding="utf-8")
        with self.assertRaisesRegex(ValueError, "源码"):
            original_assertion(probe, expected, "源码")


if __name__ == "__main__":
    unittest.main()
