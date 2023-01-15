import {extractData} from '../src/main'
import {test} from '@jest/globals'
import {assert} from 'console'
import fs from 'fs'
import path from 'path'

test('extract data from HTML', () => {
  const testHTMLPath = path.join(__dirname, 'test.html')
  const testHTML = fs.readFileSync(testHTMLPath, 'utf8')
  const data = extractData(testHTML, 'bors')
  assert(data.get('name') === 'bors')
  assert(data.get('rank') === '1')
  assert(data.get('contributions') === '40782')
})
