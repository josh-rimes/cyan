#!/usr/bin/env node

import { Command } from "commander";

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
    console.log("expand: not implemented yet", {
      source,
      explain: options.explain,
    });
  });

program
  .command("lint")
  .description(
    "Validate that annotations resolve to known snippets with required parameters",
  )
  .argument("<source>", "path to the .cyan.yml source file")
  .action((source: string) => {
    console.log("lint: not implemented yet");
  });

program.parse();
