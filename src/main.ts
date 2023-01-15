import * as core from '@actions/core'
import * as github from '@actions/github'
import axios from 'axios'

const MARK = {
  START: '<!--START_SECTION:rust-thanks-card-->',
  END: '<!--END_SECTION:rust-thanks-card-->'
}

async function run(): Promise<void> {
  try {
    const list = await getList()
    if (list === '') {
      core.setFailed('Failed to get the list from Rust Thanks')
      return
    }
    const name: string = core.getInput('name')
    const token: string = core.getInput('github_token')
    const data = extractData(list, name)
    if (Object.keys(data).length === 0) {
      core.setFailed(
        `Failed to extract data by ${name}, possibly your name is not in the list`
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
    let url = ''
    if (type === 'svg') {
      const imageURL = core.getInput('image_url')
      url = genSVGURL(rank.toString(), contributions.toString(), imageURL)
      core.info(`SVG URL: ${url}`)
    } else {
      url = genBadgeURL(rank.toString(), contributions.toString())
      core.info(`badge URL: ${url}`)
    }
    await embedURL(token, url)
  } catch (error) {
    if (error instanceof Error) core.setFailed(error.message)
  }
}

async function embedURL(token: string, url: string): Promise<void> {
  try {
    const octokit = github.getOctokit(token)
    const {owner, repo} = github.context.repo
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = await octokit.rest.repos.getContent({
      owner,
      repo,
      path: 'README.md'
    })
    const content = Buffer.from(data.content, 'base64').toString()
    const re = new RegExp(`(${MARK.START})[\\s\\S]*(${MARK.END})`)
    if (!re.test(content)) {
      core.error('Failed to embed URL, possibly the marker is not found')
      return
    }
    const newReadme = content.replace(re, `$1\n<img src=${url}>\n$2`)
    await octokit.rest.repos.createOrUpdateFileContents({
      owner,
      repo,
      path: 'README.md',
      message: 'Update README.md',
      content: Buffer.from(newReadme).toString('base64'),
      sha: data.sha
    })
    return
  } catch (error) {
    if (error instanceof Error) core.setFailed(error.message)
    return
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
