// Metas (small: palette, progress count, thumbnail) in wx storage; cell arrays as binary files.
const fs = wx.getFileSystemManager();
const file = name => `${wx.env.USER_DATA_PATH}/${name}`;

export const metas = () => wx.getStorageSync('metas') || [];
export const setMetas = list => wx.setStorageSync('metas', list);
export function putMeta(m) {
  const list = metas().filter(x => x.id !== m.id);
  setMetas([m, ...list].sort((a, b) => b.created - a.created));
}

export function writeBin(name, u8) {
  fs.writeFileSync(file(name), u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength));
}
export const readBin = name => new Uint8Array(fs.readFileSync(file(name)));

export function remove(id) {
  for (const n of [`c-${id}`, `f-${id}`]) { try { fs.unlinkSync(file(n)); } catch (e) {} }
  setMetas(metas().filter(m => m.id !== id));
}
