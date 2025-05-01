export interface JwtPayload {
    sub: string;         
    role: string;        
    sessionId: string; 
    iat?: number;         
    exp?: number;         
  }