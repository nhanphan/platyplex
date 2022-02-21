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

export const isDirectory = (path: string) => {
  return fs.lstatSync(path).isDirectory()
}

export const findFiles = (paths: string[]): string[] => {
  const results: string[] = []
  for (const path of paths) {
    if (!fs.existsSync(path)) {
      throw new Error(`${path} does not exist`)
    }
    if (isDirectory(path)) {
      const files = fs.readdirSync(path)
      files.forEach((f) => {
        // TODO check whether this is absolute path
        if (!isDirectory(f)) {
          results.push(f)
        }
      })
    } else {
      results.push(path)
    }
  }
  return results
}

export const findTargets = (paths: string[]): Target[] => {
  const results: Target[] = []
  paths.forEach((path: string) => {
    if (isUrl(path)) {
      results.push({
        path,
        type: TargetType.Uri
      })
    } else if (fs.existsSync(path)) {
      if (isDirectory(path)) {
        const files = fs.readdirSync(path)
        files.forEach((f) => {
          // TODO check whether this is absolute path
          if (!isDirectory(f)) {
            results.push({
              path: f,
              type: TargetType.File
            })
          }
        })
      } else {
        results.push({
          path,
          type: TargetType.File
        })
      }
    } else {
      throw new Error(`Invalid target ${path}`)
    }
  })

  return results
}

export const toCachePath = (p: string): string => {
  const parsed = path.parse(p)
  return `${parsed.dir}/${parsed.name}-cache.json`
}