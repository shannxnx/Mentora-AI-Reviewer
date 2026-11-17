const { test } = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const CFB = require("cfb");

for (const format of ["ppt", "pptx"]) {
  test(format + " extracts real slides, titles, bullets, and corresponding speaker notes in order", async () => {
    const parser = format === "ppt" ? (await import("../lib/presentations/ppt.mjs")).legacySlides
      : (await import("../lib/presentations/pptx.mjs")).modernSlides;
    const bytes = readFileSync(join(__dirname, "fixtures/powerpoint/SampleShow." + format));
    const slides = await parser(bytes);
    assert.equal(slides.length, 2);
    assert.equal(slides[0].lines[0], "Title of the first slide");
    assert.equal(slides[1].lines[0], "This is the second slide");
    assert.ok(slides[1].lines.includes("It has bullet points on it"));
    assert.match(slides[0].notes.join(" "), /notes of the first slide/);
    assert.match(slides[1].notes.join(" "), /notes of the 2nd slide/);
    await assert.rejects(async () => parser(Buffer.from("%PDF-not-a-presentation")));
  });
}

test("PPTX follows presentation relationships even after slides are reordered and preserves table cells", async () => {
  const { modernSlides } = await import("../lib/presentations/pptx.mjs");
  const zip = CFB.utils.cfb_new();
  const put = (name, xml) => CFB.utils.cfb_add(zip, name, Buffer.from(xml));
  const rels = (...items) => "<Relationships>" + items.map(([id, type, target]) =>
    '<Relationship Id="' + id + '" Type="urn:office/' + type + '" Target="' + target + '"/>').join("") + "</Relationships>";
  put("_rels/.rels", rels(["main", "officeDocument", "ppt/presentation.xml"]));
  put("ppt/presentation.xml", '<presentation xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sldIdLst><sldId r:id="second"/><sldId r:id="first"/></sldIdLst></presentation>');
  put("ppt/_rels/presentation.xml.rels", rels(["first", "slide", "slides/slide1.xml"], ["second", "slide", "slides/slide2.xml"]));
  put("ppt/slides/slide1.xml", "<sld><sp><p><t>Last slide</t></p></sp></sld>");
  put("ppt/slides/slide2.xml", "<sld><tbl><tr><tc><p><t>Area</t></p></tc><tc><p><t>12 cm²</t></p></tc></tr></tbl></sld>");
  const bytes = CFB.write(zip, { type: "buffer", fileType: "zip" });
  const slides = await modernSlides(bytes);
  assert.deepEqual(slides.map(s => s.lines), [["Area | 12 cm²"], ["Last slide"]]);
});
