// Lets node load the site's modules: its path aliases, and the node build of the serialization library
// in place of the browser build. Used with `node --import ./site-hooks.mjs site.mjs`.
import { registerHooks } from "node:module";

const app = new URL("../../../app/", import.meta.url);

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "@emurgo/cardano-serialization-lib-browser") {
      return nextResolve("@emurgo/cardano-serialization-lib-nodejs", { ...context, parentURL: import.meta.url });
    }
    if (specifier.startsWith("@cardano/")) {
      return nextResolve(new URL(`cardano/${specifier.slice("@cardano/".length)}.ts`, app).href, context);
    }
    return nextResolve(specifier, context);
  },
});
