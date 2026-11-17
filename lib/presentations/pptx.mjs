import pathModule from "node:path";
import { SaxesParser } from "saxes";
import yauzl from "yauzl";
const path = pathModule.posix;

async function archive(bytes) {
  const zip = await new Promise((resolve, reject) => yauzl.fromBuffer(bytes, { lazyEntries: true }, (e, z) => e ? reject(e) : resolve(z)));
  const entries = new Map();
  await new Promise((resolve, reject) => {
    zip.on("error", reject);
    zip.on("end", resolve);
    zip.on("entry", entry => {
      if (entries.size >= 6000 || entries.has(entry.fileName)) return reject(Error("Too many or duplicate presentation parts."));
      entries.set(entry.fileName, entry);
      zip.readEntry();
    });
    zip.readEntry();
  });
  let remaining = 40 * 1024 * 1024;
  return async (name, limit = 3 * 1024 * 1024) => {
    const entry = entries.get(name);
    if (!entry) return null;
    if (entry.uncompressedSize > Math.min(limit, remaining)) throw Error("This presentation is too large to unpack. Split it into smaller files.");
    const stream = await new Promise((resolve, reject) => zip.openReadStream(entry, (e, s) => e ? reject(e) : resolve(s)));
    const chunks = [];
    let size = 0;
    for await (const chunk of stream) {
      size += chunk.length;
      if (size > entry.uncompressedSize) throw Error("Invalid presentation part size.");
      chunks.push(chunk);
    }
    remaining -= size;
    return Buffer.concat(chunks);
  };
}

function xml(bytes) {
  if (!bytes) throw Error("A required PowerPoint part is missing.");
  const root = { children: [] };
  const stack = [root];
  const parser = new SaxesParser({ xmlns: true });
  let count = 0;
  parser.on("doctype", () => { throw Error("Unsupported XML declaration in this presentation."); });
  parser.on("opentag", tag => {
    if (++count > 120000 || stack.length > 100) throw Error("This slide is too complex to read.");
    const attrs = {};
    for (const a of Object.values(tag.attributes)) {
      const key = a.uri.endsWith("/relationships") ? "rel:" + a.local : a.local;
      attrs[key] = a.value;
    }
    const node = { name: tag.local, attrs, children: [], value: "" };
    stack.at(-1).children.push(node);
    stack.push(node);
  });
  parser.on("text", value => { stack.at(-1).value += value; });
  parser.on("closetag", () => stack.pop());
  parser.write(bytes.toString("utf8")).close();
  return root;
}
function* find(node, name) {
  if (node.name === name) yield node;
  for (const child of node.children) yield* find(child, name);
}
function paragraphs(node) {
  return [...find(node, "p")].map(p => [...find(p, "t")].map(t => t.value).join("").trim()).filter(Boolean);
}
function relationships(bytes, owner) {
  const result = new Map();
  if (bytes) for (const { attrs } of find(xml(bytes), "Relationship")) {
    if (attrs.TargetMode === "External" || !attrs.Target || /[:\\]/.test(attrs.Target)) continue;
    const target = path.normalize(attrs.Target.startsWith("/") ? attrs.Target.slice(1) : path.join(path.dirname(owner), attrs.Target));
    if (!target.startsWith("../")) result.set(attrs.Id, { type: attrs.Type.split("/").pop(), target });
  }
  return result;
}
const relName = part => path.join(path.dirname(part), "_rels", path.basename(part) + ".rels");

async function modernSlides(bytes) {
  if (bytes.readUInt32LE(0) !== 0x04034b50) throw Error("This file is not a valid PPTX. Remove any password and save it again.");
  const read = await archive(bytes);
  const rootRels = relationships(await read("_rels/.rels"), "");
  const main = [...rootRels.values()].find(r => r.type === "officeDocument")?.target;
  if (!main) throw Error("This file does not contain a PowerPoint presentation.");
  const pres = xml(await read(main));
  const order = [...find(pres, "sldId")];
  if (order.length > 400) throw Error("Use a presentation with 400 slides or fewer.");
  const rels = relationships(await read(relName(main)), main);
  const slides = [];
  let imageBytes = 0;
  let imageCount = 0;
  for (const id of order) {
    const rel = rels.get(id.attrs["rel:id"]);
    if (rel?.type !== "slide") throw Error("The presentation slide order is damaged.");
    const slide = xml(await read(rel.target));
    const links = relationships(await read(relName(rel.target)), rel.target);
    const lines = [], notes = [], images = [];
    // Read shape paragraphs in drawing order and preserve table row/cell boundaries.
    function shapes(node) {
      if (node.name === "tbl") {
        for (const row of find(node, "tr")) lines.push(row.children.filter(c => c.name === "tc").map(c => paragraphs(c).join(" ")).join(" | "));
      } else if (node.name === "sp") lines.push(...paragraphs(node));
      else if (node.name === "pic") {
        const alt = [...find(node, "cNvPr")][0]?.attrs;
        if (alt?.descr || alt?.title) lines.push(alt.descr || alt.title);
      } else for (const child of node.children) shapes(child);
    }
    shapes(slide);
    for (const link of links.values()) {
      if (link.type === "notesSlide") {
        for (const shape of find(xml(await read(link.target)), "sp")) {
          const type = [...find(shape, "ph")][0]?.attrs.type;
          if (!type || type === "body") notes.push(...paragraphs(shape));
        }
      } else if (link.type === "diagramData") lines.push(...paragraphs(xml(await read(link.target))));
      else if (link.type === "chart") {
        const chart = xml(await read(link.target));
        lines.push(...paragraphs(chart));
        for (const series of find(chart, "ser")) {
          const values = [...find(series, "v")].map(n => n.value.trim()).filter(Boolean);
          if (values.length) lines.push(values.join(" | "));
        }
      }
    }
    // Only referenced, embedded raster images are eligible for visual interpretation.
    for (const blip of find(slide, "blip")) {
      const media = links.get(blip.attrs["rel:embed"]);
      if (media?.type !== "image" || imageCount >= 12 || imageBytes >= 4 * 1024 * 1024) continue;
      if (!/\.(?:png|jpe?g)$/i.test(media.target)) continue;
      const data = await read(media.target, 10 * 1024 * 1024);
      if (!data || imageBytes + data.length > 4 * 1024 * 1024) continue;
      const png = data.subarray(0,8).equals(Buffer.from("89504e470d0a1a0a", "hex"));
      if (!png && data.readUInt16BE(0) !== 0xffd8) continue;
      images.push({ type: "image", mime_type: png ? "image/png" : "image/jpeg", data: data.toString("base64") });
      imageCount++; imageBytes += data.length;
    }
    slides.push({ lines, notes, images });
  }
  return slides;
}
export { modernSlides };
