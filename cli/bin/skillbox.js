#!/usr/bin/env node
"use strict";

// Minimum Node version guard — fail fast with a clear message
const [major] = process.versions.node.split(".").map(Number);
if (major < 18) {
  process.stderr.write(
    `\nError: skillbox requires Node.js 18 or later.\n` +
      `You are running Node.js ${process.versions.node}.\n` +
      `Please upgrade: https://nodejs.org\n\n`
  );
  process.exit(1);
}

require("../dist/index.js");
