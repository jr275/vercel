/**
 * Loads the kit's scripts once, in order (three.js r147 globals first, then the kit), from `base`.
 * `base` is where you copied embed/ to (for Next.js: "/avatar-kit"). Safe to call many times and in React strict mode.
 */
declare global {
  interface Window {
    AvatarKit?: any;
    THREE?: any;
  }
}

const loading = new Map<string, Promise<any>>();

function addScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const el = document.createElement('script');
    el.src = src;
    el.async = false;
    el.onload = () => resolve();
    el.onerror = () => reject(new Error(`Could not load ${src}`));
    document.head.appendChild(el);
  });
}

export function loadAvatarKit(base = '/avatar-kit'): Promise<any> {
  const root = base.replace(/\/$/, '');
  let p = loading.get(root);
  if (!p) {
    p = (async () => {
      if (!window.AvatarKit) {
        await addScript(`${root}/vendor/three.min.js`);
        await addScript(`${root}/vendor/loaders/GLTFLoader.js`);
        await addScript(`${root}/vendor/libs/meshopt_decoder.js`);
        await addScript(`${root}/avatar-kit.js`);
      }
      // where the Basis transcoder files for KTX2 textures live
      window.AvatarKit.KTX2_PATH = `${root}/vendor/libs/basis/`;
      return window.AvatarKit;
    })();
    p.catch(() => loading.delete(root));
    loading.set(root, p);
  }
  return p;
}
