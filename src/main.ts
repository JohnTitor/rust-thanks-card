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
    const rank = data.get('rank')
    const contributions = data.get('contributions')
    if (rank === undefined || contributions === undefined) {
      core.setFailed('Failed to get rank or contributions')
      return
    }
    const type = core.getInput('type')
    if (type === 'svg') {
      const imageURL = core.getInput('image_url')
      const url = genSVGURL(rank.toString(), contributions.toString(), imageURL)
      core.setOutput('badge-svg', url)
    } else {
      const url = genBadgeURL(rank.toString(), contributions.toString())
      core.setOutput('badge-url', url)
    }
  } catch (error) {
    if (error instanceof Error) core.setFailed(error.message)
  }
}

export function extractData(
  html: string,
  grepName: string
): Map<string, string> {
  const data = new Map<string, string>()
  const lns = html.split('\n')
  const nameIdx = lns.findIndex((ln: string) => ln.includes(grepName))
  if (nameIdx < 0) {
    core.setFailed(`${grepName} not found`)
  }
  const re = /<td class="bn">(.+)<\/td>/
  const nameLn = re.exec(lns[nameIdx])
  const rankLn = re.exec(lns[nameIdx - 1])
  const contributionsLn = re.exec(lns[nameIdx + 1])
  if (nameLn === null || rankLn === null || contributionsLn === null) {
    core.setFailed('Failed to parse')
    return data
  }
  data.set('name', nameLn[1])
  data.set('rank', rankLn[1])
  data.set('contributions', contributionsLn[1])
  return data
}

export function genBadgeURL(rank: string, contributions: string): string {
  if (rank.endsWith('1')) {
    rank = `${rank}st`
  } else if (rank.endsWith('2')) {
    ;`${rank}nd`
  } else if (rank.endsWith('3')) {
    ;`${rank}rd`
  } else {
    ;`${rank}th`
  }
  const url = `https://img.shields.io/badge/Rust%20Contributions-${contributions}%20contibutions,%20${rank}-orange?logo=rust`
  return url
}

export function genSVGURL(
  rank: string,
  contributions: string,
  imageURL: string
): string {
  if (rank.endsWith('1')) {
    rank = `${rank}st`
  } else if (rank.endsWith('2')) {
    ;`${rank}nd`
  } else if (rank.endsWith('3')) {
    ;`${rank}rd`
  } else {
    ;`${rank}th`
  }
  if (imageURL !== '') {
    imageURL = `&image=${imageURL}`
  }
  const url = `https://cardivo-woad.vercel.app/api?name=Rust%20Contribution%20Stats%0A&description=Contributions%F0%9F%93%9D:%20${contributions}%20Rank%F0%9F%8F%86:%20${rank}${imageURL}&backgroundColor=%23ecf0f1&disableAnimation=true`
  return url
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
