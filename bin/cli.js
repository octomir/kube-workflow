#!/usr/bin/env node
const os = require("os")
const path = require("path")
const { mkdtemp } = require("fs/promises")
const fs = require("fs-extra")
const { Command } = require("commander")

const { highlight, fromJson: themeFromJson } = require("cli-highlight")

const program = new Command()

const builder = require("../action/build/builder")
const logger = require("../action/build/utils/logger")
const shell = require("../action/build/utils/shell")

program
  .version(require(`${__dirname}/../package.json`).version)
  .command("build-manifests")
  .alias("b")
  .alias("build")
  .description(
    "Build manifests using kube-workflow with current directory configuration"
  )
  .option("--env, -e <env>", "select environment (dev | preprod | prod), default dev")
  .option("--components <component>, -c", "override components to enable")
  .option("--helm-args <args>, -a", "add extra helm arguments")
  .option("--repository, -r <repo>", "set repository, default to current folder name")
  .option("--output, -o", "enable direct output of manifest")
  .option(
    "--syntax-highlight, -s",
    "enable syntax highlight for yaml when used with -o"
  )
  .action(async (options) => {
    const tmpDir = await mkdtemp(path.join(os.tmpdir(), `kube-workflow`))

    let GIT_REF
    let GIT_SHA
    try {
      GIT_REF = shell("git branch --show-current").trim()
      GIT_SHA = shell("git show -s --format=%H").trim()
    } catch (e) {
      GIT_REF = "master"
      GIT_SHA = "01c1226fc326a2651631ed61e6cbd96cd97f375d"
    }

    const envVars = {
      ...process.env,
      ENVIRONMENT: options.E || process.env.ENVIRONMENT || "dev",
      COMPONENTS: options.C || process.env.COMPONENTS,
      HELM_ARGS: options.A || process.env.HELM_ARGS,

      GIT_REF,
      GIT_SHA,

      KUBEWORKFLOW_PATH: path.resolve(__dirname, ".."),
      WORKSPACE_PATH: process.cwd(),
      REPOSITORY:
        options.R || process.env.REPOSITORY || path.basename(process.cwd()),
      KWBUILD_PATH: tmpDir,
    }

    await builder(envVars)

    const manifestsFile = `${tmpDir}/manifests.yaml`
    if (options.O) {
      let manifests = await fs.readFile(manifestsFile, { encoding: "utf-8" })
      if (options.S) {
        const theme = themeFromJson({
          keyword: "blue",
          built_in: ["cyan", "dim"],
          string: "green",
          default: "gray",
        })
        manifests = highlight(manifests, {
          language: "yaml",
          theme,
        })
      }
      console.log(manifests)
    } else {
      logger.info(`Built manifests files: ${manifestsFile}`)
    }
  })

program.parse(process.argv)
