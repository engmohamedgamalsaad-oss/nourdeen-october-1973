import fs from 'node:fs';

const file = process.argv[2];
if (!file) throw new Error('Usage: node restore_karma_rig_mounts.mjs <optimized.glb>');
const source = fs.readFileSync(file);
if (source.readUInt32LE(0) !== 0x46546c67 || source.readUInt32LE(4) !== 2) {
  throw new Error('Expected a GLB 2.0 file: ' + file);
}
const jsonLength = source.readUInt32LE(12);
if (source.readUInt32LE(16) !== 0x4e4f534a || 20 + jsonLength > source.length) {
  throw new Error('Malformed GLB JSON chunk: ' + file);
}
const document = JSON.parse(source.subarray(20, 20 + jsonLength).toString('utf8').trim());
if (!Array.isArray(document.nodes)) throw new Error('GLB has no nodes array');
const nodes = document.nodes;
const findNode = (name) => nodes.findIndex((node) => node.name === name);
const headIndex = findNode('Head');
if (headIndex < 0) throw new Error('Cannot restore Karma mounts: Head bone is missing');

const ensureChild = (name, parentIndex) => {
  let index = findNode(name);
  if (index < 0) {
    index = nodes.length;
    nodes.push({ name, translation: [0, 0, 0] });
  }
  // glTF nodes have one parent. Remove any stale parent link before reattaching.
  for (let i = 0; i < nodes.length; i++) {
    if (i === parentIndex || !Array.isArray(nodes[i].children)) continue;
    nodes[i].children = nodes[i].children.filter((child) => child !== index);
  }
  const parent = nodes[parentIndex];
  parent.children ||= [];
  if (!parent.children.includes(index)) parent.children.push(index);
  return index;
};

const headMount = ensureChild('HeadMount', headIndex);
ensureChild('HairMount', headIndex);
ensureChild('HEAD_PLACEHOLDER_replace_with_karma_head', headMount);

const jsonBytes = Buffer.from(JSON.stringify(document), 'utf8');
const paddedLength = (jsonBytes.length + 3) & ~3;
const paddedJson = Buffer.alloc(paddedLength, 0x20);
jsonBytes.copy(paddedJson);
const remainder = source.subarray(20 + jsonLength);
const totalLength = 12 + 8 + paddedLength + remainder.length;
const header = Buffer.alloc(20);
header.writeUInt32LE(0x46546c67, 0);
header.writeUInt32LE(2, 4);
header.writeUInt32LE(totalLength, 8);
header.writeUInt32LE(paddedLength, 12);
header.writeUInt32LE(0x4e4f534a, 16);
fs.writeFileSync(file, Buffer.concat([header, paddedJson, remainder]));
console.log('Restored identity HeadMount/HairMount nodes and head placeholder without changing mesh or skin data.');
