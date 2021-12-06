"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fatalError = exports.configure = void 0;
const process_1 = require("process");
function errorColor(str) {
    // Add ANSI escape codes to display text in red.
    return `\x1b[31m${str}\x1b[0m`;
}
const configure = (program) => {
    program.configureOutput({
        writeErr: (str) => process.stdout.write(`[ERR] ${str}`),
        // Highlight errors in color.
        outputError: (str, write) => write(errorColor(str))
    });
};
exports.configure = configure;
const fatalError = (str, e) => {
    if (e) {
        console.error(str, e);
    }
    else {
        console.error(str);
    }
    (0, process_1.exit)(1);
};
exports.fatalError = fatalError;
