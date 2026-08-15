#!/usr/bin/env node
import { battle } from '../aba/cli.js';

battle(process.argv.slice(2)).catch((err) => {
  console.error(err);
  process.exit(1);
});