const originalDefine = customElements.define.bind(customElements);
customElements.define = function(name: string, constructor: CustomElementConstructor, options?: ElementDefinitionOptions) {
  if (customElements.get(name)) {
    console.warn(`Custom element '${name}' is already defined, skipping duplicate registration`);
    return;
  }
  return originalDefine(name, constructor, options);
};

import "@holochain-open-dev/elements/dist/elements/display-error.js";
