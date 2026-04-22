export interface EmployeeSession {
  id: string;                 // uuid
  employeeId: string;         // uuid
  deviceId: string;           // device identifier
  refreshTokenHash: string;   // hashed refresh token
  expiresAt: Date;            // expiration timestamp
  isRevoked: boolean;         // revocation flag
  createdAt: Date;            // created timestamp
  updatedAt: Date;            // last update timestamp
}

export interface CreateEmployeeSessionInput {
  employeeId: string;
  deviceId: string;
  refreshTokenHash: string;
  refreshTokenExpiryDate:Date
}
