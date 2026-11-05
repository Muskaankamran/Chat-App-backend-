import 'dotenv/config';
import dns from 'node:dns/promises';
dns.setServers(['1.1.1.1', '8.8.8.8']);

import chalk from 'chalk';
import mongoose from 'mongoose';

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log(chalk.white.bgGreen.bold("Connected to DB"));
}

export default main;