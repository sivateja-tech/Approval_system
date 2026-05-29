const success=(res,data,message='Success',statusCode=200)=>{
    return res.status(statusCode).json({success:true,message,data});
};
const error=(res,message='Error',statusCode=400,errors=null)=>{
    const payload={success:false,message};
    if(errors)payload.errors=errors;
    return res.status(statusCode).json(payload);
}
const paginate=(res,data,total,page,limit,message='Success')=>{
    return res.status(200).json({
        sucesss:true, 
        message, 
        data,            
        pagination:{total,page:Number(page),limit:Number(limit),pages:Math.ceil(total/limit)},
    });
};
module.exports={success,error,paginate};