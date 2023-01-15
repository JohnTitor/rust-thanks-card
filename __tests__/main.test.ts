import {extractData, genBadgeURL, genSVGURL} from '../src/main'
import {test} from '@jest/globals'
import fs from 'fs'
import path from 'path'
import {fail} from 'assert'

test('extract data from HTML', () => {
  const testHTMLPath = path.join(__dirname, 'test.html')
  const testHTML = fs.readFileSync(testHTMLPath, 'utf8')
  const data = extractData(testHTML, 'bors')
  console.log(data)
  if (
    data.get('name') !== 'bors' ||
    data.get('rank') !== '1' ||
    data.get('contributions') !== '40782'
  ) {
    fail('assertion failed: data extraction')
  }
})

test('generate badge URL', () => {
  const url = genBadgeURL('1', '40782')
  console.log(url)
  if (
    url !==
    'https://img.shields.io/badge/Rust%20Contributions-40782%20contibutions,%201st-orange?logo=rust'
  ) {
    fail('assertion failed: badge URL')
  }
})

test('extract SVG URL', () => {
  const url = genSVGURL(
    '1',
    '40782',
    'https://avatars.githubusercontent.com/u/3372342?v=4'
  )
  console.log(url)
  if (
    url !==
    'https://cardivo-woad.vercel.app/api?name=Rust%20Contribution%20Stats%0A&description=Contributions%F0%9F%93%9D:%2040782%20Rank%F0%9F%8F%86:%201st&image=https://avatars.githubusercontent.com/u/3372342?v=4&backgroundColor=%23ecf0f1&disableAnimation=true'
  ) {
    fail('assertion failed: SVG URL')
  }
})
