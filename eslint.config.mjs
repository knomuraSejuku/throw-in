import { defineConfig } from "eslint/config";
import next from "eslint-config-next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig([{
    extends: [...next],
    rules: {
        // The current app uses App Router pages with local derived state and
        // animation refs. Keep the established behavior stable for now while
        // still running the rest of Next/React lint checks.
        "react-hooks/set-state-in-effect": "off",
        "react-hooks/refs": "off",
        "react-hooks/purity": "off",
    },
}]);
