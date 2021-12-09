import fs from 'fs'

export const loadJson = (path: string) => {
  return JSON.parse(fs.readFileSync(path).toString())
}

export const saveJson = (path: string, obj: any) => {
  return fs.writeFileSync(path, JSON.stringify(obj, null, 2))
}