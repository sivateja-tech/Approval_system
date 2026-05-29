const {verifyToken}=require('../utils/jwt.util');
const {error}=require('../utils/response.util');
const prisma=require('../config/db');
const authenticate=async(req ,res ,next)=>{
    try{
    const authHeader=req.headers.authorization;
    if(!authHeader || !authHeader.startsWith('Bearer')){
        return error(res,"No token provided",401);
    }
    const token=authHeader.split(' ')[1];
    const decoded=verifyToken(token);
    const user=await prisma.user.findUnique({
        where:{id:decoded.userId},
        include:{ department: true, hodLevel: true},
    });
    if(!user || !user.isActive){
        return error(res,"User not found or Inactive",401);
    }
    req.user=user;
    next();
}catch(err){
    return error(res,"Invalid or expired token",401);
}

};
module.exports={authenticate};