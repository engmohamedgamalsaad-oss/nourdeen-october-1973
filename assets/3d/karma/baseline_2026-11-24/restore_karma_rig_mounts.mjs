import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';

const file = process.argv[2];
if (!file) throw new Error('Usage: node restore_karma_rig_mounts.mjs <optimized.glb>');
const io = new NodeIO();
io.registerExtensions(ALL_EXTENSIONS);
const document = await io.read(file);
const nodes = document.getRoot().listNodes();
const find = (name) => nodes.find((node) => node.getName() === name);
const head = find('Head');
if (!head) throw new Error('Cannot restore Karma mounts: Head bone is missing');

const ensureChild = (name, parent) => {
  let node = find(name);
  if (!node) {
    node = document.createNode(name).setTranslation([0, 0, 0]);
    nodes.push(node);
  }
  const currentParent = node.getParent();
  if (currentParent && currentParent !== parent) currentParent.removeChild(node);
  if (node.getParent() !== parent) parent.addChild(node);
  return node;
};

const headMount = ensureChild('HeadMount', head);
ensureChild('HairMount', head);
ensureChild('HEAD_PLACEHOLDER_replace_with_karma_head', headMount);
await io.write(file, document);
console.log('Restored controller mount contract: HeadMount, HairMount, placeholder.');
