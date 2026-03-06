// React 19 requires this flag for act() support in Jest + jsdom.
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const resizeObserverInstances = new Set();

function getMockResizeObserverWidth(element) {
  const elementWidth = Number.parseFloat(element?.dataset?.mockWidth || '');

  if (Number.isFinite(elementWidth) && elementWidth > 0) {
    return elementWidth;
  }

  return globalThis.__mockResizeObserverWidth || 1200;
}

function createResizeObserverEntry(element) {
  const width = getMockResizeObserverWidth(element);

  return {
    target: element,
    contentRect: {
      width,
      height: 0,
      top: 0,
      left: 0,
      right: width,
      bottom: 0,
      x: 0,
      y: 0,
    },
  };
}

class MockResizeObserver {
  constructor(callback) {
    this.callback = callback;
    this.elements = new Set();
    resizeObserverInstances.add(this);
  }

  observe = (element) => {
    this.elements.add(element);
    this.flush();
  };

  unobserve = (element) => {
    this.elements.delete(element);
  };

  disconnect = () => {
    this.elements.clear();
    resizeObserverInstances.delete(this);
  };

  flush = () => {
    if (this.elements.size === 0) {
      return;
    }

    this.callback(Array.from(this.elements).map((element) => createResizeObserverEntry(element)), this);
  };
}

globalThis.__mockResizeObserverWidth = 1200;
globalThis.__setMockResizeObserverWidth = (width) => {
  globalThis.__mockResizeObserverWidth = width;
  resizeObserverInstances.forEach((observer) => observer.flush());
};
globalThis.__flushMockResizeObservers = () => {
  resizeObserverInstances.forEach((observer) => observer.flush());
};
globalThis.ResizeObserver = MockResizeObserver;
