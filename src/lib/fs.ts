import fs from 'fs'
import path from 'path'
import { isUrl } from './util'

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

export const enum TargetType {
  Uri = 'uri',
  File = 'file'
}

export interface Target {
  type: TargetType,
  path: string
}

export const findTargets = (paths: string[]): Target[] => {
  const results: Target[] = []
  paths.forEach((path: string) => {
    let result
    if (isUrl(path)) {
      result = {
        path,
        type: TargetType.Uri
      }
    } else if (fs.existsSync(path)) {
      if (fs.lstatSync(path).isDirectory()) {
        const files = fs.readdirSync(path)
        files.forEach((f) => {
          result = {
            path: f,
            type: TargetType.File
          }
        })
      } else {
        result = {
          path,
          type: TargetType.File
        }
      }
    }
    if (!result) {
      throw new Error(`Invalid target ${path}`)
    }
    results.push(result)
  })

  return results
}