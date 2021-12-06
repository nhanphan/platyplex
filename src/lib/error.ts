import { Command } from "commander"
import { exit } from "process"

function errorColor(str: string) {
  // Add ANSI escape codes to display text in red.
  return `\x1b[31m${str}\x1b[0m`
}

export const configure = (program: Command) => {
  program.configureOutput({
    writeErr: (str) => process.stdout.write(`[ERR] ${str}`),
    // Highlight errors in color.
    outputError: (str, write) => write(errorColor(str))
  })
}

export const fatalError = (str: string, e?: Error) => {
  if (e) {
    console.error(str, e)
  } else {
    console.error(str)
  }
  exit(1)
}