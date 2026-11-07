"use client";

import type { AgTypeScriptComponent } from "ag-studio";
import type { ComponentType } from "react";
import { createRoot, type Root } from "react-dom/client";

/**
 * A React component as the TypeScript component class vanilla AG Studio takes for custom widgets and tool cards.
 * Studio calls init once and refresh whenever the params change (a filter, a cross-filter, a resize); each renders
 * the component again with the new params.
 */
export function reactComp<P extends object>(Comp: ComponentType<P>) {
  return class ReactComp implements AgTypeScriptComponent<P> {
    private readonly el = document.createElement("div");
    private readonly root: Root = createRoot(this.el);

    constructor() {
      this.el.style.height = "100%";
      this.el.style.width = "100%";
    }

    init(params: P) {
      this.root.render(<Comp {...params} />);
    }

    refresh(params: P) {
      this.root.render(<Comp {...params} />);
    }

    getGui() {
      return this.el;
    }

    destroy() {
      // Unmounting during Studio's own teardown render warns in React; defer it a tick.
      const root = this.root;
      queueMicrotask(() => root.unmount());
    }
  };
}
