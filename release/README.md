# Creating a Release


## Updating version

1. Manually modify the version inside the `package.json` file.

2. Run the `version` script to update the relevant files in `release/`
   ```bash
   npm run version
   ```

## Packaging files for release

The following files are needed for a release:

- `main.js` - Release
- `styles.css` - Release
- `manifest.json` - Release, Repo
- `versions.json` - Repo

> **Repo**: Commit as a file in the root of the plugin release repository
>
> **Release**: Upload as part of the tagged release

Run the following command to generate the needed files:

```bash
npm run make-release-files [--package-out-dir=<directory>]
```

This command will:
1. Run `npm run version` to update `manifest.json` and `versions.json` in the `release/` directory
2. Run `npm run build` to build the production files
3. Run `npm run package -- --out-dir=<directory>` to copy all release files to the specified directory

> The `--package-out-dir` argument is forwarded to `npm run package` as `--out-dir`
>
> If `--package-out-dir` is not specified, files will be copied to `release/package/`
>
> The `package` script also supports `--clean` to remove packaged files from a directory:
> ```bash
> npm run package -- --clean [--out-dir=<directory>]
> ```
