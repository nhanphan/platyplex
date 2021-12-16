import fs from 'fs'
import path from 'path'

export const loadJson = (file: string) => {
  return JSON.parse(fs.readFileSync(file).toString())
}

export const saveJson = (file: string, obj: any) => {
  const dirname = path.dirname(file)
  if (!fs.existsSync(dirname)) {
    fs.mkdirSync(dirname, { recursive: true })
  }
  return fs.writeFileSync(file, JSON.stringify(obj, null, 2))
}
