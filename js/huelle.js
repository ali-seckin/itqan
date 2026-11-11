// Itqān · Anpassung für die Android-Hülle (Capacitor). Im Browser ohne Wirkung.
// Die Hülle kennt kein navigator.share und keine Downloads über <a download>. Beides geht hier über die nativen Module Share und Filesystem.
const C = globalThis.Capacitor;
if (C?.isNativePlatform?.() && C.Plugins?.Share && C.Plugins?.Filesystem) {
  const { Share, Filesystem } = C.Plugins;
  const alsBase64 = blob => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1]); r.onerror = rej; r.readAsDataURL(blob); });
  const ablegen = async (blob, name) => (await Filesystem.writeFile({ path: name, data: await alsBase64(blob), directory: 'CACHE' })).uri;
  const abbruch = e => /cancel/i.test(e?.message || '') ? new DOMException('', 'AbortError') : e;
  navigator.canShare = () => true;
  navigator.share = async ({ files, title, text, url } = {}) => {
    try {
      if (files?.length) {
        const uris = [];
        for (const f of files) uris.push(await ablegen(f, f.name));
        await Share.share({ title, files: uris, dialogTitle: title });
      } else await Share.share({ title, text, url, dialogTitle: title });
    } catch (e) { throw abbruch(e); }
  };
  const klick = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function () {
    if (this.download && this.href.startsWith('blob:')) {
      const name = this.download;
      fetch(this.href).then(r => r.blob()).then(async b => Share.share({ title: name, files: [await ablegen(b, name)], dialogTitle: name })).catch(() => {});
      return;
    }
    return klick.call(this);
  };
}
