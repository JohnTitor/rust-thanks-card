import * as core from '@actions/core'
import axios from 'axios'

async function run(): Promise<void> {
  try {
    const res = await axios.get(
      'https://raw.githubusercontent.com/rust-lang/thanks/gh-pages/rust/all-time/index.html'
    )
    core.info(res.data)
  } catch (error) {
    if (error instanceof Error) core.setFailed(error.message)
  }
}

run()
