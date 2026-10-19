import { listModules } from './hq'
import type { Module } from './types'

export default async function(): Promise<Module[]> {
  return listModules()
}
