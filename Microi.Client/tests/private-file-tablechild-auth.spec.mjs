import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const formSource = await readFile(
    new URL("../src/views/form-engine/diy-form.vue", import.meta.url),
    "utf8"
);
const fileUploadSource = await readFile(
    new URL("../src/views/form-engine/diy-field-component/diy-fileupload.vue", import.meta.url),
    "utf8"
);
const imgUploadSource = await readFile(
    new URL("../src/views/form-engine/diy-field-component/diy-imgupload.vue", import.meta.url),
    "utf8"
);
const onlyOfficeSource = await readFile(
    new URL("../src/views/form-engine/diy-components/onlyoffice.vue", import.meta.url),
    "utf8"
);

function occurrenceCount(source, value) {
    return source.split(value).length - 1;
}

test("standard form passes TableChild authorization context to upload fields", () => {
    assert.ok(
        occurrenceCount(formSource, ':TableChildAuth="TableChildAuth"') >= 2,
        "both form render branches must pass the delegated context"
    );
    assert.match(fileUploadSource, /TableChildAuth:\s*\{\s*type:\s*Object,\s*default:\s*null/s);
    assert.match(imgUploadSource, /TableChildAuth:\s*\{\s*type:\s*Object,\s*default:\s*null/s);
});

test("private file and image URL requests preserve the delegated context", () => {
    assert.equal(
        occurrenceCount(
            fileUploadSource,
            "_TableChildAuth: props.TableChildAuth || undefined"
        ),
        3
    );
    assert.equal(
        occurrenceCount(
            imgUploadSource,
            "_TableChildAuth: props.TableChildAuth || undefined"
        ),
        2
    );
});

test("OnlyOffice session, private URL, metadata and save requests preserve the context", () => {
    assert.match(
        fileUploadSource,
        /tableChildAuth:\s*props\.TableChildAuth\s*\|\|\s*null/
    );
    assert.match(
        onlyOfficeSource,
        /this\.tableChildAuth\s*=\s*this\.parseTableChildAuth/
    );
    assert.match(
        onlyOfficeSource,
        /tableChildAuth:\s*this\.tableChildAuth/
    );
    assert.equal(
        occurrenceCount(
            onlyOfficeSource,
            "_TableChildAuth: this.tableChildAuth || undefined"
        ),
        3
    );
});
