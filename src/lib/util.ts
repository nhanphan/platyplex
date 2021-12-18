import { URL } from 'url'


export const isUrl = (s: string) => {
  try {
    new URL(s)
    return true
  } catch (err) {
    return false
  }
}

export const sleep = (ms: number) => {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}