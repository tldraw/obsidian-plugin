import { ChildProcess, execFile } from 'child_process'
import util from 'util'
import { createPrefixer } from './utils/pipe'
import fs from 'fs'

const execFileAsync = util.promisify(execFile)

function logWithLabel(label: string, child: ChildProcess) {
  // Transform the output to include the process name after each line 
  child.stderr?.pipe(createPrefixer(`[${label}] - `)).pipe(process.stderr)
  child.stdout?.pipe(createPrefixer(`[${label}] - `)).pipe(process.stdout)
}

async function main() {
  let packageOutDirectory = ''
  for (const arg of process.argv) {
    if (arg.startsWith('--package-out-dir=')) {
      packageOutDirectory = arg.split('=')[1]
    }
  }

  if (packageOutDirectory) {
    if (!fs.existsSync(packageOutDirectory)) {
      fs.mkdirSync(packageOutDirectory, { recursive: true })
    }
  }

  console.log('Making release files...')

  const versionProcess = execFileAsync('npm', ['run', 'version'])
  logWithLabel('version', versionProcess.child)
  await versionProcess

  const buildProcess = execFileAsync('npm', ['run', 'build'])
  logWithLabel('build', buildProcess.child)
  await buildProcess

  const packageProcess = execFileAsync('npm', ['run', 'package', '--', `--out-dir=${packageOutDirectory}`])
  logWithLabel('package', packageProcess.child)
  await packageProcess

  console.log('Release files created successfully')
}

main().catch((error) => {
  console.error('Error making release files:', error)
  process.exit(1)
})