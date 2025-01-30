const chalk = require("chalk");

class Logger {
  static info(message, ...args) {
    console.log(chalk.blue(`[INFO] ${message}`), ...args);
  }

  static success(message, ...args) {
    console.log(chalk.green(`[SUCCESS] ${message}`), ...args);
  }

  static error(message, ...args) {
    console.error(chalk.red(`[ERROR] ${message}`), ...args);
    if (
      args.length > 0 &&
      args[0] instanceof Error &&
      process.env.NODE_ENV === "development"
    ) {
      console.error(chalk.red(args[0].stack));
    }
  }

  static warn(message, ...args) {
    console.warn(chalk.yellow(`[WARN] ${message}`), ...args);
  }
}

module.exports = Logger;
