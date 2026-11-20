// jsdom environment stubs for component tests that render real uPlot.
// MUST be imported BEFORE any module that imports 'uplot' (uPlot calls
// window.matchMedia at module scope). Import this file first in the test.

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

// uPlot setPxRatio() runs at module import time.
(window as any).matchMedia = (query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addListener() {},
  removeListener() {},
  addEventListener() {},
  removeEventListener() {},
  dispatchEvent() {
    return false;
  },
});

// Recording canvas 2D context stub (jsdom has no canvas implementation).
function makeCtxStub(canvas: HTMLCanvasElement): any {
  const gradient = { addColorStop() {} };
  const calls: any[] = [];
  const target: Record<string | symbol, any> = {
    canvas,
    __calls: calls,
    measureText: (t: string) => ({
      width: (t ? t.length : 0) * 6,
      actualBoundingBoxAscent: 6,
      actualBoundingBoxDescent: 2,
      actualBoundingBoxLeft: 0,
      actualBoundingBoxRight: (t ? t.length : 0) * 6,
    }),
    createLinearGradient: () => gradient,
    createRadialGradient: () => gradient,
    createPattern: () => ({}),
    getImageData: (_x: number, _y: number, w: number, h: number) => ({
      data: new Uint8ClampedArray(Math.max(1, w * h * 4)),
      width: w,
      height: h,
    }),
    getLineDash: () => [],
    fillText: (...args: any[]) => {
      calls.push(['fillText', ...args]);
    },
  };
  return new Proxy(target, {
    get(t, p) {
      if (p in t) return t[p];
      return () => {};
    },
    set(t, p, v) {
      t[p] = v;
      return true;
    },
  });
}

(HTMLCanvasElement.prototype as any).getContext = function (type: string) {
  if (type === '2d') {
    if (!(this as any).__ctx) (this as any).__ctx = makeCtxStub(this);
    return (this as any).__ctx;
  }
  return null;
};

(globalThis as any).ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

Object.defineProperty(window, 'devicePixelRatio', { value: 1, configurable: true });

// jsdom layout is always 0; give elements a real width so uPlot can size itself.
Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
  configurable: true,
  get() {
    return 600;
  },
});

(globalThis as any).Path2D = class {
  constructor(..._args: any[]) {
    return new Proxy(this, {
      get(t: any, p) {
        if (p in t) return t[p];
        return () => {};
      },
      set(t: any, p, v) {
        t[p] = v;
        return true;
      },
    });
  }
};