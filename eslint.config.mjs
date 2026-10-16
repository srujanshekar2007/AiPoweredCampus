import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypeScript from "eslint-config-next/typescript";

// Next.js 16 ships flat ESLint presets, so keep lint configuration native to ESLint 9.
const eslintConfig = [...nextVitals, ...nextTypeScript];

export default eslintConfig;
