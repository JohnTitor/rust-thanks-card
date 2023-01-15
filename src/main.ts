import * as core from '@actions/core'
import axios from 'axios'

async function run(): Promise<void> {
  try {
    const list = await getList()
    if (list === '') {
      core.setFailed('Failed to get the list from Rust Thanks')
      return
    }
    const name: string = core.getInput('name')
    const data = extractData(list, name)
    if (Object.keys(data).length === 0) {
      core.setFailed(
        'Failed to extract data, possibly your name is not in the list'
      )
      return
    }
  } catch (error) {
    if (error instanceof Error) core.setFailed(error.message)
  }
}

export function extractData(
  html: string,
  grepName: string
): Map<string, string | number> {
  const data = new Map<string, string | number>()
  const lns = html.split('\n')
  const nameIdx = lns.findIndex((ln: string) => ln.includes(grepName))
  if (nameIdx < 0) {
    core.setFailed(`${grepName} not found`)
  }
  const re = /<td class="bn">(.+)<\/td>/
  const nameArr = re.exec(lns[nameIdx].trim())
  const rankArr = re.exec(lns[nameIdx - 1].trim())
  const contributionsArr = re.exec(lns[nameIdx + 1].trim())
  if (nameArr === null || rankArr === null || contributionsArr === null) {
    core.setFailed('Failed to parse')
    return data
  }
  data.set('name', nameArr[1])
  data.set('rank', rankArr[1])
  data.set('contributions', contributionsArr[1])
  return data
}

async function getList(): Promise<string> {
  try {
    const res = await axios.get(
      'https://raw.githubusercontent.com/rust-lang/thanks/gh-pages/rust/all-time/index.html'
    )
    return res.data
  } catch (error) {
    if (error instanceof Error) core.setFailed(error.message)
  }
  return ''
}

run()
