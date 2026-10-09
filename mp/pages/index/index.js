import { generate } from '../../utils/gen.js';
import { thumbnail } from '../../utils/art.js';
import * as store from '../../utils/store.js';

const GRIDS = [120, 200, 320, 480, 640, 800];

// Decode the photo and draw it at (w*F) x (h*F) so gen.js can box-average F x F blocks per cell.
// ponytail: EXIF orientation is not applied; rotate here if portrait photos come out sideways.
function photoPixels(path, long) {
  return new Promise((ok, err) => {
    const oc = wx.createOffscreenCanvas({ type: '2d', width: 1, height: 1 });
    const img = oc.createImage();
    img.onerror = () => err(new Error('图片读取失败'));
    img.onload = () => {
      const F = Math.min(4, Math.max(1, Math.floor(1600 / long))); // keep the canvas small on phones
      const k = long / Math.max(img.width, img.height);
      const w = Math.max(1, Math.round(img.width * k)), h = Math.max(1, Math.round(img.height * k));
      oc.width = w * F; oc.height = h * F;
      const ctx = oc.getContext('2d');
      ctx.drawImage(img, 0, 0, w * F, h * F);
      ok({ data: ctx.getImageData(0, 0, w * F, h * F).data, w, h, F });
    };
    img.src = path;
  });
}

Page({
  data: { grids: GRIDS, gridIdx: 2, colors: 32, wb: true, busy: false, sheet: false, list: [] },

  onShow() {
    this.setData({
      list: store.metas().map(m => {
        const pct = Math.floor(m.done / m.total * 100);
        const d = new Date(m.created);
        const date = `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
        return { id: m.id, thumb: m.thumb, pct, date };
      }),
    });
  },

  openSheet() { this.setData({ sheet: true }); },
  closeSheet() { this.setData({ sheet: false }); },
  onGrid(e) { this.setData({ gridIdx: +e.currentTarget.dataset.i }); },
  onColors(e) { this.setData({ colors: Math.min(64, Math.max(8, this.data.colors + +e.currentTarget.dataset.d)) }); },
  onWb() { this.setData({ wb: !this.data.wb }); },

  async importPhoto() {
    if (this.data.busy) return;
    let path;
    try {
      const res = await wx.chooseMedia({ count: 1, mediaType: ['image'], sizeType: ['original'] });
      path = res.tempFiles[0].tempFilePath;
    } catch (e) { return; } // cancelled
    this.setData({ busy: true, sheet: false });
    wx.showLoading({ title: '生成中…', mask: true });
    try {
      const { data, w, h, F } = await photoPixels(path, GRIDS[this.data.gridIdx]);
      await new Promise(r => setTimeout(r, 30)); // let the loading toast paint before the heavy work
      const p = generate(data, w, h, { f: F, colors: this.data.colors, wb: this.data.wb });
      const id = Date.now().toString(36), filled = new Uint8Array(w * h);
      store.writeBin(`c-${id}`, p.cells);
      store.writeBin(`f-${id}`, filled);
      store.putMeta({ id, created: Date.now(), w, h, palette: p.palette, total: w * h, done: 0, thumb: thumbnail(w, h, p.palette, p.cells, filled) });
      wx.hideLoading();
      wx.navigateTo({ url: `/pages/play/play?id=${id}` });
    } catch (e) {
      wx.hideLoading();
      wx.showModal({ title: '生成失败', content: String(e.message || e.errMsg || e), showCancel: false });
    } finally {
      this.setData({ busy: false });
    }
  },

  open(e) { wx.navigateTo({ url: `/pages/play/play?id=${e.currentTarget.dataset.id}` }); },

  del(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '删除这幅作品？',
      success: r => { if (r.confirm) { store.remove(id); this.onShow(); } },
    });
  },
});
