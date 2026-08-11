#!/usr/bin/env node

import { Command } from "commander";
import { runExplainCommand } from "./commands/expand.js";
import { runLintCommand } from "./commands/lint.js";
import { join, dirname } from "path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const program = new Command();

program
  .name("cyan")
  .description(
    "CLI preprocessor for GitLab CI YAML — expands @annotations into pre-built pipeline snippets",
  )
  .version("0.1.0");

program
  .command("init")
  .description(
    "Scaffold a starter .gitlab-ci.cyan.yml and cyan-snippets/ folder",
  )
  .action(() => {
    console.log("init: not implemented yet");
  });

program
  .command("build")
  .description(
    "Expand annotations in a source file and write plain GitLab CI YAML",
  )
  .argument("<source>", "path to the .cyan.yml source file")
  .option("-o, --output <path>", "output file path")
  .action((source: string, options: { output?: string }) => {
    console.log("build: not implemented yet", {
      source,
      output: options.output,
    });
  });

program
  .command("expand")
  .description(
    "Dry run: show what each annotation would expand to, without writing output",
  )
  .argument("<source>", "path to the .cyan.yml source file")
  .option("--explain", "print resolution details for each annotation")
  .action((source: string, options: { explain?: boolean }) => {
    if (!options.explain) {
      console.error(
        "expand: only --explain is currently implemented. Run `cyan expand --explain <source>`.",
      );
      process.exitCode = 1;
      return;
    }

    const dirs = {
      localDir: "./cyan-snippets",
      bundledDir: join(__dirname, "../snippets/bundled"),
    };

    const { text, exitCode } = runExplainCommand(source, dirs);
    console.log(text);
    process.exitCode = exitCode;
  });

program
  .command("lint")
  .description(
    "Validate that annotations resolve to known snippets with required parameters",
  )
  .argument("<source>", "path to the .cyan.yml source file")
  .action((source: string) => {
    const dirs = {
      localDir: "./cyan-snippets",
      bundledDir: join(__dirname, "../snippets/bundled"),
    };

    const { text, exitCode } = runLintCommand(source, dirs);
    console.log(text);
    process.exitCode = exitCode;
  });

program.parse();
