import { registerAs } from "@nestjs/config";

export default registerAs('config',()=>{
    return {
        database:{
            host:process.env.DB_HOST,
            port:process.env.DB_PORT,
            username:process.env.DB_USERNAME,
            password:process.env.DB_PASSWORD,
            database:process.env.DB_NAME
        },
        databaseClient:{
            host:process.env.DB_HOST_CLIENT,
            port:process.env.DB_PORT_CLIENT,
            username:process.env.DB_USERNAME_CLIENT,
            password:process.env.DB_PASSWORD_CLIENT,
            database:process.env.DB_NAME_CLIENT
        },
        JWT:{
            secret:process.env.JWT_KEY
        }
    }
})