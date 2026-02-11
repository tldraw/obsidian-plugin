import path from "path"
import fs from "fs"

const distDirectory = path.join(
  import.meta.dirname, '..', 'dist', 'production'
)

const distFiles = [
  'main.js',
  'styles.css',
].map(file => path.join(distDirectory, file))

const releaseDirectory = path.join(import.meta.dirname, '..', 'release')

const releaseFiles = [
  'manifest.json',
  'versions.json',
].map(file => path.join(releaseDirectory, file))

const filesToPackage = [...distFiles, ...releaseFiles]

const runCleanMode = process.argv.includes('--clean')
const restArgv = process.argv.filter(arg => arg !== '--clean')

// By default, the package directory will be the root of the plugin directory
let packageDirectory = path.join(releaseDirectory, 'package')

for (const arg of restArgv) {
  if (arg.startsWith('--out-dir=')) {
    // If the string is empty, fallback to the default package directory
    packageDirectory = arg.split('=')[1] || packageDirectory
    if(packageDirectory) {
      packageDirectory = path.normalize(packageDirectory)
    }
  }
}

if (!fs.existsSync(packageDirectory)) {
  fs.mkdirSync(packageDirectory, { recursive: true })
}

async function main() {
  console.log('Packaging files for release...')
  console.log('Files to package:', filesToPackage)
  console.log('Package directory:', packageDirectory)

  // Check if the required dist files are present
  for (const file of distFiles) {
    if (!fs.existsSync(file)) {
      console.error(`The following file is missing from the dist directory: ${file}`)
      console.error('Please run `yarn build` to generate the files')
      process.exit(1)
    }
  }

  // Check if the required release files are present
  for (const file of releaseFiles) {
    if (!fs.existsSync(file)) {
      console.error(`The following file is missing from the release directory: ${file}`)
      console.error('Please ensure the release directory contains the latest manifest.json and versions.json')
      process.exit(1)
    }
  }

  // Copy the files to the package directory
  for (const file of filesToPackage) {
    const destFile = path.join(packageDirectory, path.basename(file))
    fs.copyFileSync(file, destFile)
    console.log(`Copied ${path.basename(file)} to ${packageDirectory}`)
  }
}

function cleanMode() {
  console.log('Cleaning up the package files from the given directory...')
  console.log('Directory to clean:', packageDirectory)
  for (const file of filesToPackage) {
    const destFile = path.join(packageDirectory, path.basename(file))
    if (fs.existsSync(destFile)) {
      console.log(`Removing ${destFile}...`)
      fs.rmSync(destFile)
    }
  }
}

if (!runCleanMode) {
  main()
} else {
  cleanMode()
}

