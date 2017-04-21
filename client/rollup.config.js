import resolve from "rollup-plugin-node-resolve";
import commonjs from "rollup-plugin-commonjs";

export default {
    entry: "app/main.aot.js",
    dest: "bundle.js",
    format: "iife",
    sourceMap: true,
    plugins: [
        resolve({ module: true }),
        commonjs({
            include: [ "node_modules/rxjs/**", "node_modules/prismjs/**" ],
            namedExports: {
                "node_modules/prismjs/prism.js": [ "highlight", "languages" ],
            },
        }),
    ],

    onwarn: function (warning) {
        if (warning.message.indexOf("The 'this' keyword is equivalent to 'undefined'") > -1) {
            return;
        }

        console.warn(warning.message);
    },
}
