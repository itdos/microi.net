import assert from "node:assert/strict";
import test from "node:test";
import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";

import { normalizeXlsxPreviewArrayBuffer } from "../src/views/form-engine/utils/excel-preview-normalizer.js";

function asArrayBuffer(bytes) {
    return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

test("normalizes default XDR namespaces and absolute drawing targets for preview", async () => {
    const drawing = `<wsDr xmlns="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing"><oneCellAnchor><from><col>3</col><row>1</row></from><pic><nvPicPr><cNvPr id="1" name="Image 1"/></nvPicPr></pic><clientData/></oneCellAnchor></wsDr>`;
    const rels = `<Relationships><Relationship Target="/xl/drawings/drawing1.xml"/><Relationship Target='/xl/media/image1.png'/></Relationships>`;
    const source = asArrayBuffer(zipSync({
        "xl/drawings/drawing1.xml": strToU8(drawing),
        "xl/worksheets/_rels/sheet1.xml.rels": strToU8(rels)
    }));

    const normalized = await normalizeXlsxPreviewArrayBuffer(source);
    const entries = unzipSync(new Uint8Array(normalized));
    const normalizedDrawing = strFromU8(entries["xl/drawings/drawing1.xml"]);
    const normalizedRels = strFromU8(entries["xl/worksheets/_rels/sheet1.xml.rels"]);

    assert.match(normalizedDrawing, /<xdr:wsDr\b/);
    assert.match(normalizedDrawing, /<xdr:oneCellAnchor>/);
    assert.match(normalizedDrawing, /xmlns:xdr="http:\/\/schemas\.openxmlformats\.org\/drawingml\/2006\/spreadsheetDrawing"/);
    assert.match(normalizedRels, /Target="\.\.\/drawings\/drawing1\.xml"/);
    assert.match(normalizedRels, /Target='\.\.\/media\/image1\.png'/);
});
test("leaves non-zip legacy workbook content untouched", async () => {
    const source = asArrayBuffer(Uint8Array.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]));
    const normalized = await normalizeXlsxPreviewArrayBuffer(source);
    assert.deepEqual(new Uint8Array(normalized), new Uint8Array(source));
});
