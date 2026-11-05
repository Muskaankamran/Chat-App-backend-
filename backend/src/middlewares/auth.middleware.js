import { verifyAuthToken } from "../utils/auth.utils.js";

export function authenticateToken(req,res,next){
    const authorization = req.get("authorization");
    const bearerToken = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
    const token = bearerToken || req.cookies?.token;

    if(!token) {
        return res.status(401).json({ message: "Unauthorized" });
    }

    try{
        req.user = verifyAuthToken(token);
        next()
    }catch{
        res.status(401).json({
            message: "Invalid or expired token",
        })
    }

}
export function requireAdmin(req,res,next){
    if( req.user?.role !== "admin"){
        return res.status(403).json({
            message:"Forbidden"
        })
    }
    next()
}
