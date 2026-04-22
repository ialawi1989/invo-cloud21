import path from "path";
import winston from "winston";

// Use a relative path inside your project, e.g., logs/myapp.log
const logPath = path.join(__dirname,  process.env.STORAGE_PATH + "/myapp.log");

const loggerTest = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: logPath }),
    new winston.transports.Console(),
  ],
});

export default loggerTest;