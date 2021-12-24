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

export const batch = <T>(array: T[], size: number): Array<T>[] => {
  const result: Array<T>[] = []
  let i = 0
  for (i; i + size < array.length; i += size) {
    result.push(array.slice(i, i + size))
  }
  if (i < array.length) {
    result.push(array.slice(i))
  }

  return result
}

export type BatchMapFunction<T> = {
  (item: T, index?: number, arr?: T[]): Promise<any>
}

export const batchMap = async <T>(array: T[], batchSize: number, func: BatchMapFunction<T>) => {
  const batches = batch(array, batchSize)
  const result: any[] = []
  for (const batch of batches) {
    const batchResult = await Promise.all(batch.map(func))
    batchResult.forEach((r) => result.push(r))
  }
  return result
}