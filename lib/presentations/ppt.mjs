// MS-PPT stores slide order in the latest DocumentContainer. Persist directories
// are incremental, so resolve the newest reference for each object first.
import CFB from "cfb";
const OLE = Buffer.from("d0cf11e0a1b11ae1", "hex");

function legacySlides(bytes) {
  if (!bytes.subarray(0, 8).equals(OLE)) throw Error("This file is not a PowerPoint 97–2003 presentation.");
  const compound = CFB.read(bytes, { type: "buffer" });
  const stream = name => CFB.find(compound, "/" + name)?.content;
  const current = stream("Current User");
  const doc = stream("PowerPoint Document");
  if (!current || !doc || current.length < 24) throw Error("This presentation is damaged or uses an older unsupported PowerPoint format.");
  if (current.readUInt32LE(12) !== 0xe391c05f) throw Error("Remove the presentation password and upload an unencrypted copy.");
  let records = 0;
  function record(offset, limit = doc.length) {
    if (++records > 250000 || offset + 8 > limit) throw Error("Invalid PowerPoint record.");
    const opts = doc.readUInt16LE(offset);
    const start = offset + 8;
    const end = start + doc.readUInt32LE(offset + 4);
    if (end > limit) throw Error("Incomplete PowerPoint record.");
    return { type: doc.readUInt16LE(offset + 2), instance: opts >>> 4, container: (opts & 15) === 15, start, end };
  }
  function* children(parent) {
    for (let pos = parent.start; pos < parent.end;) {
      const child = record(pos, parent.end);
      yield child;
      pos = child.end;
    }
  }
  const refs = new Map();
  const visited = new Set();
  let edit = current.readUInt32LE(16);
  let documentId;
  do {
    if (visited.has(edit) || visited.size > 4096) throw Error("Invalid PowerPoint edit history.");
    visited.add(edit);
    const user = record(edit);
    if (user.type !== 4085 || user.end - user.start < 24) throw Error("Invalid PowerPoint edit history.");
    documentId ??= doc.readUInt32LE(user.start + 16);
    const ptr = record(doc.readUInt32LE(user.start + 12));
    if (![6001, 6002].includes(ptr.type)) throw Error("Invalid PowerPoint directory.");
    for (let pos = ptr.start; pos < ptr.end;) {
      const header = doc.readUInt32LE(pos);
      const first = header & 0xfffff;
      const count = header >>> 20;
      pos += 4;
      if (!count || pos + count * 4 > ptr.end) throw Error("Invalid PowerPoint directory.");
      for (let i = 0; i < count; i++, pos += 4) {
        if (!refs.has(first + i)) refs.set(first + i, doc.readUInt32LE(pos));
      }
    }
    edit = doc.readUInt32LE(user.start + 8);
  } while (edit);
  function resolve(id, expected) {
    if (!refs.has(id)) throw Error("Missing PowerPoint slide data.");
    const obj = record(refs.get(id));
    if (obj.type !== expected) throw Error("Unexpected PowerPoint slide data.");
    return obj;
  }
  function extract(node, lines, depth = 0) {
    if (depth > 48) throw Error("Presentation nesting is too deep.");
    if (node.type === 4000 || node.type === 4008) {
      const value = doc.toString(node.type === 4000 ? "utf16le" : "latin1", node.start, node.end);
      for (const line of value.split(/[\r\n\v]+/)) if (line.trim()) lines.push(line.trim());
    } else if (node.container || node.type === 0xf00d) {
      // OfficeArtClientTextbox embeds a second sequence of PowerPoint records.
      for (const child of children(node)) extract(child, lines, depth + 1);
    }
  }
  const lists = [...children(resolve(documentId, 1000))].filter(r => r.type === 4080);
  function items(list) {
    const result = [];
    let item;
    if (list) for (const node of children(list)) {
      if (node.type === 1011) {
        item = { ref: doc.readUInt32LE(node.start), id: doc.readUInt32LE(node.start + 12), lines: [] };
        result.push(item);
      } else if (item) extract(node, item.lines);
    }
    return result;
  }
  const slides = items(lists.find(r => r.instance === 0));
  if (slides.length > 400) throw Error("Use a presentation with 400 slides or fewer.");
  const notesMap = new Map(items(lists.find(r => r.instance === 2)).map(n => [n.id, n]));
  return slides.map(item => {
    const slide = resolve(item.ref, 1006);
    const nodes = [...children(slide)];
    const atom = nodes.find(n => n.type === 1007);
    const notesId = atom && doc.readUInt32LE(atom.start + 16);
    const note = notesMap.get(notesId);
    const notes = [];
    if (note) { notes.push(...note.lines); extract(resolve(note.ref, 1008), notes); }
    const lines = item.lines.slice();
    extract(slide, lines);
    return { lines: [...new Set(lines)], notes: [...new Set(notes)].filter(t => /[\p{L}\p{N}]/u.test(t) && !/^\d+$/.test(t)), images: [] };
  });
}

export { legacySlides };
