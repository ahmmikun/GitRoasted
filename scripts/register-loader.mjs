/**
 * Registers the alias/extension resolve hook used by the `scripts/` CLI tools.
 * Loaded via `node --import ./scripts/register-loader.mjs`.
 */

import { register } from "node:module";
import { pathToFileURL } from "node:url";

register("./alias-loader.mjs", pathToFileURL(import.meta.filename));
