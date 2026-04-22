import { ResponseData } from "@src/models/ResponseData";
import { Logger } from "@src/utilts/invoLogger";
import { Request, Response, NextFunction } from "express";
export function errorHandler(
    err: any,
    req: Request,
    res: Response,
    next: NextFunction
) {
    console.error("Error:", err);

    Logger.error(err.message, { stack: err.stack });

    const statusCode = err.statusCode ?? 200

    return res.status(statusCode).send(
        new ResponseData(false, err.message || "Internal Server Error", [])
    );
}