// cleanupMiddleware.ts
import { Request, Response, NextFunction } from 'express';


export class CleanupMiddleware {
public static  cleanupMiddleware  (req: Request, res: Response, next: NextFunction)  {
  // Perform memory and trash cleanup tasks here
  // For example, you can clear caches, delete temporary files, etc.

  // Example: Clearing cache
  CleanupMiddleware.clearCache();

  // Example: Deleting temporary files
  CleanupMiddleware.deleteTemporaryFiles();

  // Call the next middleware or route handler
  next();
}

// Example: Clearing cache function
private static  clearCache () {
  // Code to clear cache
  console.log('Cache cleared');
};

// Example: Deleting temporary files function
private static  deleteTemporaryFiles  (){
  // Code to delete temporary files
  console.log('Temporary files deleted');
};

}