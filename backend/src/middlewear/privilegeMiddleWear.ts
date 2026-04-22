
import { Request, Response, NextFunction } from 'express';
export class PermissionMiddleware {
    public static checkPermission(privilege: string, role: string) {
        return (req: Request, res: Response, next: NextFunction) => {
            const employeePrivileges =res.locals.privileges;


            if (employeePrivileges[privilege].actions[role].access)
                return next()

            return res.status(403).json({
                message: "Forbidden"
            })
        }

    }
}




