"use strict";

let config = exports;
let env = process.env;

config.SESSION_SECRET = "CakeAndTeaAndTeaAndCake!";

if (env.NODE_ENV !== "production") {
	// Automatically load .env file that should be found at the root of the project dir.
	// Safely and easily swap between running in production, dev and test mode.
	require('dotenv').load();
}

config.MONGODB_URL = env.MONGOLAB_URI;
config.MONGODB_DATABASE = env.MONGODB_DATABASE;
config.MONGODB_USERNAME = env.MONGODB_USERNAME;
config.MONGODB_PASSWORD = env.MONGO_PASSWORD;
config.STRIPE_SECRETKEY = env.STRIPE_SECRETKEY;
config.STRIPE_PUBLICKEY = env.STRIPE_PUBLICKEY;
config.SENDGRID_USER = env.SENDGRID_USER;
config.SENDGRID_KEY = env.SENDGRID_KEY;
config.AWS_ACCESS_KEY_ID = env.AWS_ACCESS_KEY_ID;
config.AWS_SECRET_KEY = env.AWS_SECRET_KEY;
config.AWS_REGION = env.AWS_REGION;
config.API_PORT = env.PORT;
config.FE_URL = env.FE_URL;
config.FB_APP_ID = env.FB_APP_ID;
config.FB_APP_SECRET = env.FB_APP_SECRET;
