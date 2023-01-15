import * as core from '@actions/core'
import axios from 'axios'

async function run(): Promise<void> {
  try {
    const res = await axios.get(
      'https://raw.githubusercontent.com/rust-lang/thanks/gh-pages/rust/all-time/index.html'
    )
    const lns = res.data.split('\n')
    const nameIdx = lns.findIndex((ln: string) => ln.includes('Yuki Okushi'))
    if (nameIdx < 0) {
      core.setFailed('Yuki Okushi not found')
    }
    const re = /<td class="bn">(.+)<\/td>/
    const name = re.exec(lns[nameIdx].trim())
    const rank = re.exec(lns[nameIdx - 1].trim())
    const contributions = re.exec(lns[nameIdx + 1].trim())
    if (name === null || rank === null || contributions === null) {
      core.setFailed('Failed to parse')
    } else {
      core.setOutput('name', name[1])
      core.setOutput('rank', rank[1])
      core.setOutput('contributions', contributions[1])
    }
  } catch (error) {
    if (error instanceof Error) core.setFailed(error.message)
  }
}

run()
